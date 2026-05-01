/**
 * CI helper: merge vitest shard JSON reports into one report per adapter,
 * then emit a per-adapter summary table to $GITHUB_STEP_SUMMARY.
 *
 * Expects the artifacts layout produced by actions/download-artifact with
 * pattern=reports-*:
 *
 *   <artifacts-dir>/
 *     reports-vanilla-1/vanilla.json
 *     reports-vanilla-2/vanilla.json
 *     reports-xxscreeps-1/xxscreeps.json
 *     ...
 *
 * Writes merged files to ./reports/<adapter>.json and appends a markdown
 * table (or writes to stdout when GITHUB_STEP_SUMMARY is unset).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, appendFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptsDir, '..');
const adaptersDir = path.join(packageRoot, 'adapters');
const reportsOutDir = path.join(packageRoot, 'reports');

const CATALOG_ID_RE = /\b([A-Z]+-(?:[A-Z]+-)?[0-9]{3}(?::[a-zA-Z]+)?)\b/;

function parseArgs(argv) {
	const args = { artifactsDir: '.' };
	for (const a of argv) {
		if (a.startsWith('--artifacts-dir=')) args.artifactsDir = a.slice('--artifacts-dir='.length);
	}
	return args;
}

function collectShardFiles(artifactsDir) {
	const byAdapter = new Map();
	for (const entry of readdirSync(artifactsDir, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const match = entry.name.match(/^reports-(.+)-(\d+)$/);
		if (!match) continue;
		const [, adapter] = match;
		const jsonPath = path.join(artifactsDir, entry.name, `${adapter}.json`);
		if (!existsSync(jsonPath)) continue;
		(byAdapter.get(adapter) ?? byAdapter.set(adapter, []).get(adapter)).push(jsonPath);
	}
	return byAdapter;
}

function mergeShardReports(paths) {
	const merged = {
		testResults: [],
		numTotalTestSuites: 0,
		numPassedTestSuites: 0,
		numFailedTestSuites: 0,
		numPendingTestSuites: 0,
		numTotalTests: 0,
		numPassedTests: 0,
		numFailedTests: 0,
		numPendingTests: 0,
		startTime: Infinity,
		success: true,
	};
	for (const p of paths) {
		const r = JSON.parse(readFileSync(p, 'utf8'));
		merged.testResults.push(...(r.testResults ?? []));
		merged.numTotalTestSuites += r.numTotalTestSuites ?? 0;
		merged.numPassedTestSuites += r.numPassedTestSuites ?? 0;
		merged.numFailedTestSuites += r.numFailedTestSuites ?? 0;
		merged.numPendingTestSuites += r.numPendingTestSuites ?? 0;
		merged.numTotalTests += r.numTotalTests ?? 0;
		merged.numPassedTests += r.numPassedTests ?? 0;
		merged.numFailedTests += r.numFailedTests ?? 0;
		merged.numPendingTests += r.numPendingTests ?? 0;
		if (typeof r.startTime === 'number') merged.startTime = Math.min(merged.startTime, r.startTime);
		merged.success &&= r.success !== false;
	}
	if (!isFinite(merged.startTime)) merged.startTime = Date.now();
	return merged;
}

function loadParity(adapter) {
	const p = path.join(adaptersDir, adapter, 'parity.json');
	if (!existsSync(p)) return { expected_failures: {} };
	return JSON.parse(readFileSync(p, 'utf8'));
}

function extractCatalogId(fullName) {
	const m = fullName.match(CATALOG_ID_RE);
	return m ? m[1] : null;
}

function summarize(report, parity) {
	const idToGap = new Map();
	for (const [gapId, gap] of Object.entries(parity.expected_failures ?? {})) {
		for (const id of gap.tests ?? []) idToGap.set(id, gapId);
	}
	let passed = 0, expectedFail = 0, unexpectedFail = 0, unexpectedPass = 0, skipped = 0;

	const all = [];
	for (const file of report.testResults ?? []) {
		for (const a of file.assertionResults ?? []) {
			all.push(a);
		}
	}

	// Matrix tests can have one catalog ID with both passing and failing cases.
	// Classify the ID as an active gap if any case failed; only all-pass IDs are
	// unexpected passes.
	const idHasFailure = new Map();
	for (const a of all) {
		if (a.status !== 'passed' && a.status !== 'failed') continue;
		const catalogId = extractCatalogId(a.fullName);
		if (!catalogId || !idToGap.has(catalogId)) continue;
		if (a.status === 'failed') idHasFailure.set(catalogId, true);
		else if (!idHasFailure.has(catalogId)) idHasFailure.set(catalogId, false);
	}

	for (const a of all) {
		if (['skipped', 'pending', 'todo'].includes(a.status)) { skipped++; continue; }
		const catalogId = extractCatalogId(a.fullName);
		const gap = catalogId ? idToGap.get(catalogId) : null;
		if (gap) {
			const gapActive = idHasFailure.get(catalogId) === true;
			if (gapActive) {
				if (a.status === 'failed') expectedFail++;
				else if (a.status === 'passed') passed++;
			} else if (a.status === 'passed') {
				unexpectedPass++;
			} else if (a.status === 'failed') {
				unexpectedFail++;
			}
		} else if (a.status === 'passed') {
			passed++;
		} else if (a.status === 'failed') {
			unexpectedFail++;
		}
	}
	return { passed, expectedFail, unexpectedFail, unexpectedPass, skipped };
}

function statusIcon(s) {
	if (s.unexpectedFail > 0 || s.unexpectedPass > 0) return '🔴';
	if (s.expectedFail > 0) return '🟡';
	return '🟢';
}

function renderTable(rows) {
	const lines = [
		'| | Adapter | Passed | Expected-fail | Unexpected | Skipped |',
		'| :-: | --- | --: | --: | --: | --: |',
	];
	for (const { adapter, summary: s } of rows) {
		const unexpected = s.unexpectedFail + s.unexpectedPass;
		lines.push(`| ${statusIcon(s)} | **${adapter}** | ${s.passed} | ${s.expectedFail || '—'} | ${unexpected || '—'} | ${s.skipped || '—'} |`);
	}
	lines.push('');
	lines.push('🟢 fully passing · 🟡 failures are all registered parity gaps · 🔴 unexpected failures or passes');
	return lines.join('\n');
}

function main() {
	const { artifactsDir } = parseArgs(process.argv.slice(2));
	const absArtifacts = path.resolve(artifactsDir);
	if (!existsSync(absArtifacts) || !statSync(absArtifacts).isDirectory()) {
		throw new Error(`artifacts dir not found: ${absArtifacts}`);
	}

	mkdirSync(reportsOutDir, { recursive: true });
	const shards = collectShardFiles(absArtifacts);
	const rows = [];
	for (const [adapter, files] of [...shards.entries()].sort()) {
		const merged = mergeShardReports(files);
		const out = path.join(reportsOutDir, `${adapter}.json`);
		writeFileSync(out, JSON.stringify(merged));
		console.log(`merged ${files.length} shard(s) → ${path.relative(packageRoot, out)}`);
		const summary = summarize(merged, loadParity(adapter));
		rows.push({ adapter, summary });
	}

	const table = renderTable(rows);
	const stepSummaryPath = process.env.GITHUB_STEP_SUMMARY;
	if (stepSummaryPath) {
		appendFileSync(stepSummaryPath, `## Test results\n\n${table}\n`);
	} else {
		console.log(`\n${table}`);
	}

	const genuineFail = rows.some(r => r.summary.unexpectedFail > 0 || r.summary.unexpectedPass > 0);
	process.exit(genuineFail ? 1 : 0);
}

main();
