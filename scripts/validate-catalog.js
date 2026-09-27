/**
 * Holds behaviors.md's row labels against the vanilla adapter
 * (scripts/lib/catalog-labels.js).
 *
 * Usage:
 *   node scripts/validate-catalog.js
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { adapterCapabilities } from './lib/capabilities.js';
import { catalogLabelErrors } from './lib/catalog-labels.js';
import { baseCatalogId } from './lib/catalog-id.js';
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

const errors = catalogLabelErrors(parseCatalog(path.join(root, 'behaviors.md')), tested, vanilla);
if (errors.length > 0) {
	console.error(`Found ${errors.length} catalog label(s) the vanilla adapter contradicts:\n`);
	for (const error of errors) console.error(`  ${error}`);
	process.exit(1);
}
console.log('Every catalog label agrees with the vanilla adapter.');
