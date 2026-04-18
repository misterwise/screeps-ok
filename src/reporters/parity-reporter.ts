/**
 * Vitest custom reporter that reclassifies test failures as "expected"
 * when the active adapter's parity.json declares them.
 *
 * Tests always run as normal `test()` — no `test.fails` wrapping needed.
 * The reporter post-processes results:
 *   - A failing test whose catalog ID is in expected_failures → expected failure
 *   - A passing test whose catalog ID is in expected_failures → unexpected pass (regression fixed)
 *   - Sets process.exitCode = 0 when all failures are expected
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Reporter, TestCase, TestModule } from 'vitest/node';

// ── Parity.json schema ────────────────────────────────────────
//
// A consumer's `parity.json` is an *overlay*. It may extend a base file
// (typically shipped inside the screeps-ok package) and add or remove
// entries on top:
//
//   {
//     "extends": "screeps-ok/parity/xxscreeps.json",
//     "expected_failures": { "their-new-gap": { ... } },
//     "expected_passes": ["BASE-GAP-ID-they-fixed"]
//   }
//
// `extends` is resolved via Node's package resolution from the overlay
// file's directory. Both files share the same gap schema. Overlay entries
// with the same gap id replace the base entry. `expected_passes` removes
// matching gap ids from the merged set entirely (consumer fixed it before
// the next package release prunes it).
//
// In this repo the canonical file (`adapters/xxscreeps/parity.json`) is
// authored directly with no `extends` — the merge is a no-op and behavior
// matches the pre-overlay reporter.

interface ParityGap {
	actual?: string;
	expected?: string;
	tests: string[];
}

interface ParityFile {
	extends?: string;
	expected_failures?: Record<string, ParityGap>;
	expected_passes?: string[];
}

// ── Catalog ID extraction ─────────────────────────────────────

const CATALOG_ID_RE = /\b([A-Z]+-(?:[A-Z]+-)?[0-9]{3}(?::[a-zA-Z]+)?)\b/;

function extractCatalogId(testFullName: string): string | null {
	const match = testFullName.match(CATALOG_ID_RE);
	return match ? match[1] : null;
}

// ── Parity file loading ───────────────────────────────────────

function loadParityFile(path: string): ParityFile | null {
	try {
		return JSON.parse(readFileSync(path, 'utf8')) as ParityFile;
	} catch {
		return null;
	}
}

function loadExtends(fromPath: string, spec: string): ParityFile | null {
	let resolved: string;
	try {
		resolved = createRequire(fromPath).resolve(spec);
	} catch (err) {
		console.error(`Parity reporter: failed to resolve extends "${spec}" from ${fromPath}:`, err);
		return null;
	}
	const base = loadParityFile(resolved);
	if (!base) {
		console.error(`Parity reporter: could not read base parity file at ${resolved}`);
	}
	return base;
}

// ── Reporter ──────────────────────────────────────────────────

export default class ParityReporter implements Reporter {
	private expectedFailIds = new Set<string>();
	private gapForId = new Map<string, string>();

	onInit(): void {
		const adapterPath = process.env.SCREEPS_OK_ADAPTER ?? '';
		if (!adapterPath) return;

		const parityPath = resolve(dirname(adapterPath), 'parity.json');
		const overlay = loadParityFile(parityPath);
		if (!overlay) return;

		const base = overlay.extends
			? loadExtends(parityPath, overlay.extends)
			: null;

		const merged: Record<string, ParityGap> = {
			...(base?.expected_failures ?? {}),
			...(overlay.expected_failures ?? {}),
		};
		for (const gapId of overlay.expected_passes ?? []) {
			delete merged[gapId];
		}

		for (const [gapId, gap] of Object.entries(merged)) {
			for (const testId of gap.tests) {
				this.expectedFailIds.add(testId);
				this.gapForId.set(testId, gapId);
			}
		}
	}

	onTestRunEnd(testModules: ReadonlyArray<TestModule>): void {
		if (this.expectedFailIds.size === 0) return;

		// Collect per-catalog-ID pass/fail counts for expected-fail IDs.
		const idStats = new Map<string, { passed: number; failed: number; gapId: string }>();
		let genuineFailures = 0;

		for (const mod of testModules) {
			for (const testCase of this.allTests(mod)) {
				const catalogId = extractCatalogId(testCase.fullName);
				if (!catalogId || !this.expectedFailIds.has(catalogId)) {
					if (testCase.result().state === 'failed') {
						genuineFailures++;
					}
					continue;
				}

				const gapId = this.gapForId.get(catalogId)!;
				const stats = idStats.get(catalogId) ?? { passed: 0, failed: 0, gapId };
				const state = testCase.result().state;
				if (state === 'failed') stats.failed++;
				else if (state === 'passed') stats.passed++;
				idStats.set(catalogId, stats);
			}
		}

		// Classify each catalog ID:
		// - Any failures → expected (gap still active)
		// - All pass → unexpected pass (regression fixed)
		const expectedByGap = new Map<string, Array<{ id: string; passed: number; failed: number }>>();
		const unexpectedByGap = new Map<string, Array<{ id: string; passed: number }>>();
		let totalExpected = 0;
		let totalUnexpected = 0;

		for (const [catalogId, stats] of idStats) {
			if (stats.failed > 0) {
				totalExpected += stats.failed;
				const list = expectedByGap.get(stats.gapId) ?? [];
				list.push({ id: catalogId, passed: stats.passed, failed: stats.failed });
				expectedByGap.set(stats.gapId, list);
			} else if (stats.passed > 0) {
				totalUnexpected += stats.passed;
				const list = unexpectedByGap.get(stats.gapId) ?? [];
				list.push({ id: catalogId, passed: stats.passed });
				unexpectedByGap.set(stats.gapId, list);
			}
		}

		// Print parity summary
		if (totalExpected > 0) {
			console.log(`\n Parity: ${totalExpected} expected failure(s)`);
			for (const [gapId, entries] of expectedByGap) {
				const parts = entries.map(e =>
					e.passed > 0
						? `${e.id} (${e.failed}F/${e.passed}P)`
						: `${e.id} (${e.failed})`,
				);
				console.log(`  ${gapId}: ${parts.join(', ')}`);
			}
		}

		if (totalUnexpected > 0) {
			console.log(`\n Parity: ${totalUnexpected} unexpected pass(es) — regression fixed?`);
			for (const [gapId, entries] of unexpectedByGap) {
				const parts = entries.map(e => `${e.id} (${e.passed})`);
				console.log(`  ${gapId}: ${parts.join(', ')} now PASSES`);
			}
		}

		// Write a parity verdict file so the runner can reclassify the exit code.
		// Vitest calls process.exit() directly, so we cannot reliably override it
		// from a reporter. The runner reads this file after vitest exits.
		const verdictPath = process.env['SCREEPS_OK_PARITY_VERDICT'];
		if (verdictPath) {
			try {
				writeFileSync(verdictPath, JSON.stringify({
					expectedFailures: totalExpected,
					unexpectedPasses: totalUnexpected,
					genuineFailures,
				}));
			} catch (err) {
				console.error(`Parity reporter: failed to write verdict to ${verdictPath}:`, err);
			}
		}
	}

	private *allTests(mod: TestModule): Generator<TestCase> {
		for (const entry of mod.children.allTests()) {
			yield entry;
		}
	}
}
