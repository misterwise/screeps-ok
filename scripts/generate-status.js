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
const readmePath = path.join(packageRoot, 'README.md');
const BADGE_MARKER_RE = /(<!-- BADGES:START -->)[\s\S]*?(<!-- BADGES:END -->)/;

// Built-in adapters whose reports feed the dashboard by default. Downstream
// adapters can reuse this script by passing their own adapter name on the
// command line (see CLI block at the bottom).
const DEFAULT_ADAPTERS = ['vanilla', 'xxscreeps'];
const CATALOG_ID_RE = /\b([A-Z]+-(?:[A-Z]+-)?[0-9]{3}(?::[a-zA-Z]+)?)\b/;

function loadReport(adapter) {
	const reportPath = path.join(reportsDir, `${adapter}.json`);
	if (!existsSync(reportPath)) return null;
	return JSON.parse(readFileSync(reportPath, 'utf8'));
}

function loadParityFile(adapter) {
	const parityPath = path.join(adaptersDir, adapter, 'parity.json');
	if (!existsSync(parityPath)) return { expected_failures: {} };
	return JSON.parse(readFileSync(parityPath, 'utf8'));
}

function extractCatalogId(fullName) {
	const match = fullName.match(CATALOG_ID_RE);
	return match ? match[1] : null;
}

function buildExpectedFailSet(parity) {
	const idToGap = new Map();
	const gaps = parity.expected_failures ?? {};
	for (const [gapId, gap] of Object.entries(gaps)) {
		for (const testId of gap.tests ?? []) {
			idToGap.set(testId, gapId);
		}
	}
	return idToGap;
}

function summarizeReport(report, parity) {
	if (!report) {
		return {
			total: 0, passed: 0, expectedFailure: 0, failed: 0, skipped: 0,
			expectedFailureByGap: {}, passingTests: [], skippedTests: [],
			failingTests: [], unexpectedPasses: [],
			loaded: false,
		};
	}

	const idToGap = buildExpectedFailSet(parity);

	const all = report.testResults.flatMap(f =>
		f.assertionResults.map(a => ({ file: f.name, ...a })),
	);

	const expectedFailure = [];
	const unexpectedPasses = [];
	const genuinePasses = [];
	const genuineFailures = [];
	const skippedTests = [];

	for (const a of all) {
		if (a.status === 'skipped' || a.status === 'pending' || a.status === 'todo') {
			skippedTests.push(a);
			continue;
		}
		const catalogId = extractCatalogId(a.fullName);
		const gapId = catalogId ? idToGap.get(catalogId) : null;
		if (a.status === 'failed' && gapId) {
			expectedFailure.push(a);
		} else if (a.status === 'passed' && gapId) {
			unexpectedPasses.push(a);
		} else if (a.status === 'passed') {
			genuinePasses.push(a);
		} else if (a.status === 'failed') {
			genuineFailures.push(a);
		}
	}

	const expectedFailureByGap = {};
	for (const a of expectedFailure) {
		const catalogId = extractCatalogId(a.fullName);
		const gapId = catalogId ? idToGap.get(catalogId) : null;
		if (!gapId) continue;
		(expectedFailureByGap[gapId] ??= []).push(a);
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
	const linkTo = (anchor) => `docs/status.md#${anchor}`;
	for (const [adapter, data] of Object.entries(summaries)) {
		const s = data.summary;
		if (!s.loaded) {
			badges.push(`![${adapter}](${shieldBadge(adapter, 'no report', 'lightgrey')})`);
			continue;
		}
		if (s.failed > 0 || s.unexpectedPasses.length > 0) {
			const url = linkTo(slug(`${adapter} unexpected failures`));
			badges.push(`[![${adapter}](${shieldBadge(adapter, `${s.failed || s.unexpectedPasses.length} failing`, 'red')})](${url})`);
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
	const failedCell = summary.failed > 0
		? `[${summary.failed}](#${slug(`${adapter} unexpected failures`)})`
		: '—';
	return `| ${icon} | **${adapter}** | ${passCell} | ${expectedCell} | ${failedCell} | ${skippedCell} | ${formatTimestamp(report)} |`;
}

function gapAnchor(adapterName, gapId) {
	return slug(`${adapterName} gap ${gapId}`);
}

function gapBehaviorFields(gap) {
	// New schema: { actual, expected }. Legacy schema: { summary }.
	const actual = gap.actual ?? gap.summary ?? '(no description)';
	const expected = gap.expected ?? '(see test assertion)';
	return { actual, expected };
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

const CAPABILITY_DESCRIPTIONS = {
	chemistry: 'Lab/boost mechanics',
	powerCreeps: 'Power creeps and powers',
	factory: 'Factory commodities',
	market: 'Market and terminal',
	observer: 'Observer rooms',
	nuke: 'Nukes',
	deposit: 'Deposits (highway)',
	terrain: 'Custom terrain specs',
	portals: 'Portal structures and teleport mechanics',
	invaderCore: 'Invader core structures',
};

const LIMITATION_DESCRIPTIONS = {
	pullSelfHang: 'pull(self) hangs the runner',
};

function describeSkipReason(reason) {
	if (!reason) return { category: 'uncategorized', key: '(no reason)', description: 'Skip reason not recorded' };
	const [category, key] = reason.split(':');
	if (category === 'capability') {
		return {
			category: 'capability',
			key,
			description: CAPABILITY_DESCRIPTIONS[key] ?? `Adapter capability '${key}' is disabled`,
		};
	}
	if (category === 'limitation') {
		return {
			category: 'limitation',
			key,
			description: LIMITATION_DESCRIPTIONS[key] ?? `Documented adapter limitation '${key}'`,
		};
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
	const gaps = parity.expected_failures ?? {};
	const gapIds = Object.keys(gaps);
	if (gapIds.length === 0) return '';

	const totalTests = gapIds.reduce(
		(n, gapId) => n + (summary.expectedFailureByGap?.[gapId]?.length ?? 0),
		0,
	);

	lines.push(`## ${adapterName} expected failures`);
	lines.push('');
	lines.push(`${adapterName} currently declares ${gapIds.length} parity gap${gapIds.length === 1 ? '' : 's'} against vanilla's canonical behavior, covering ${totalTests} test${totalTests === 1 ? '' : 's'}. Each gap is verified by a test that continues to run as a regression trap — if ${adapterName} fixes the behavior upstream the test will flip from expected-failure to unexpected-pass.`);
	lines.push('');
	lines.push('| Gap | Actual | Expected | Tests |');
	lines.push('| --- | --- | --- | :-: |');

	for (const gapId of gapIds) {
		const { actual, expected } = gapBehaviorFields(gaps[gapId]);
		const testCount = (summary.expectedFailureByGap?.[gapId] ?? []).length;
		const anchor = gapAnchor(adapterName, gapId);
		const countCell = testCount > 0 ? `[${testCount}](#${anchor})` : `${testCount}`;
		lines.push(`| \`${gapId}\` | ${actual} | ${expected} | ${countCell} |`);
	}

	lines.push('');
	lines.push('Click a test count above to jump to the affected test list for that gap.');
	lines.push('');
	for (const gapId of gapIds) {
		const tests = (summary.expectedFailureByGap?.[gapId] ?? []).map(t => t.fullName);
		lines.push(renderGapTestList(adapterName, gapId, tests));
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
				lines.push(`- \`${t.fullName}\``);
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
			lines.push(`- \`${t.fullName}\``);
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
	const badges = renderHeaderBadges(summaries);
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
		const parity = loadParityFile(adapter);
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
