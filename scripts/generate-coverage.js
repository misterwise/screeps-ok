/**
 * Extracts catalog IDs from behaviors.md and test IDs from tests/, cross-
 * references them, and writes an HTML coverage report to docs/coverage.html.
 *
 * The report is the single source of truth for "what's tested?" — it replaces
 * manual checkbox tracking in behaviors.md.
 *
 * Usage:
 *   node scripts/generate-coverage.js
 *   # or via npm:
 *   npm run coverage
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptsDir, '..');
const behaviorsPath = path.join(root, 'behaviors.md');
const testsDir = path.join(root, 'tests');
const outputPath = path.join(root, 'docs', 'coverage.html');

import { parseCatalog as parseCatalogFromFile } from './lib/parse-catalog.js';

function parseCatalog() {
	return parseCatalogFromFile(behaviorsPath);
}

// ---------------------------------------------------------------------------
// 2. Scan test files
// ---------------------------------------------------------------------------

const TEST_ID_RE = /\b([A-Z]+-(?:[A-Z]+-)?[0-9]{3})\b/g;
const MATRIX_IMPORT_RE = /from\s+['"]([^'"]+\/matrices\/[^'"]+?)(?:\.js)?['"]/g;
const MATRIX_CATALOG_ID_RE = /catalogId\s*:\s*['"]([A-Z]+-(?:[A-Z]+-)?[0-9]{3})['"]/g;

function walkDir(dir) {
	const results = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			results.push(...walkDir(full));
		} else if (entry.name.endsWith('.test.ts')) {
			results.push(full);
		}
	}
	return results;
}

/**
 * Resolve matrix file paths imported by a test file. Test files import
 * from '../../src/matrices/foo.js' but the source is foo.ts.
 */
function resolveMatrixImports(testFile, content) {
	const resolved = new Set();
	for (const m of content.matchAll(MATRIX_IMPORT_RE)) {
		const spec = m[1];
		const tsPath = path.resolve(path.dirname(testFile), `${spec}.ts`);
		resolved.add(tsPath);
	}
	return [...resolved];
}

function scanTests() {
	const idToFiles = new Map();
	const matrixCache = new Map();
	const testFiles = walkDir(testsDir);

	const claim = (id, relFile) => {
		if (!idToFiles.has(id)) idToFiles.set(id, new Set());
		idToFiles.get(id).add(relFile);
	};

	for (const file of testFiles) {
		const content = readFileSync(file, 'utf8');
		const relFile = path.relative(root, file);

		for (const match of content.matchAll(TEST_ID_RE)) {
			claim(match[1], relFile);
		}

		for (const matrixPath of resolveMatrixImports(file, content)) {
			let matrixContent = matrixCache.get(matrixPath);
			if (matrixContent === undefined) {
				try {
					matrixContent = readFileSync(matrixPath, 'utf8');
				} catch {
					matrixContent = null;
				}
				matrixCache.set(matrixPath, matrixContent);
			}
			if (!matrixContent) continue;
			for (const match of matrixContent.matchAll(MATRIX_CATALOG_ID_RE)) {
				claim(match[1], relFile);
			}
		}
	}

	return idToFiles;
}

// ---------------------------------------------------------------------------
// 3. Cross-reference
// ---------------------------------------------------------------------------

function crossReference(catalog, testedIds) {
	const catalogSet = new Set(catalog.map(e => e.id));
	const testedSet = new Set(testedIds.keys());

	const tested = [];
	const untested = [];
	const orphaned = [];

	for (const entry of catalog) {
		if (testedIds.has(entry.id)) {
			tested.push({ ...entry, files: [...testedIds.get(entry.id)] });
		} else {
			untested.push(entry);
		}
	}

	for (const [id, files] of testedIds) {
		if (!catalogSet.has(id)) {
			orphaned.push({ id, files: [...files] });
		}
	}

	return { tested, untested, orphaned };
}

// ---------------------------------------------------------------------------
// 4. Categorize untested
// ---------------------------------------------------------------------------

// IDs whose tests require simulate() which xxscreeps doesn't support
const SIMULATE_FAMILIES = ['FLAG', 'RAWMEMORY', 'RAWMEMORY-FOREIGN'];
// Capabilities that neither adapter currently supports
const BLOCKED_CAPABILITIES = new Set([
	'powerCreeps', 'factory', 'market', 'nuke', 'deposit',
]);
// Power-effect IDs that need powerCreeps even though their section isn't tagged
const POWER_EFFECT_RE = /^(TOWER-POWER|RAMPART-DECAY-00[45]|SOURCE-POWER|MINERAL-POWER|SPAWN-TIMING-005)/;

function categorizeUntested(entry) {
	if (entry.capability && BLOCKED_CAPABILITIES.has(entry.capability)) {
		return `capability: ${entry.capability}`;
	}
	if (POWER_EFFECT_RE.test(entry.id)) {
		return 'capability: powerCreeps';
	}
	const family = entry.id.replace(/-[0-9]{3}$/, '');
	if (SIMULATE_FAMILIES.some(f => family === f || family.startsWith(f + '-'))) {
		return 'simulate()-blocked';
	}
	if (entry.id.startsWith('MEMORY-') && entry.id !== 'MEMORY-001' &&
		entry.id !== 'MEMORY-002' && entry.id !== 'MEMORY-003') {
		return 'simulate()-blocked';
	}
	if (entry.id.startsWith('KEEPER-LAIR') || entry.id.startsWith('INVADER-CORE') ||
		entry.id.startsWith('NPC-OWNERSHIP')) {
		return 'NPC spawning';
	}
	if (entry.id.startsWith('TERMINAL-SEND')) {
		return 'capability: market';
	}
	return 'feasible';
}

// ---------------------------------------------------------------------------
// 5. Render HTML
// ---------------------------------------------------------------------------

function esc(s) {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderHTML(catalog, result) {
	const { tested, untested, orphaned } = result;

	const untestedByCategory = {};
	const untestedBySection = {};
	for (const entry of untested) {
		const cat = categorizeUntested(entry);
		(untestedByCategory[cat] ??= []).push(entry);
		const key = entry.section || '(no section)';
		(untestedBySection[key] ??= []).push(entry);
	}

	const testedBySection = {};
	for (const entry of tested) {
		const key = entry.section || '(no section)';
		(testedBySection[key] ??= []).push(entry);
	}

	// Section coverage for the bar chart
	const allSections = [...new Set(catalog.map(e => e.section))].filter(Boolean);
	const sectionStats = allSections.map(s => {
		const total = catalog.filter(e => e.section === s).length;
		const done = (testedBySection[s] || []).length;
		return { section: s, total, done, pct: total > 0 ? Math.round(100 * done / total) : 0 };
	});

	const feasibleUntested = untestedByCategory['feasible'] || [];
	const totalCatalog = catalog.length;
	const totalTested = tested.length;
	const totalFeasible = feasibleUntested.length;
	const totalBlocked = untested.length - totalFeasible;
	const pct = Math.round(100 * totalTested / totalCatalog);
	const feasiblePct = (totalTested + totalFeasible) > 0
		? Math.round(100 * totalTested / (totalTested + totalFeasible))
		: 100;

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>screeps-ok coverage</title>
<style>
:root {
  --bg: #0d1117; --fg: #c9d1d9; --border: #30363d;
  --green: #3fb950; --yellow: #d29922; --red: #f85149;
  --blue: #58a6ff; --muted: #8b949e; --card: #161b22;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  background: var(--bg); color: var(--fg); line-height: 1.5; padding: 2rem; max-width: 1200px; margin: 0 auto; }
h1 { font-size: 1.8rem; margin-bottom: 0.5rem; }
h2 { font-size: 1.3rem; margin: 2rem 0 0.75rem; border-bottom: 1px solid var(--border); padding-bottom: 0.4rem; }
h3 { font-size: 1.1rem; margin: 1.5rem 0 0.5rem; color: var(--blue); }
.subtitle { color: var(--muted); margin-bottom: 1.5rem; }
.stats { display: flex; gap: 1.5rem; flex-wrap: wrap; margin: 1rem 0; }
.stat-card { background: var(--card); border: 1px solid var(--border); border-radius: 6px;
  padding: 1rem 1.5rem; min-width: 140px; }
.stat-card .num { font-size: 2rem; font-weight: 700; }
.stat-card .label { color: var(--muted); font-size: 0.85rem; }
.green { color: var(--green); }
.yellow { color: var(--yellow); }
.red { color: var(--red); }
.bar-row { display: flex; align-items: center; gap: 0.5rem; margin: 0.3rem 0; font-size: 0.85rem; }
.bar-label { width: 280px; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bar-track { flex: 1; height: 18px; background: var(--border); border-radius: 3px; position: relative; min-width: 100px; }
.bar-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }
.bar-text { position: absolute; right: 6px; top: 0; line-height: 18px; font-size: 0.75rem; color: var(--fg); }
table { width: 100%; border-collapse: collapse; margin: 0.5rem 0; font-size: 0.85rem; }
th, td { padding: 0.4rem 0.75rem; text-align: left; border-bottom: 1px solid var(--border); }
th { color: var(--muted); font-weight: 600; position: sticky; top: 0; background: var(--bg); }
tr:hover td { background: var(--card); }
code { background: var(--card); padding: 0.15em 0.4em; border-radius: 3px; font-size: 0.9em; }
.badge { display: inline-block; padding: 0.15em 0.5em; border-radius: 3px; font-size: 0.75rem; font-weight: 600; }
.badge-green { background: #23863633; color: var(--green); }
.badge-yellow { background: #d2992233; color: var(--yellow); }
.badge-red { background: #f8514933; color: var(--red); }
.badge-muted { background: #8b949e22; color: var(--muted); }
details { margin: 0.5rem 0; }
summary { cursor: pointer; font-weight: 600; }
summary:hover { color: var(--blue); }
.filter-bar { margin: 1rem 0; }
.filter-bar input { background: var(--card); border: 1px solid var(--border); color: var(--fg);
  padding: 0.4rem 0.75rem; border-radius: 6px; width: 100%; max-width: 400px; font-size: 0.9rem; }
.filter-bar input::placeholder { color: var(--muted); }
.hidden { display: none !important; }
footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid var(--border);
  color: var(--muted); font-size: 0.8rem; }
</style>
</head>
<body>

<h1>screeps-ok coverage</h1>
<p class="subtitle">Behavioral conformance catalog vs. test suite</p>

<div class="stats">
  <div class="stat-card"><div class="num">${totalCatalog}</div><div class="label">catalog IDs</div></div>
  <div class="stat-card"><div class="num green">${totalTested}</div><div class="label">tested</div></div>
  <div class="stat-card"><div class="num yellow">${totalFeasible}</div><div class="label">feasible untested</div></div>
  <div class="stat-card"><div class="num">${totalBlocked}</div><div class="label">blocked</div></div>
  <div class="stat-card"><div class="num">${pct}%</div><div class="label">overall</div></div>
  <div class="stat-card"><div class="num">${feasiblePct}%</div><div class="label">of feasible</div></div>
</div>

<h2>Coverage by section</h2>
${sectionStats.map(s => {
	const color = s.pct === 100 ? 'var(--green)' : s.pct >= 50 ? 'var(--yellow)' : 'var(--red)';
	return `<div class="bar-row">
  <span class="bar-label" title="${esc(s.section)}">${esc(s.section)}</span>
  <div class="bar-track">
    <div class="bar-fill" style="width:${s.pct}%;background:${color}"></div>
    <span class="bar-text">${s.done}/${s.total}</span>
  </div>
</div>`;
}).join('\n')}

<h2>Untested by blocker</h2>
<table>
<thead><tr><th>Category</th><th>Count</th><th>IDs</th></tr></thead>
<tbody>
${Object.entries(untestedByCategory)
	.sort(([a], [b]) => a === 'feasible' ? -1 : b === 'feasible' ? 1 : a.localeCompare(b))
	.map(([cat, entries]) => {
		const badge = cat === 'feasible' ? 'badge-yellow' : 'badge-muted';
		const ids = entries.map(e => `<code>${esc(e.id)}</code>`).join(' ');
		return `<tr><td><span class="badge ${badge}">${esc(cat)}</span></td><td>${entries.length}</td><td>${ids}</td></tr>`;
	}).join('\n')}
</tbody>
</table>

<h2>Full catalog</h2>
<div class="filter-bar"><input id="filter" type="text" placeholder="Filter by ID, section, or status..."></div>
<table id="catalog-table">
<thead><tr><th>ID</th><th>Status</th><th>Section</th><th>Class</th><th>Oracle</th><th>Capability</th><th>Test file</th></tr></thead>
<tbody>
${catalog.map(entry => {
	const isTested = tested.some(t => t.id === entry.id);
	const testedEntry = tested.find(t => t.id === entry.id);
	const status = isTested ? 'tested' : 'untested';
	const blocker = isTested ? '' : categorizeUntested(entry);
	const badgeClass = isTested ? 'badge-green' : blocker === 'feasible' ? 'badge-yellow' : 'badge-muted';
	const statusLabel = isTested ? 'tested' : blocker;
	const files = testedEntry ? testedEntry.files.join(', ') : '';
	return `<tr data-status="${status}" data-blocker="${esc(blocker)}">
  <td><code>${esc(entry.id)}</code></td>
  <td><span class="badge ${badgeClass}">${esc(statusLabel)}</span></td>
  <td>${esc(entry.section)}</td>
  <td>${esc(entry.entryClass || '')}</td>
  <td>${esc(entry.oracle || '')}</td>
  <td>${esc(entry.capability || '')}</td>
  <td><small>${esc(files)}</small></td>
</tr>`;
}).join('\n')}
</tbody>
</table>

${orphaned.length > 0 ? `
<h2 class="red">Orphaned test IDs</h2>
<p>These IDs appear in test files but not in the catalog. They need catalog entries or renaming.</p>
<table>
<thead><tr><th>ID</th><th>File(s)</th></tr></thead>
<tbody>
${orphaned.map(o => `<tr><td><code>${esc(o.id)}</code></td><td><small>${esc(o.files.join(', '))}</small></td></tr>`).join('\n')}
</tbody>
</table>
` : ''}

<footer>
  Generated by <code>scripts/generate-coverage.js</code>.
  Regenerate with <code>npm run coverage</code>.
</footer>

<script>
const input = document.getElementById('filter');
const rows = document.querySelectorAll('#catalog-table tbody tr');
input.addEventListener('input', () => {
  const q = input.value.toLowerCase();
  rows.forEach(row => {
    row.classList.toggle('hidden', !row.textContent.toLowerCase().includes(q));
  });
});
</script>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const catalog = parseCatalog();
const testedIds = scanTests();
const result = crossReference(catalog, testedIds);

const html = renderHTML(catalog, result);
writeFileSync(outputPath, html);

const feasible = result.untested.filter(e => categorizeUntested(e) === 'feasible');
const blocked = result.untested.length - feasible.length;

console.log(`Wrote ${path.relative(root, outputPath)}`);
console.log(`  catalog: ${catalog.length} IDs`);
console.log(`  tested:  ${result.tested.length}`);
console.log(`  feasible untested: ${feasible.length}`);
console.log(`  blocked: ${blocked}`);
console.log(`  orphaned: ${result.orphaned.length}`);
if (result.orphaned.length > 0) {
	console.log(`  orphan IDs: ${result.orphaned.map(o => o.id).join(', ')}`);
}
