/**
 * Holds behaviors.md's row labels against the vanilla adapter
 * (scripts/lib/catalog-labels.js), and the ids the catalog and its matrix
 * definitions name to rows that exist.
 *
 * Usage:
 *   node scripts/validate-catalog.js
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { adapterCapabilities } from './lib/capabilities.js';
import { catalogLabelErrors } from './lib/catalog-labels.js';
import { baseCatalogId, unknownCatalogIds } from './lib/catalog-id.js';
import { loadParity } from './lib/parity.js';
import { parseCatalog } from './lib/parse-catalog.js';
import { testFileClaims } from './lib/test-claims.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vanillaDir = path.join(root, 'adapters/vanilla');

const { gapForId, skipForId } = loadParity(path.join(vanillaDir, 'parity.json'));
const vanilla = {
	unsupported: new Set([...adapterCapabilities(path.join(vanillaDir, 'index.ts'))]
		.filter(([, declared]) => !declared)
		.map(([name]) => name)),
	registered: new Set([...gapForId.keys(), ...skipForId.keys()].map(baseCatalogId)),
};
const tested = new Set(testFileClaims(path.join(root, 'tests')).flatMap(({ ids }) => [...ids]));

const catalog = parseCatalog(path.join(root, 'behaviors.md'));
const errors = catalogLabelErrors(catalog, tested, vanilla);
if (errors.length > 0) {
	console.error(`Found ${errors.length} catalog label(s) the vanilla adapter contradicts:\n`);
	for (const error of errors) console.error(`  ${error}`);
}

const rowIds = new Set(catalog.map(entry => entry.id));
const unknown = ['behaviors.md', 'docs/behavior-matrices.md'].flatMap(relFile =>
	unknownCatalogIds(readFileSync(path.join(root, relFile), 'utf8'), rowIds)
		.map(({ id, line }) => `${relFile}:${line}: ${id}`));
if (unknown.length > 0) {
	console.error(`Found ${unknown.length} id(s) that name no catalog row:\n`);
	for (const ref of unknown) console.error(`  ${ref}`);
}

if (errors.length > 0 || unknown.length > 0) process.exit(1);
console.log('Every catalog label agrees with the vanilla adapter, and every id the catalog names is a row.');
