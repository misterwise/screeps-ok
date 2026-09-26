import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { stripComments } from '../../scripts/lib/catalog-id.js';
import { testFileClaims } from '../../scripts/lib/test-claims.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const matricesDir = path.join(root, 'src/matrices');

// Lists whose rows' tests check only part of the row; the Tests area realigns them.
const pending = new Set([
	'storeSingleExtensionCases', 'storeRestrictedCases', 'boostTableCases', 'boostAdditivesMechanics',
]);

describe('matrices', () => {
	test('a case list runs in the test of the row it enumerates', () => {
		const suite = testFileClaims(path.join(root, 'tests')).map(({ code }) => code).join('\n');
		const unrun = readdirSync(matricesDir)
			.flatMap(name => [...stripComments(readFileSync(path.join(matricesDir, name), 'utf8')).matchAll(/^export const (\w+)/gm)])
			.map(([, name]) => name)
			.filter(name => !new RegExp(`\\b${name}\\b`).test(suite));
		// An unrun list gets wired into its row's test or deleted; a pending one that runs is pruned.
		expect(unrun.filter(name => !pending.has(name))).toEqual([]);
		expect([...pending].filter(name => !unrun.includes(name))).toEqual([]);
	});
});
