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
import { baseCatalogId, isCatalogTestFile, TEST_ID_RE, testCatalogId } from './catalog-id.js';

const FILE_KEYS = new Set(['extends', 'expected_failures', 'expected_passes']);
const GAP_KEYS = new Set(['actual', 'expected', 'why', 'intentional', 'tests']);

function readParityFile(file) {
	const parity = JSON.parse(readFileSync(file, 'utf8'));
	const fail = message => { throw new Error(`${file}: ${message}`); };
	for (const key of Object.keys(parity)) {
		if (!FILE_KEYS.has(key)) fail(`unknown key "${key}"`);
	}
	for (const [gapId, gap] of Object.entries(parity.expected_failures ?? {})) {
		for (const key of Object.keys(gap)) {
			if (!GAP_KEYS.has(key)) fail(`gap "${gapId}" has unknown key "${key}"`);
		}
		for (const key of ['actual', 'expected']) {
			if (typeof gap[key] !== 'string' || gap[key] === '') fail(`gap "${gapId}" needs "${key}"`);
		}
		if (gap.why !== undefined && typeof gap.why !== 'string') fail(`gap "${gapId}" has a non-string "why"`);
		if (gap.intentional !== undefined && typeof gap.intentional !== 'boolean') fail(`gap "${gapId}" has a non-boolean "intentional"`);
		if (!Array.isArray(gap.tests) || gap.tests.length === 0) fail(`gap "${gapId}" needs non-empty "tests"`);
		for (const id of gap.tests) {
			if (typeof id !== 'string' || !TEST_ID_RE.test(id)) fail(`gap "${gapId}" registers "${id}", which is no catalog test id`);
		}
	}
	return parity;
}

// Only a missing file means no registrations; a malformed one, one that breaks
// the schema, or an unresolvable `extends` throws.
export function loadParity(parityPath) {
	const overlay = existsSync(parityPath) ? readParityFile(parityPath) : {};
	const base = overlay.extends ? readParityFile(createRequire(parityPath).resolve(overlay.extends)) : {};
	const gaps = { ...base.expected_failures, ...overlay.expected_failures };
	for (const gapId of overlay.expected_passes ?? []) {
		if (!base.expected_failures?.[gapId]) throw new Error(`${parityPath}: expected_passes names "${gapId}", which the base doesn't register`);
		delete gaps[gapId];
	}

	const gapForId = new Map();
	for (const [gapId, gap] of Object.entries(gaps)) {
		for (const id of gap.tests) {
			if (gapForId.has(id)) throw new Error(`${parityPath}: ${id} is registered under both "${gapForId.get(id)}" and "${gapId}"`);
			gapForId.set(id, gapId);
		}
	}
	return { gaps, gapForId };
}

// A test falls under its own id's registration, else its bare id's: a bare
// registration gates every `:row`. A registration with any failing test is an
// active gap: its failures are expected and its passing cases plain passes.
// One whose every test passed is an unexpected pass. On a full run, a
// registration no test passed or failed is orphaned. Any state but
// passed/failed counts as skipped. A catalog test with no single id is
// untagged: nothing could register or cover it.
export function classifyResults(gapForId, results, { fullRun }) {
	const tests = results.map(r => {
		const id = testCatalogId(r.fullName);
		const registration = !id ? undefined
			: gapForId.has(id) ? id
			: gapForId.has(baseCatalogId(id)) ? baseCatalogId(id)
			: undefined;
		return { ...r, id, registration, gapId: registration && gapForId.get(registration) };
	});
	const idStats = new Map();
	for (const t of tests) {
		if (!t.registration || (t.state !== 'passed' && t.state !== 'failed')) continue;
		const stats = idStats.get(t.registration) ?? { gapId: t.gapId, passed: 0, failed: 0 };
		stats[t.state]++;
		idStats.set(t.registration, stats);
	}

	const classified = { passed: [], expected: [], failed: [], unexpectedPasses: [], skipped: [], untagged: [], orphans: [], idStats };
	for (const t of tests) {
		if (!t.id && isCatalogTestFile(t.file)) classified.untagged.push(t);
		const stats = t.registration ? idStats.get(t.registration) : undefined;
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
