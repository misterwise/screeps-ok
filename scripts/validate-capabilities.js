/**
 * Validates that tests for capability-gated catalog entries include
 * the corresponding shard.requires() call.
 *
 * Catches the common mistake of adding a test under a capability-tagged
 * section in behaviors.md without gating it — which would cause spurious
 * failures on adapters that don't support the capability. Also holds this
 * repo's adapters to declaring each flag as a literal (docs/adapter-spec.md).
 *
 * Usage:
 *   node scripts/validate-capabilities.js
 */
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { adapterCapabilities } from './lib/capabilities.js';
import { baseCatalogId, catalogIdsIn } from './lib/catalog-id.js';
import { parseCatalog } from './lib/parse-catalog.js';
import { testFileClaims } from './lib/test-claims.js';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptsDir, '..');
const behaviorsPath = path.join(root, 'behaviors.md');
const testsDir = path.join(root, 'tests');

const REQUIRES_RE = /shard\.requires\('(\w+)'/g;

// 1. Parse catalog — build map of catalog ID → required capabilities
const catalog = parseCatalog(behaviorsPath);
const requiredCapabilities = new Map();
for (const entry of catalog) {
	if (entry.capabilities.length > 0) {
		requiredCapabilities.set(entry.id, entry.capabilities);
	}
}

// 2. Each ID a catalog test file's code names must be gated in that code. Matrix
// rows gate through their own data (`shard.requires(entry.cap)`), which a static
// read can't follow, so their IDs aren't checked here.
const errors = [];
for (const { file, code } of testFileClaims(testsDir)) {
	const relFile = path.relative(root, file);
	const requiresCalls = new Set([...code.matchAll(REQUIRES_RE)].map(m => m[1]));
	for (const id of new Set(catalogIdsIn(code).map(baseCatalogId))) {
		for (const needed of requiredCapabilities.get(id) ?? []) {
			if (!requiresCalls.has(needed)) {
				errors.push({ file: relFile, id, capability: needed });
			}
		}
	}
}

// 3. Each adapter's capabilities block holds only `flag: true|false` lines and
// comments; a flag computed from whether an import loaded hides a broken wiring.
const literalErrors = [];
const adaptersDir = path.join(root, 'adapters');
for (const name of readdirSync(adaptersDir)) {
	const file = path.join(adaptersDir, name, 'index.ts');
	if (!existsSync(file)) continue;
	try {
		adapterCapabilities(file);
	} catch (err) {
		literalErrors.push(`  ${err.message}`);
	}
}

// 4. Report
if (errors.length > 0) {
	console.error(`Found ${errors.length} test(s) missing capability gates:\n`);
	for (const e of errors) {
		console.error(`  ${e.file}: ${e.id} requires capability '${e.capability}' but no shard.requires('${e.capability}') found`);
	}
}
if (literalErrors.length > 0) {
	console.error(`Found ${literalErrors.length} capability declaration(s) that aren't literals:\n`);
	for (const line of literalErrors) console.error(line);
}
if (errors.length > 0 || literalErrors.length > 0) process.exit(1);
console.log(`All ${requiredCapabilities.size} capability-gated catalog entries are properly gated in tests, and every adapter declares its flags as literals.`);
