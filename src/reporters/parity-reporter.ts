/**
 * Vitest custom reporter that reclassifies test failures as "expected"
 * when the active adapter's parity.json declares them.
 *
 * Tests always run as normal `test()` — no `test.fails` wrapping needed.
 * The reporter post-processes results through `scripts/lib/parity.js`, the
 * same reading generate-status and ci-merge-reports apply to JSON reports:
 *   - A failing test whose catalog ID is in expected_failures → expected failure
 *   - A passing test whose catalog ID is in expected_failures → unexpected pass (regression fixed)
 *   - On a full run, a registered ID with no test that passed or failed → orphaned registration
 *   - Writes a verdict file the runner reads to reclassify the exit code
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Reporter, SerializedError, TestModule } from 'vitest/node';
import { classifyResults, loadParity, parityVerdict, type TestResult } from '../../scripts/lib/parity.js';

export default class ParityReporter implements Reporter {
	private gapForId = new Map<string, string>();
	private env: NodeJS.ProcessEnv;

	constructor({ env = process.env }: { env?: NodeJS.ProcessEnv } = {}) {
		this.env = env;
	}

	onInit(): void {
		const adapterPath = this.env.SCREEPS_OK_ADAPTER ?? '';
		if (!adapterPath) return;
		this.gapForId = loadParity(resolve(dirname(adapterPath), 'parity.json')).gapForId;
	}

	onTestRunEnd(testModules: ReadonlyArray<TestModule>, unhandledErrors: ReadonlyArray<SerializedError> = []): void {
		const results: TestResult[] = [];
		// A file that failed to collect has no failed tests, and nothing registers an unhandled error.
		let errorCount = unhandledErrors.length;
		for (const mod of testModules) {
			errorCount += mod.errors().length;
			for (const testCase of mod.children.allTests()) {
				results.push({ fullName: testCase.fullName, state: testCase.result().state, file: mod.moduleId });
			}
		}

		// Only a full run can tell a stale registration from one outside the filter.
		const classified = classifyResults(this.gapForId, results, { fullRun: this.env.SCREEPS_OK_FULL_RUN === '1' });
		const expectedByGap = new Map<string, string[]>();
		const unexpectedByGap = new Map<string, string[]>();
		for (const [id, { gapId, passed, failed }] of classified.idStats) {
			if (failed > 0) {
				const list = expectedByGap.get(gapId) ?? [];
				list.push(passed > 0 ? `${id} (${failed}F/${passed}P)` : `${id} (${failed})`);
				expectedByGap.set(gapId, list);
			} else {
				const list = unexpectedByGap.get(gapId) ?? [];
				list.push(`${id} (${passed})`);
				unexpectedByGap.set(gapId, list);
			}
		}

		if (classified.expected.length > 0) {
			console.log(`\n Parity: ${classified.expected.length} expected failure(s)`);
			for (const [gapId, parts] of expectedByGap) console.log(`  ${gapId}: ${parts.join(', ')}`);
		}
		if (classified.unexpectedPasses.length > 0) {
			console.log(`\n Parity: ${classified.unexpectedPasses.length} unexpected pass(es) — regression fixed?`);
			for (const [gapId, parts] of unexpectedByGap) console.log(`  ${gapId}: ${parts.join(', ')} now PASSES`);
		}
		if (classified.orphans.length > 0) {
			console.log(`\n Parity: ${classified.orphans.length} registration(s) matched no test that ran — fix the id or prune it`);
			for (const id of classified.orphans) console.log(`  ${this.gapForId.get(id)}: ${id}`);
		}
		if (classified.untagged.length > 0) {
			console.log(`\n Parity: ${classified.untagged.length} test(s) carry no single catalog id — name one id (or one \`:row\`) per test`);
			for (const t of classified.untagged) console.log(`  ${t.fullName}`);
		}

		// Vitest calls process.exit() directly, so we cannot reliably override it
		// from a reporter. The runner reads this file after vitest exits.
		const verdictPath = this.env['SCREEPS_OK_PARITY_VERDICT'];
		if (verdictPath) writeFileSync(verdictPath, JSON.stringify(parityVerdict(classified, errorCount)));
	}
}
