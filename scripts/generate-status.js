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
			expectedFailureByGap: {}, passingTests: [], skippedTests: [],
			failingTests: [], unexpectedPasses: [],
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
	const skippedTests = all.filter(
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
		skipped: skippedTests.length,
		expectedFailureByGap,
		passingTests: genuinePasses,
		skippedTests,
		failingTests: genuineFailures,
		unexpectedPasses,
		loaded: true,
	};
}

function relativeFile(abs) {
	if (!abs) return '';
	const prefix = packageRoot + path.sep;
	return abs.startsWith(prefix) ? abs.slice(prefix.length) : abs;
}

function groupTestsByFile(tests) {
	const byFile = new Map();
	for (const t of tests) {
		const file = relativeFile(t.file);
		if (!byFile.has(file)) byFile.set(file, []);
		byFile.get(file).push(t);
	}
	return [...byFile.entries()].sort(([a], [b]) => a.localeCompare(b));
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
	if (!isAdapterOk(summary)) return '🔴';
	return summary.expectedFailure > 0 ? '🟡' : '🟢';
}

function shieldBadge(label, message, color) {
	const enc = s => encodeURIComponent(s).replace(/-/g, '--').replace(/_/g, '__');
	return `https://img.shields.io/badge/${enc(label)}-${enc(message)}-${color}`;
}

function slug(text) {
	// GitHub's heading anchor algorithm: lowercase, drop punctuation, spaces → dashes
	return text
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, '')
		.trim()
		.replace(/\s+/g, '-');
}

function renderHeaderBadges(summaries) {
	// One green "N passing" badge per adapter plus a yellow "N expected-fail"
	// badge for each adapter that has any. Two separate badges so the visual
	// signal for "fully passing" is distinct from "passing with known gaps".
	const badges = [];
	for (const [adapter, data] of Object.entries(summaries)) {
		const s = data.summary;
		if (!s.loaded) {
			badges.push(`![${adapter}](${shieldBadge(adapter, 'no report', 'lightgrey')})`);
			continue;
		}
		if (s.failed > 0 || s.unexpectedPasses.length > 0) {
			badges.push(`![${adapter}](${shieldBadge(adapter, `${s.failed || s.unexpectedPasses.length} failing`, 'red')})`);
			continue;
		}
		badges.push(`![${adapter}](${shieldBadge(adapter, `${s.passed} passing`, 'brightgreen')})`);
		if (s.expectedFailure > 0) {
			badges.push(`![${adapter} expected-fail](${shieldBadge(`${adapter} expected-fail`, `${s.expectedFailure}`, 'yellow')})`);
		}
	}
	return badges.join(' ');
}

function countCell(count, anchor) {
	if (count === 0) return '—';
	if (!anchor) return `${count}`;
	return `[${count}](#${anchor})`;
}

function renderAdapterRow(adapter, report, summary) {
	if (!summary.loaded) {
		return `| ⚪ | **${adapter}** | — | — | — | — | _no report_ |`;
	}
	const icon = adapterStatusIcon(summary);
	const passCell = countCell(summary.passed, slug(`${adapter} passing tests`));
	const expectedCell = countCell(
		summary.expectedFailure,
		summary.expectedFailure > 0 ? slug(`${adapter} expected failures`) : null,
	);
	const skippedCell = countCell(
		summary.skipped,
		summary.skipped > 0 ? slug(`${adapter} skipped tests`) : null,
	);
	const failedCell = summary.failed > 0
		? `[${summary.failed}](#${slug(`${adapter} unexpected failures`)})`
		: '—';
	return `| ${icon} | **${adapter}** | ${passCell} | ${expectedCell} | ${failedCell} | ${skippedCell} | ${formatTimestamp(report)} |`;
}

function renderGapDetails(gapId, canonicalSummary, adapter, parityNote) {
	const lines = [];
	lines.push('<details>');
	lines.push(`<summary><strong><code>${gapId}</code></strong> — ${canonicalSummary}</summary>`);
	lines.push('');
	const testCount = adapter.tests.length;
	lines.push(`${testCount} test${testCount === 1 ? '' : 's'} affected:`);
	lines.push('');
	for (const testName of adapter.tests) {
		lines.push(`- \`${stripGapPrefix(testName)}\``);
	}
	if (parityNote) {
		lines.push('');
		lines.push(`> ${parityNote}`);
	}
	lines.push('');
	lines.push('</details>');
	return lines.join('\n');
}

function renderPerAdapterExpectedFailures(adapterName, data, canonicalSummaries) {
	const lines = [];
	const parity = data.parity;
	const summary = data.summary;
	const declaredGaps = parity.expected_failures ?? [];
	if (declaredGaps.length === 0) return '';

	const totalTests = declaredGaps.reduce(
		(n, gapId) => n + (summary.expectedFailureByGap?.[gapId]?.length ?? 0),
		0,
	);

	lines.push(`## ${adapterName} expected failures`);
	lines.push('');
	lines.push(`${adapterName} currently declares ${declaredGaps.length} parity gap${declaredGaps.length === 1 ? '' : 's'} against vanilla's canonical behavior, covering ${totalTests} test${totalTests === 1 ? '' : 's'}. Each gap is verified by a test that continues to run as a regression trap — if ${adapterName} fixes the behavior upstream the test will flip from expected-failure to unexpected-pass.`);
	lines.push('');

	for (const gapId of declaredGaps) {
		const canonicalSummary = canonicalSummaries[gapId] ?? '(unknown gap — check parity.json)';
		const tests = (summary.expectedFailureByGap?.[gapId] ?? []).map(t => t.fullName);
		lines.push(renderGapDetails(
			gapId,
			canonicalSummary,
			{ tests },
			parity.notes?.[gapId] ?? '',
		));
		lines.push('');
	}

	return lines.join('\n');
}

function renderTestListByFile(heading, tests, emptyMessage) {
	const lines = [];
	lines.push(`## ${heading}`);
	lines.push('');
	if (tests.length === 0) {
		lines.push(emptyMessage);
		lines.push('');
		return lines.join('\n');
	}
	const byFile = groupTestsByFile(tests);
	lines.push('<details>');
	lines.push(`<summary>${tests.length} test${tests.length === 1 ? '' : 's'} across ${byFile.length} file${byFile.length === 1 ? '' : 's'}</summary>`);
	lines.push('');
	for (const [file, fileTests] of byFile) {
		lines.push(`**\`${file}\`** (${fileTests.length})`);
		lines.push('');
		for (const t of fileTests) {
			lines.push(`- ${stripGapPrefix(t.fullName)}`);
		}
		lines.push('');
	}
	lines.push('</details>');
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
	lines.push('> [!NOTE]');
	lines.push('> This page is generated from the latest vitest run for each adapter');
	lines.push('> plus each adapter\'s `parity.json` companion file. Regenerate locally');
	lines.push('> with `npm run status:refresh`. See [`docs/style.md`](style.md) for');
	lines.push('> the icon and color vocabulary used below.');
	lines.push('');

	// Adapter table with clickable count cells
	lines.push('## Adapters');
	lines.push('');
	lines.push('| | Adapter | Passed | Expected-fail | Failed | Skipped | Last run |');
	lines.push('| :-: | --- | --: | --: | --: | --: | --- |');
	for (const [adapter, data] of Object.entries(summaries)) {
		lines.push(renderAdapterRow(adapter, data.report, data.summary));
	}
	lines.push('');
	lines.push('🟢 fully passing · 🟡 all failing tests are registered parity gaps · 🔴 unexpected failures');
	lines.push('');
	lines.push('_Click any count to jump to the test list. Timestamps in UTC — GitHub markdown cannot render browser-local time._');
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
			lines.push('');
			for (const t of data.summary.unexpectedPasses) {
				lines.push(`- \`${stripGapPrefix(t.fullName)}\``);
			}
			lines.push('');
		}
	}

	// Unexpected failures — only renders when present, one subsection per adapter
	for (const [adapter, data] of Object.entries(summaries)) {
		if (data.summary.failed === 0) continue;
		lines.push(`## ${adapter} unexpected failures`);
		lines.push('');
		for (const t of data.summary.failingTests) {
			lines.push(`- \`${stripGapPrefix(t.fullName)}\``);
		}
		lines.push('');
	}

	// Expected failures grouped per adapter (each adapter gets its own section)
	for (const [adapter, data] of Object.entries(summaries)) {
		const block = renderPerAdapterExpectedFailures(adapter, data, canonicalSummaries);
		if (block) {
			lines.push(block);
			lines.push('');
		}
	}

	// Per-adapter drill-downs: passing tests and skipped tests
	for (const [adapter, data] of Object.entries(summaries)) {
		const s = data.summary;
		if (!s.loaded) continue;
		if (s.skipped > 0) {
			lines.push(renderTestListByFile(
				`${adapter} skipped tests`,
				s.skippedTests,
				'_none_',
			));
			lines.push('');
		}
		lines.push(renderTestListByFile(
			`${adapter} passing tests`,
			s.passingTests,
			'_none_',
		));
		lines.push('');
	}

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
