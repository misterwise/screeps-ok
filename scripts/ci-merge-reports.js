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
import { judgeReport, loadParity, verdictIsClean } from './lib/parity.js';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptsDir, '..');
const adaptersDir = path.join(packageRoot, 'adapters');
const reportsOutDir = path.join(packageRoot, 'reports');


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

// The runner's reading of the merged shards; shards merge into the full run, so orphans count.
function summarize(report, parity) {
	const { classified, fileErrors, verdict } = judgeReport(report, parity);
	return {
		passed: classified.passed.length,
		expectedFail: verdict.expectedFailures,
		unexpected: verdict.genuineFailures + verdict.unexpectedPasses + verdict.untaggedTests,
		skipped: classified.skipped.length,
		orphaned: classified.orphans,
		fileErrors,
		untagged: classified.untagged,
		clean: verdictIsClean(verdict),
	};
}

function statusIcon(s) {
	if (!s.clean) return '🔴';
	if (s.expectedFail > 0) return '🟡';
	return '🟢';
}

function renderTable(rows) {
	const lines = [
		'| | Adapter | Passed | Expected-fail | Unexpected | Skipped |',
		'| :-: | --- | --: | --: | --: | --: |',
	];
	for (const { adapter, summary: s } of rows) {
		lines.push(`| ${statusIcon(s)} | **${adapter}** | ${s.passed} | ${s.expectedFail || '—'} | ${s.unexpected || '—'} | ${s.skipped || '—'} |`);
	}
	lines.push('');
	lines.push('🟢 fully passing · 🟡 failures are all registered parity gaps · 🔴 unexpected failures or passes, orphaned registrations, or tests without an id');
	for (const { adapter, summary: s } of rows) {
		for (const e of s.fileErrors) {
			lines.push('', `**${adapter}** \`${path.relative(packageRoot, e.file)}\` failed outside its tests: ${e.message.split('\n')[0]}`);
		}
		for (const t of s.untagged) {
			lines.push('', `**${adapter}** \`${t.fullName}\` carries no single catalog id`);
		}
		if (s.orphaned.length > 0) {
			lines.push('', `**${adapter}** registrations that matched no test that ran: ${s.orphaned.map(id => `\`${id}\``).join(', ')}`);
		}
	}
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
		const summary = summarize(merged, loadParity(path.join(adaptersDir, adapter, 'parity.json')));
		rows.push({ adapter, summary });
	}

	const table = renderTable(rows);
	const stepSummaryPath = process.env.GITHUB_STEP_SUMMARY;
	if (stepSummaryPath) {
		appendFileSync(stepSummaryPath, `## Test results\n\n${table}\n`);
	} else {
		console.log(`\n${table}`);
	}

	process.exit(rows.some(r => !r.summary.clean) ? 1 : 0);
}

main();
