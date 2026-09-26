/**
 * CI helper: merge each adapter's shard reports (scripts/lib/shards.js) into
 * ./reports/<adapter>.json, judge each merge as a full run, and write a
 * summary table to $GITHUB_STEP_SUMMARY (stdout when unset). A shard that
 * wrote no report fails the merge.
 *
 *   node scripts/ci-merge-reports.js --adapters=xxscreeps,vanilla --shards=4 --artifacts-dir=downloaded
 */
import { writeFileSync, existsSync, mkdirSync, appendFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { suitePath } from './lib/catalog-id.js';
import { judgeReport, loadParity, verdictIsClean } from './lib/parity.js';
import { collectShards, mergeShardReports } from './lib/shards.js';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptsDir, '..');
const adaptersDir = path.join(packageRoot, 'adapters');
const reportsOutDir = path.join(packageRoot, 'reports');

// The matrix CI ran: each adapter in `shards` shards.
function parseArgs(argv) {
	const args = { artifactsDir: '.', adapters: [], shards: 0 };
	for (const a of argv) {
		if (a.startsWith('--artifacts-dir=')) args.artifactsDir = a.slice('--artifacts-dir='.length);
		else if (a.startsWith('--adapters=')) args.adapters = a.slice('--adapters='.length).split(',').filter(Boolean);
		else if (a.startsWith('--shards=')) args.shards = Number(a.slice('--shards='.length));
		else throw new Error(`unknown argument ${a}`);
	}
	if (args.adapters.length === 0 || !Number.isInteger(args.shards) || args.shards < 1) {
		throw new Error('usage: ci-merge-reports.js --adapters=<a,b> --shards=<n> [--artifacts-dir=<dir>]');
	}
	return args;
}

// The runner's reading of the merged shards; shards merge into the full run, so orphans count.
function summarize(report, parity, missingShards) {
	const { classified, fileErrors, verdict } = judgeReport(report, parity);
	return {
		missingShards,
		passed: classified.passed.length,
		expectedFail: verdict.expectedFailures,
		unexpected: verdict.genuineFailures + verdict.unexpectedPasses + verdict.untaggedTests,
		skipped: classified.skipped.length,
		orphaned: classified.orphans,
		fileErrors,
		untagged: classified.untagged,
		clean: verdictIsClean(verdict) && missingShards.length === 0,
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
	lines.push('🟢 fully passing · 🟡 failures are all registered parity gaps · 🔴 unexpected failures or passes, orphaned registrations, tests without an id, or shards that wrote no report');
	for (const { adapter, summary: s } of rows) {
		if (s.missingShards.length > 0) {
			lines.push('', `**${adapter}** shard(s) ${s.missingShards.join(', ')} wrote no report: their tests never ran`);
		}
		for (const e of s.fileErrors) {
			lines.push('', `**${adapter}** \`${suitePath(e.file)}\` failed outside its tests: ${e.message.split('\n')[0]}`);
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
	const { artifactsDir, adapters, shards } = parseArgs(process.argv.slice(2));
	const absArtifacts = path.resolve(artifactsDir);
	if (!existsSync(absArtifacts) || !statSync(absArtifacts).isDirectory()) {
		throw new Error(`artifacts dir not found: ${absArtifacts}`);
	}

	mkdirSync(reportsOutDir, { recursive: true });
	const rows = [];
	for (const adapter of adapters) {
		const { found, missing } = collectShards(absArtifacts, adapter, shards);
		const merged = mergeShardReports(found);
		const out = path.join(reportsOutDir, `${adapter}.json`);
		writeFileSync(out, JSON.stringify(merged));
		console.log(`merged ${found.length} of ${shards} shard(s) → ${path.relative(packageRoot, out)}`);
		const summary = summarize(merged, loadParity(path.join(adaptersDir, adapter, 'parity.json')), missing);
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
