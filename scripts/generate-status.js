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
 *   npm run parity           # full suite; runs this script (and coverage) at the end
 *   npm run status:refresh   # regenerates status + coverage from existing reports, no tests
 *   npm run status           # this script alone (status.md + README badges)
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { capabilityDescriptions } from './lib/capabilities.js';
import { suitePath } from './lib/catalog-id.js';
import { judgeReport, loadParity } from './lib/parity.js';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptsDir, '..');
const reportsDir = path.join(packageRoot, 'reports');
const adaptersDir = path.join(packageRoot, 'adapters');
const outputPath = path.join(packageRoot, 'docs/status.md');
const readmePath = path.join(packageRoot, 'README.md');
const BADGE_MARKER_RE = /(<!-- BADGES:START -->)[\s\S]*?(<!-- BADGES:END -->)/;

// Built-in adapters whose reports feed the dashboard by default. Downstream
// adapters can reuse this script by passing their own adapter name on the
// command line (see CLI block at the bottom).
const DEFAULT_ADAPTERS = ['vanilla', 'xxscreeps'];

function loadReport(adapter) {
	const reportPath = path.join(reportsDir, `${adapter}.json`);
	if (!existsSync(reportPath)) return null;
	return JSON.parse(readFileSync(reportPath, 'utf8'));
}

function summarizeReport(report, parity) {
	if (!report) {
		return {
			passed: 0, expectedFailure: 0, failed: 0, skipped: 0,
			expectedFailureByGap: {}, passingTests: [], skippedTests: [],
			failingTests: [], unexpectedPasses: [], orphans: [], untagged: [], fileErrors: [],
			loaded: false,
		};
	}

	// The reading the runner's exit applies: an id is an active gap if any of its cases failed.
	const { classified, fileErrors } = judgeReport(report, parity);
	const expectedFailureByGap = {};
	for (const t of classified.expected) {
		(expectedFailureByGap[t.gapId] ??= []).push(t);
	}

	return {
		passed: classified.passed.length,
		expectedFailure: classified.expected.length,
		failed: classified.failed.length,
		skipped: classified.skipped.length,
		expectedFailureByGap,
		passingTests: classified.passed,
		skippedTests: classified.skipped,
		failingTests: classified.failed,
		unexpectedPasses: classified.unexpectedPasses,
		orphans: classified.orphans.map(id => ({ id, gapId: parity.gapForId.get(id) })),
		untagged: classified.untagged,
		fileErrors,
		loaded: true,
	};
}

function groupTestsByFile(tests) {
	const byFile = new Map();
	for (const t of tests) {
		const file = suitePath(t.file);
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


// Everything that fails the runner's exit.
function problemCount(summary) {
	return summary.failed + summary.fileErrors.length + summary.unexpectedPasses.length
		+ summary.orphans.length + summary.untagged.length;
}

function isAdapterOk(summary) {
	return problemCount(summary) === 0;
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

// statusHref is the path from the rendering doc to status.md ('' when rendering status.md itself).
function renderHeaderBadges(summaries, statusHref) {
	// One green "N passing" badge per adapter plus a yellow "N expected-fail"
	// badge for each adapter that has any. Two separate badges so the visual
	// signal for "fully passing" is distinct from "passing with known gaps".
	const badges = [];
	const linkTo = (anchor) => `${statusHref}#${anchor}`;
	for (const [adapter, data] of Object.entries(summaries)) {
		const s = data.summary;
		if (!s.loaded) {
			badges.push(`![${adapter}](${shieldBadge(adapter, 'no report', 'lightgrey')})`);
			continue;
		}
		if (!isAdapterOk(s)) {
			const url = linkTo(slug(`${adapter} unexpected failures`));
			badges.push(`[![${adapter}](${shieldBadge(adapter, `${problemCount(s)} failing`, 'red')})](${url})`);
			continue;
		}
		const passUrl = linkTo(slug(`${adapter} passing tests`));
		badges.push(`[![${adapter}](${shieldBadge(adapter, `${s.passed} passing`, 'brightgreen')})](${passUrl})`);
		if (s.expectedFailure > 0) {
			const efUrl = linkTo(slug(`${adapter} expected failures`));
			badges.push(`[![${adapter} expected-fail](${shieldBadge(`${adapter} expected-fail`, `${s.expectedFailure}`, 'yellow')})](${efUrl})`);
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
	const failedCount = summary.failed + summary.fileErrors.length;
	const failedCell = failedCount > 0
		? `[${failedCount}](#${slug(`${adapter} unexpected failures`)})`
		: '—';
	return `| ${icon} | **${adapter}** | ${passCell} | ${expectedCell} | ${failedCell} | ${skippedCell} | ${formatTimestamp(report)} |`;
}

function gapAnchor(adapterName, gapId) {
	return slug(`${adapterName} gap ${gapId}`);
}

// GFM splits a table row on any unescaped pipe, code spans included.
function cell(text) {
	return text.replace(/\|/g, '\\|');
}

function renderGapTestList(adapterName, gapId, tests) {
	const lines = [];
	const anchor = gapAnchor(adapterName, gapId);
	lines.push(`<details id="${anchor}">`);
	lines.push(`<summary><code>${gapId}</code> — ${tests.length} test${tests.length === 1 ? '' : 's'}</summary>`);
	lines.push('');
	for (const testName of tests) {
		lines.push(`- \`${testName}\``);
	}
	lines.push('');
	lines.push('</details>');
	return lines.join('\n');
}

function renderGapSummaryTable(adapterName, gaps, summary, gapIds) {
	const lines = [];
	lines.push('| Gap | Actual | Vanilla behavior | Why | Tests |');
	lines.push('| --- | --- | --- | --- | :-: |');
	for (const gapId of gapIds) {
		const gap = gaps[gapId];
		const testCount = (summary.expectedFailureByGap?.[gapId] ?? []).length;
		const anchor = gapAnchor(adapterName, gapId);
		const countCell = testCount > 0 ? `[${testCount}](#${anchor})` : `${testCount}`;
		lines.push(`| \`${gapId}\` | ${cell(gap.actual)} | ${cell(gap.expected)} | ${cell(gap.why ?? '')} | ${countCell} |`);
	}
	return lines.join('\n');
}

function renderGapDetails(adapterName, summary, gapIds) {
	const lines = [];
	lines.push('Click a test count above to jump to the affected test list for that gap.');
	lines.push('');
	for (const gapId of gapIds) {
		const tests = (summary.expectedFailureByGap?.[gapId] ?? []).map(t => t.fullName);
		lines.push(renderGapTestList(adapterName, gapId, tests));
		lines.push('');
	}
	return lines.join('\n');
}

const CAPABILITY_DESCRIPTIONS = capabilityDescriptions(path.join(packageRoot, 'src/adapter.ts'));

function describeSkipReason(reason) {
	if (!reason) return { category: 'uncategorized', key: '(no reason)', description: 'Skip reason not recorded' };
	const [category, key] = reason.split(':');
	if (category === 'capability') {
		// capabilityDescriptions() throws for a declared capability with no doc, so an
		// unknown one comes from a report older than the change that dropped it.
		const description = CAPABILITY_DESCRIPTIONS.get(key) ?? 'No longer declared by `AdapterCapabilities`; the next full run drops it';
		return { category, key, description };
	}
	if (category === 'limitation') {
		return { category, key, description: `Documented adapter limitation; see \`src/limitations.ts\`` };
	}
	return { category: 'other', key: reason, description: reason };
}

function renderSkippedSection(adapterName, tests) {
	const lines = [];
	lines.push(`## ${adapterName} skipped tests`);
	lines.push('');
	if (tests.length === 0) {
		lines.push('_none_');
		lines.push('');
		return lines.join('\n');
	}

	const groups = new Map();
	for (const t of tests) {
		const reason = t.meta?.skipReason ?? null;
		const info = describeSkipReason(reason);
		const groupKey = `${info.category}:${info.key}`;
		const entry = groups.get(groupKey) ?? { info, tests: [] };
		entry.tests.push(t);
		groups.set(groupKey, entry);
	}

	const ordered = [...groups.entries()].sort(
		([, a], [, b]) => b.tests.length - a.tests.length,
	);

	lines.push(
		`${adapterName} has ${tests.length} skipped test${tests.length === 1 ? '' : 's'}, grouped by the mechanism that gated them. **Capability** skips mean the adapter declares the feature unsupported in \`capabilities\` (see \`adapters/${adapterName}/index.ts\`). **Limitation** skips come from \`src/limitations.ts\` — features the canonical engine has but this adapter can't surface through the screeps-ok API.`,
	);
	lines.push('');
	lines.push('| Category | Cause | What it means | Tests |');
	lines.push('| --- | --- | --- | :-: |');
	for (const [, { info, tests: reasonTests }] of ordered) {
		const anchor = slug(`${adapterName} skip ${info.category} ${info.key}`);
		const countCell = `[${reasonTests.length}](#${anchor})`;
		lines.push(`| ${info.category} | \`${info.key}\` | ${info.description} | ${countCell} |`);
	}
	lines.push('');
	lines.push('Click a count to jump to the affected test list.');
	lines.push('');

	for (const [, { info, tests: reasonTests }] of ordered) {
		const anchor = slug(`${adapterName} skip ${info.category} ${info.key}`);
		const byFile = groupTestsByFile(reasonTests);
		lines.push(`<details id="${anchor}">`);
		lines.push(
			`<summary><code>${info.category}:${info.key}</code> — ${reasonTests.length} test${reasonTests.length === 1 ? '' : 's'} across ${byFile.length} file${byFile.length === 1 ? '' : 's'}</summary>`,
		);
		lines.push('');
		for (const [file, fileTests] of byFile) {
			lines.push(`**\`${file}\`** (${fileTests.length})`);
			lines.push('');
			for (const t of fileTests) {
				lines.push(`- ${t.fullName}`);
			}
			lines.push('');
		}
		lines.push('</details>');
		lines.push('');
	}

	return lines.join('\n');
}

function renderPerAdapterExpectedFailures(adapterName, data) {
	const lines = [];
	const parity = data.parity;
	const summary = data.summary;
	const gaps = parity.gaps;
	const gapIds = Object.keys(gaps);
	if (gapIds.length === 0) return '';
	const intentionalGapIds = gapIds.filter(gapId => gaps[gapId].intentional);
	const openGapIds = gapIds.filter(gapId => !gaps[gapId].intentional);

	const totalTests = gapIds.reduce(
		(n, gapId) => n + (summary.expectedFailureByGap?.[gapId]?.length ?? 0),
		0,
	);
	const intentionalTests = intentionalGapIds.reduce(
		(n, gapId) => n + (summary.expectedFailureByGap?.[gapId]?.length ?? 0),
		0,
	);
	const openTests = openGapIds.reduce(
		(n, gapId) => n + (summary.expectedFailureByGap?.[gapId]?.length ?? 0),
		0,
	);

	lines.push(`## ${adapterName} expected failures`);
	lines.push('');
	lines.push(`${adapterName} currently declares ${gapIds.length} expected-failure classification${gapIds.length === 1 ? '' : 's'} against vanilla's canonical behavior, covering ${totalTests} test${totalTests === 1 ? '' : 's'}. That includes ${openGapIds.length} open parity gap${openGapIds.length === 1 ? '' : 's'} covering ${openTests} test${openTests === 1 ? '' : 's'} and ${intentionalGapIds.length} intentional divergence${intentionalGapIds.length === 1 ? '' : 's'} covering ${intentionalTests} test${intentionalTests === 1 ? '' : 's'}. Each classification is verified by a test that continues to run as a regression trap.`);
	lines.push('');

	if (openGapIds.length > 0) {
		lines.push(`### Open parity gaps`);
		lines.push('');
		lines.push('These are known differences that may still be fixed upstream or in the adapter. If the behavior changes, the corresponding test flips from expected-failure to unexpected-pass.');
		lines.push('');
		lines.push(renderGapSummaryTable(adapterName, gaps, summary, openGapIds));
		lines.push('');
		lines.push(renderGapDetails(adapterName, summary, openGapIds));
		lines.push('');
	}

	if (intentionalGapIds.length > 0) {
		lines.push(`## ${adapterName} intentional divergences`);
		lines.push('');
		lines.push('These are known vanilla differences that the engine maintainers have decided not to implement, or that this adapter deliberately preserves. The tests stay registered as expected failures so consumers can see the divergence and so any future behavior change is visible.');
		lines.push('');
		lines.push(renderGapSummaryTable(adapterName, gaps, summary, intentionalGapIds));
		lines.push('');
		lines.push(renderGapDetails(adapterName, summary, intentionalGapIds));
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
			lines.push(`- ${t.fullName}`);
		}
		lines.push('');
	}
	lines.push('</details>');
	return lines.join('\n');
}

function render(summaries) {
	const lines = [];
	lines.push('<!-- Auto-generated by scripts/generate-status.js. Do not edit by hand. -->');
	lines.push('');
	lines.push('# screeps-ok status');
	lines.push('');
	lines.push('> _If your engine agrees, it\'s Screeps._');
	lines.push('');
	lines.push(renderHeaderBadges(summaries, ''));
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
				lines.push(`- \`${t.fullName}\``);
			}
			lines.push('');
		}
	}

	// Unexpected failures — only renders when present, one subsection per adapter
	for (const [adapter, data] of Object.entries(summaries)) {
		const s = data.summary;
		if (isAdapterOk(s)) continue;
		lines.push(`## ${adapter} unexpected failures`);
		lines.push('');
		for (const t of s.failingTests) {
			lines.push(`- \`${t.fullName}\``);
		}
		for (const e of s.fileErrors) {
			lines.push(`- \`${suitePath(e.file)}\` failed outside its tests: ${e.message.split('\n')[0]}`);
		}
		for (const o of s.orphans) {
			lines.push(`- \`${o.gapId}\` registers \`${o.id}\`, which no test passed or failed`);
		}
		for (const t of s.untagged) {
			lines.push(`- \`${t.fullName}\` carries no single catalog id`);
		}
		if (s.unexpectedPasses.length > 0) {
			lines.push(`- ${s.unexpectedPasses.length} registered test(s) now pass; see Regression traps triggered`);
		}
		lines.push('');
	}

	// Expected failures grouped per adapter (each adapter gets its own section)
	for (const [adapter, data] of Object.entries(summaries)) {
		const block = renderPerAdapterExpectedFailures(adapter, data);
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
			lines.push(renderSkippedSection(adapter, s.skippedTests));
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

function updateReadmeBadges(summaries) {
	if (!existsSync(readmePath)) return;
	const current = readFileSync(readmePath, 'utf8');
	if (!BADGE_MARKER_RE.test(current)) return;
	const badges = renderHeaderBadges(summaries, 'docs/status.md');
	const replacement = `$1\n${badges}\n$2`;
	const next = current.replace(BADGE_MARKER_RE, replacement);
	if (next === current) return;
	writeFileSync(readmePath, next);
	console.log(`Wrote ${path.relative(packageRoot, readmePath)} (badge region)`);
}

function main(argv) {
	const requestedAdapters = argv.length > 0 ? argv : DEFAULT_ADAPTERS;

	const summaries = {};
	for (const adapter of requestedAdapters) {
		const report = loadReport(adapter);
		const parity = loadParity(path.join(adaptersDir, adapter, 'parity.json'));
		const summary = summarizeReport(report, parity);
		summaries[adapter] = { report, parity, summary };
	}

	const output = render(summaries);
	writeFileSync(outputPath, output);
	console.log(`Wrote ${path.relative(packageRoot, outputPath)}`);

	updateReadmeBadges(summaries);

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
