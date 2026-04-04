/**
 * Reads the latest per-adapter vitest JSON reports and each adapter's
 * parity.json companion file, then writes a Markdown status dashboard to
 * docs/status.md.
 *
 * The dashboard is the reviewer-facing answer to "what's the current state
 * of the suite?" — canonical vanilla baseline, known parity gaps, per-
 * adapter breakdown. It is a generated artifact: re-run whenever reports
 * or parity.json files change.
 *
 * Usage:
 *   npm run parity       # produces reports/<adapter>.json
 *   npm run status       # reads reports + parity.json, writes docs/status.md
 *   npm run status:refresh   # does both in one step
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptsDir, '..');
const reportsDir = path.join(packageRoot, 'reports');
const adaptersDir = path.join(packageRoot, 'adapters');
const outputPath = path.join(packageRoot, 'docs/status.md');

// Built-in adapters whose reports feed the dashboard by default. Downstream
// adapters can reuse this script by passing their own adapter name on the
// command line (see CLI block at the bottom).
const DEFAULT_ADAPTERS = ['vanilla', 'xxscreeps'];
const KNOWN_GAP_PREFIX = '[known-gap:';

function loadCanonicalGapSummaries() {
	// Parse the canonical gap list out of tests/support/parity-gaps.ts without
	// importing it — the script is plain JS and the TS file holds the table
	// as a well-formed `as const` literal.
	const source = readFileSync(
		path.join(packageRoot, 'tests/support/parity-gaps.ts'),
		'utf8',
	);
	const match = source.match(/export const PARITY_GAPS = \{([\s\S]*?)\} as const;/);
	if (!match) {
		throw new Error('generate-status: could not locate PARITY_GAPS in parity-gaps.ts');
	}
	const body = match[1];
	const entries = {};
	const entryRegex = /'([^']+)':\s*((?:'[^']*'(?:\s*\+\s*'[^']*')*))/g;
	let entry;
	while ((entry = entryRegex.exec(body)) !== null) {
		const id = entry[1];
		// Rebuild concatenated string literal.
		const pieces = [...entry[2].matchAll(/'([^']*)'/g)].map(p => p[1]);
		entries[id] = pieces.join('');
	}
	return entries;
}

function loadReport(adapter) {
	const reportPath = path.join(reportsDir, `${adapter}.json`);
	if (!existsSync(reportPath)) return null;
	return JSON.parse(readFileSync(reportPath, 'utf8'));
}

function loadParityFile(adapter) {
	const parityPath = path.join(adaptersDir, adapter, 'parity.json');
	if (!existsSync(parityPath)) return { expected_failures: [], notes: {} };
	return JSON.parse(readFileSync(parityPath, 'utf8'));
}

function parseGapFromTitle(fullName) {
	const start = fullName.indexOf(KNOWN_GAP_PREFIX);
	if (start < 0) return null;
	const end = fullName.indexOf(']', start + KNOWN_GAP_PREFIX.length);
	if (end < 0) return null;
	return fullName.slice(start + KNOWN_GAP_PREFIX.length, end);
}

function summarizeReport(report) {
	if (!report) {
		return {
			total: 0, passed: 0, expectedFailure: 0, failed: 0, skipped: 0,
			expectedFailureByGap: {}, failingTests: [], unexpectedPasses: [],
			loaded: false,
		};
	}

	const all = report.testResults.flatMap(f =>
		f.assertionResults.map(a => ({ file: f.name, ...a })),
	);

	const expectedFailure = all.filter(
		a => a.status === 'passed' && a.fullName.includes(KNOWN_GAP_PREFIX),
	);
	const unexpectedPasses = all.filter(
		a => a.status === 'failed' &&
			a.fullName.includes(KNOWN_GAP_PREFIX) &&
			a.failureMessages?.some(m => m.includes('Expect test to fail')),
	);
	const genuinePasses = all.filter(
		a => a.status === 'passed' && !a.fullName.includes(KNOWN_GAP_PREFIX),
	);
	const genuineFailures = all.filter(
		a => a.status === 'failed' && !unexpectedPasses.includes(a),
	);
	const skipped = all.filter(
		a => a.status === 'skipped' || a.status === 'pending' || a.status === 'todo',
	);

	const expectedFailureByGap = {};
	for (const a of expectedFailure) {
		const gap = parseGapFromTitle(a.fullName);
		if (!gap) continue;
		(expectedFailureByGap[gap] ??= []).push(a);
	}

	return {
		total: all.length,
		passed: genuinePasses.length,
		expectedFailure: expectedFailure.length,
		failed: genuineFailures.length,
		skipped: skipped.length,
		expectedFailureByGap,
		failingTests: genuineFailures,
		unexpectedPasses,
		loaded: true,
	};
}

function formatTimestamp(report) {
	if (!report?.startTime) return 'never';
	// Produce "YYYY-MM-DD HH:MM UTC" without the seconds noise.
	const iso = new Date(report.startTime).toISOString();
	return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

function stripGapPrefix(fullName) {
	return fullName.replace(/.*?\[known-gap:[^\]]+\]\s*/, '');
}

function isAdapterOk(summary) {
	return summary.failed === 0 && summary.unexpectedPasses.length === 0;
}

function adapterStatusIcon(summary) {
	if (!summary.loaded) return '⚪';
	return isAdapterOk(summary) ? '🟢' : '🔴';
}

function shieldBadge(label, message, color) {
	const enc = s => encodeURIComponent(s).replace(/-/g, '--').replace(/_/g, '__');
	return `https://img.shields.io/badge/${enc(label)}-${enc(message)}-${color}`;
}

function renderHeaderBadges(summaries) {
	const badges = [];
	for (const [adapter, data] of Object.entries(summaries)) {
		const s = data.summary;
		if (!s.loaded) {
			badges.push(`![${adapter}](${shieldBadge(adapter, 'no report', 'lightgrey')})`);
			continue;
		}
		const ok = isAdapterOk(s);
		const color = !ok ? 'red' : s.expectedFailure > 0 ? 'green' : 'brightgreen';
		const msg = !ok
			? `${s.failed} failing`
			: s.expectedFailure > 0
				? `${s.passed} passing, ${s.expectedFailure} expected-fail`
				: `${s.passed} passing`;
		badges.push(`![${adapter}](${shieldBadge(adapter, msg, color)})`);
	}
	return badges.join(' ');
}

function renderAdapterRow(adapter, report, summary) {
	if (!summary.loaded) {
		return `| ⚪ | **${adapter}** | — | — | — | — | _no report_ |`;
	}
	const icon = adapterStatusIcon(summary);
	return `| ${icon} | **${adapter}** | ${summary.passed} | ${summary.expectedFailure} | ${summary.failed} | ${summary.skipped} | ${formatTimestamp(report)} |`;
}

function renderGapDetails(gapId, row) {
	const lines = [];
	const adapterNames = row.adapters.map(a => a.name).join(', ');
	lines.push(`<details>`);
	lines.push(`<summary><strong><code>${gapId}</code></strong> — ${row.summary} <em>(${adapterNames})</em></summary>`);
	lines.push('');
	for (const adapter of row.adapters) {
		const testCount = adapter.tests.length;
		lines.push(`**${adapter.name}** — ${testCount} test${testCount === 1 ? '' : 's'}`);
		lines.push('');
		if (testCount > 0) {
			for (const testName of adapter.tests) {
				lines.push(`- \`${stripGapPrefix(testName)}\``);
			}
			lines.push('');
		}
		if (adapter.note) {
			lines.push(`> ${adapter.note}`);
			lines.push('');
		}
	}
	lines.push(`</details>`);
	return lines.join('\n');
}

function renderParityGapSection(summaries, canonicalSummaries) {
	const gapRows = {};
	for (const gapId of Object.keys(canonicalSummaries)) {
		gapRows[gapId] = { summary: canonicalSummaries[gapId], adapters: [] };
	}

	for (const [adapterName, { parity, summary }] of Object.entries(summaries)) {
		for (const gapId of parity.expected_failures ?? []) {
			if (!gapRows[gapId]) {
				gapRows[gapId] = { summary: '(unknown gap — check parity.json)', adapters: [] };
			}
			const tests = (summary.expectedFailureByGap?.[gapId] ?? []).map(t => t.fullName);
			gapRows[gapId].adapters.push({
				name: adapterName,
				tests,
				note: parity.notes?.[gapId] ?? '',
			});
		}
	}

	const unusedGaps = Object.entries(gapRows).filter(([, row]) => row.adapters.length === 0);
	const activeGaps = Object.entries(gapRows).filter(([, row]) => row.adapters.length > 0);

	const lines = [];
	if (activeGaps.length === 0) {
		lines.push('_No adapter currently declares any expected failures._');
		lines.push('');
	} else {
		for (const [gapId, row] of activeGaps) {
			lines.push(renderGapDetails(gapId, row));
			lines.push('');
		}
	}

	if (unusedGaps.length > 0) {
		lines.push('<details>');
		lines.push(`<summary>${unusedGaps.length} registered gap${unusedGaps.length === 1 ? '' : 's'} not currently exhibited by any adapter</summary>`);
		lines.push('');
		for (const [gapId, row] of unusedGaps) {
			lines.push(`- \`${gapId}\` — ${row.summary}`);
		}
		lines.push('');
		lines.push('</details>');
		lines.push('');
	}

	return lines.join('\n');
}

function render(summaries, canonicalSummaries) {
	const lines = [];
	lines.push('<!-- Auto-generated by scripts/generate-status.js. Do not edit by hand. -->');
	lines.push('');
	lines.push('# screeps-ok status');
	lines.push('');
	lines.push('> _If your engine agrees, it\'s Screeps._');
	lines.push('');
	lines.push(renderHeaderBadges(summaries));
	lines.push('');

	// Adapter table
	lines.push('## Adapters');
	lines.push('');
	lines.push('| | Adapter | Passed | Expected-fail | Failed | Skipped | Last run |');
	lines.push('| :-: | --- | --: | --: | --: | --: | --- |');
	for (const [adapter, data] of Object.entries(summaries)) {
		lines.push(renderAdapterRow(adapter, data.report, data.summary));
	}
	lines.push('');
	lines.push('🟢 all failing tests are registered parity gaps · 🔴 unexpected failures or unexpected passes · **expected-fail** tests stay live as regression traps');
	lines.push('');

	// Unexpected passes section — only renders when triggered
	const unexpectedAdapters = Object.entries(summaries).filter(
		([, d]) => d.summary.unexpectedPasses.length > 0,
	);
	if (unexpectedAdapters.length > 0) {
		lines.push('## 🚨 Regression traps triggered');
		lines.push('');
		lines.push('Tests tagged as known parity gaps have started passing. Investigate and drop the gap from the adapter\'s `parity.json` if the engine has fixed the behavior.');
		lines.push('');
		for (const [adapter, data] of unexpectedAdapters) {
			lines.push(`**${adapter}**`);
			for (const t of data.summary.unexpectedPasses) {
				lines.push(`- \`${stripGapPrefix(t.fullName)}\``);
			}
			lines.push('');
		}
	}

	// Unexpected failures — only renders when present
	const failedAdapters = Object.entries(summaries).filter(
		([, d]) => d.summary.failed > 0,
	);
	if (failedAdapters.length > 0) {
		lines.push('## 🚨 Unexpected failures');
		lines.push('');
		for (const [adapter, data] of failedAdapters) {
			lines.push(`**${adapter}**`);
			for (const t of data.summary.failingTests) {
				lines.push(`- \`${stripGapPrefix(t.fullName)}\``);
			}
			lines.push('');
		}
	}

	lines.push('## Parity gaps');
	lines.push('');
	lines.push('Behaviors where at least one adapter disagrees with vanilla. Click a row to expand affected tests and engine-specific notes.');
	lines.push('');
	lines.push(renderParityGapSection(summaries, canonicalSummaries));

	return lines.join('\n') + '\n';
}

function main(argv) {
	const requestedAdapters = argv.length > 0 ? argv : DEFAULT_ADAPTERS;
	const canonicalSummaries = loadCanonicalGapSummaries();

	const summaries = {};
	for (const adapter of requestedAdapters) {
		const report = loadReport(adapter);
		const parity = loadParityFile(adapter);
		const summary = summarizeReport(report);
		summaries[adapter] = { report, parity, summary };
	}

	const output = render(summaries, canonicalSummaries);
	writeFileSync(outputPath, output);
	console.log(`Wrote ${path.relative(packageRoot, outputPath)}`);

	// Print a terse one-line summary per adapter to stdout.
	for (const [adapter, { summary }] of Object.entries(summaries)) {
		if (!summary.loaded) {
			console.log(`  ${adapter}: no report`);
			continue;
		}
		console.log(
			`  ${adapter}: ${summary.passed} passed` +
			(summary.expectedFailure ? `, ${summary.expectedFailure} expected-failure` : '') +
			(summary.failed ? `, ${summary.failed} failed` : '') +
			(summary.skipped ? `, ${summary.skipped} skipped` : ''),
		);
	}
}

main(process.argv.slice(2));
