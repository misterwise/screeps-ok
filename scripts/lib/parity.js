/**
 * One reading of test results against an adapter's parity.json, shared by the
 * parity reporter (live results), generate-status and ci-merge-reports (JSON
 * reports), so the dashboard and CI summary say what the runner's exit says.
 *
 * A consumer's parity.json is an *overlay*. It may extend a base file
 * (typically shipped inside the screeps-ok package) and add or remove entries:
 *
 *   {
 *     "extends": "screeps-ok/parity/xxscreeps.json",
 *     "expected_failures": { "their-new-gap": { ... } },
 *     "expected_passes": ["BASE-GAP-ID-they-fixed"]
 *   }
 *
 * `extends` resolves through Node's package resolution from the overlay's
 * directory. Overlay gaps replace base gaps of the same id; `expected_passes`
 * drops base gaps the consumer's engine has fixed. This repo's canonical files
 * (`adapters/<engine>/parity.json`) have no `extends`.
 */
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { testCatalogId } from './catalog-id.js';

// Only a missing file means no registrations; a malformed one or an unresolvable `extends` throws.
export function loadParity(parityPath) {
	const overlay = existsSync(parityPath) ? JSON.parse(readFileSync(parityPath, 'utf8')) : {};
	const base = overlay.extends
		? JSON.parse(readFileSync(createRequire(parityPath).resolve(overlay.extends), 'utf8'))
		: {};
	const gaps = { ...base.expected_failures, ...overlay.expected_failures };
	for (const gapId of overlay.expected_passes ?? []) delete gaps[gapId];

	const gapForId = new Map();
	for (const [gapId, gap] of Object.entries(gaps)) {
		for (const id of gap.tests) gapForId.set(id, gapId);
	}
	return { gaps, gapForId };
}

// Tests in a numbered catalog section each carry one catalog id; the 00-* sections test the framework and contract.
const CATALOG_SECTION_RE = /[\\/]tests[\\/](?!00-)[0-9]{2}-[^\\/]+[\\/]/;

// An id with any failing test is an active gap: its failures are expected and
// its passing cases plain passes. An id whose every test passed is an
// unexpected pass. On a full run, a registration no test passed or failed is
// orphaned. Any state but passed/failed counts as skipped. A catalog test with
// no single id is untagged: nothing could register or cover it.
export function classifyResults(gapForId, results, { fullRun }) {
	const tests = results.map(r => ({ ...r, id: testCatalogId(r.fullName) }));
	const idStats = new Map();
	for (const t of tests) {
		const gapId = t.id ? gapForId.get(t.id) : undefined;
		if (!gapId || (t.state !== 'passed' && t.state !== 'failed')) continue;
		const stats = idStats.get(t.id) ?? { gapId, passed: 0, failed: 0 };
		stats[t.state]++;
		idStats.set(t.id, stats);
	}

	const classified = { passed: [], expected: [], failed: [], unexpectedPasses: [], skipped: [], untagged: [], orphans: [], idStats };
	for (const t of tests) {
		if (!t.id && CATALOG_SECTION_RE.test(t.file)) classified.untagged.push(t);
		const stats = t.id ? idStats.get(t.id) : undefined;
		if (t.state === 'failed') (stats ? classified.expected : classified.failed).push(t);
		else if (t.state === 'passed') (stats?.failed === 0 ? classified.unexpectedPasses : classified.passed).push(t);
		else classified.skipped.push(t);
	}
	if (fullRun) classified.orphans = [...gapForId.keys()].filter(id => !idStats.has(id));
	return classified;
}

// A vitest JSON report (or ci-merge-reports' merge of shards) as the results
// the reporter reads live. vitest fills a file's `message` only for an error
// outside its tests: collection, hooks.
export function reportResults(report) {
	const results = [];
	const fileErrors = [];
	for (const file of report.testResults) {
		if (file.message) fileErrors.push({ file: file.name, message: file.message });
		for (const a of file.assertionResults) {
			results.push({ fullName: a.fullName, state: a.status, file: file.name, meta: a.meta });
		}
	}
	return { results, fileErrors };
}

// A report on disk is a full run: filtered runs write `-partial` reports, and CI merges every shard.
export function judgeReport(report, parity) {
	const { results, fileErrors } = reportResults(report);
	const classified = classifyResults(parity.gapForId, results, { fullRun: true });
	return { classified, fileErrors, verdict: parityVerdict(classified, fileErrors.length) };
}

export function parityVerdict(classified, errorCount) {
	return {
		expectedFailures: classified.expected.length,
		unexpectedPasses: classified.unexpectedPasses.length,
		genuineFailures: classified.failed.length + errorCount,
		orphanedRegistrations: classified.orphans.length,
		untaggedTests: classified.untagged.length,
	};
}

export function verdictIsClean(verdict) {
	return verdict.genuineFailures === 0
		&& verdict.unexpectedPasses === 0
		&& verdict.orphanedRegistrations === 0
		&& verdict.untaggedTests === 0;
}

// The verdict forgives failures that are all registered gaps, and fails a run
// vitest passed when a gap now passes, a registration matched no test, or a
// catalog test carries no id. A non-zero exit with nothing registered to
// forgive (no test files, say) stands.
export function parityExitCode(vitestExit, verdict) {
	if (!verdict) return vitestExit;
	if (!verdictIsClean(verdict)) return vitestExit || 1;
	return verdict.expectedFailures > 0 ? 0 : vitestExit;
}
