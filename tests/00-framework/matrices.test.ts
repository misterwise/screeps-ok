import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { catalogIdsIn, stripComments } from '../../scripts/lib/catalog-id.js';
import { parseCatalog } from '../../scripts/lib/parse-catalog.js';
import { testFileClaims } from '../../scripts/lib/test-claims.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const matricesDir = path.join(root, 'src/matrices');

// Lists whose rows' tests check only part of the row; the Tests area realigns them.
const pending = new Set([
	'storeSingleExtensionCases', 'storeRestrictedCases', 'boostTableCases', 'boostAdditivesMechanics',
]);

describe('matrices', () => {
	test('a case list runs in the test of the row it enumerates', () => {
		// An imported list the test never uses doesn't run: imports are cut before the match.
		const suite = testFileClaims(path.join(root, 'tests'))
			.map(({ code }) => code.replace(/^import\b[\s\S]*?\bfrom\s+['"][^'"]+['"];?/gm, ''))
			.join('\n');
		const unrun = readdirSync(matricesDir)
			.flatMap(name => [...stripComments(readFileSync(path.join(matricesDir, name), 'utf8')).matchAll(/^export const (\w+)/gm)])
			.map(([, name]) => name)
			.filter(name => !new RegExp(`\\b${name}\\b`).test(suite));
		// An unrun list gets wired into its row's test or deleted; a pending one that runs is pruned.
		expect(unrun.filter(name => !pending.has(name))).toEqual([]);
		expect([...pending].filter(name => !unrun.includes(name))).toEqual([]);
	});

	// The fixture checks a pair's setup against its left single's only for rows it was given.
	test('a test that loops a validation list registers each row', () => {
		const lists = readdirSync(matricesDir)
			.flatMap(name => [...stripComments(readFileSync(path.join(matricesDir, name), 'utf8')).matchAll(/^export const (\w+) = makeValidationCases\(/gm)])
			.map(([, name]) => name);
		expect(lists.length).toBeGreaterThan(30);
		const unregistered = testFileClaims(path.join(root, 'tests'))
			.filter(({ code }) => lists.some(list => new RegExp(`\\bof ${list}\\b`).test(code)) && !/\bvalidationBlockers\(/.test(code))
			.map(({ file }) => path.relative(root, file));
		expect(unregistered).toEqual([]);
	});
});

describe('docs/behavior-matrices.md', () => {
	const FIELDS = ['Catalog Entries', 'Canonical Source', 'Dimensions', 'Applicability', 'Exclusions', 'Verification Notes'];
	const doc = readFileSync(path.join(root, 'docs/behavior-matrices.md'), 'utf8');
	const definitions = doc.slice(doc.indexOf('\n## Definitions\n')).split(/^### /m).slice(1).map(block => {
		const [name, ...lines] = block.split('\n');
		const fields = new Map<string, string>();
		let field = '';
		for (const line of lines) {
			const start = /^- `([^`]+)`/.exec(line);
			if (start) fields.set(field = start[1], '');
			else if (field) fields.set(field, `${fields.get(field)} ${line.trim()}`);
		}
		return { name: name.trim(), fields, text: block };
	});
	const catalog = parseCatalog(path.join(root, 'behaviors.md'));

	test('each definition has the six fields in order and names catalog entries that exist', () => {
		const ids = new Set(catalog.map(entry => entry.id));
		expect(definitions.filter(def => JSON.stringify([...def.fields.keys()]) !== JSON.stringify(FIELDS)).map(def => def.name)).toEqual([]);
		expect(definitions.flatMap(def => catalogIdsIn(def.fields.get('Catalog Entries')!)
			.filter(id => !ids.has(id)).map(id => `${def.name}: ${id}`))).toEqual([]);
	});

	test('every matrix entry has a definition and every case list is named by one', () => {
		const defined = new Set(definitions.flatMap(def => catalogIdsIn(def.fields.get('Catalog Entries')!)));
		expect(catalog.filter(entry => entry.entryClass === 'matrix' && !defined.has(entry.id)).map(entry => entry.id)).toEqual([]);
		const named = new Set(definitions.flatMap(def => [...def.text.matchAll(/src\/matrices\/([\w-]+\.ts)/g)].map(([, file]) => file)));
		const caseLists = readdirSync(matricesDir)
			.filter(name => /^export const /m.test(stripComments(readFileSync(path.join(matricesDir, name), 'utf8'))));
		expect(caseLists.filter(name => !named.has(name))).toEqual([]);
	});

	test('every path a definition names exists', () => {
		const missing = definitions.flatMap(def => [...def.text.matchAll(/`((?:src|tests)\/[\w./-]+\.ts)`/g)]
			.map(([, file]) => file).filter(file => !existsSync(path.join(root, file))).map(file => `${def.name}: ${file}`));
		expect(missing).toEqual([]);
	});
});
