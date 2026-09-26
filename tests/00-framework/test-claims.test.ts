import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, test } from 'vitest';
import { adapterCapabilities, capabilityDescriptions } from '../../scripts/lib/capabilities.js';
import { testFileClaims } from '../../scripts/lib/test-claims.js';

const dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tree(files: Record<string, string>) {
	const root = mkdtempSync(path.join(tmpdir(), 'screeps-ok-claims-'));
	dirs.push(root);
	for (const [rel, text] of Object.entries(files)) {
		mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
		writeFileSync(path.join(root, rel), text);
	}
	return root;
}

describe('test file claims', () => {
	test('only code and imported matrices claim an id, and only in catalog sections', () => {
		const root = tree({
			'tests/01-section/1.1-some.test.ts': [
				`import { cases } from '../../src/matrices/some.js';`,
				`// GAP-002 is left to another file`,
				`/* and so is GAP-003 */`,
				`test('GAP-001:rowA does a thing', () => {});`,
			].join('\n'),
			'src/matrices/some.ts': `export const cases = [{ catalogId: 'GAP-004' }];\n// { catalogId: 'GAP-005' }\n`,
			'tests/00-framework/some.test.ts': `test('GAP-006 is a fixture', () => {});`,
		});
		const claims = testFileClaims(path.join(root, 'tests'));
		expect(claims.map(c => [path.relative(root, c.file), [...c.ids]])).toEqual([
			['tests/01-section/1.1-some.test.ts', ['GAP-001', 'GAP-004']],
		]);
	});

	// A skipped or todo test claims its id while running nothing; gates go through shard.requires() or a parity.json skip.
	test('a catalog test carries no vitest modifier that skips, inverts or narrows the run', () => {
		const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
		const modified = testFileClaims(path.join(repo, 'tests')).flatMap(({ file, code }) =>
			[...code.matchAll(/\b(?:test|it|describe)(?:\.\w+)*\.(?:skip|todo|only|fails|skipIf|runIf)\b/g)]
				.map(([match]) => `${path.relative(repo, file)}: ${match}`));
		expect(modified).toEqual([]);
	});
});

describe('adapter capabilities', () => {
	function adapter(body: string) {
		const root = tree({ 'index.ts': `class A {\n\treadonly capabilities: AdapterCapabilities = {\n${body}\n\t};\n}\n` });
		return () => adapterCapabilities(path.join(root, 'index.ts'));
	}

	test('reads the literal flags, comments aside', () => {
		expect([...adapter('\t\t// why it is off\n\t\tchemistry: false,\n\t\tnuke: true,')()]).toEqual([['chemistry', false], ['nuke', true]]);
	});

	test('a flag that is not a literal fails the read', () => {
		expect(adapter('\t\tnuke: Boolean(process.env.NUKE),')).toThrow(/Boolean/);
		expect(() => adapterCapabilities(tree({ 'index.ts': 'class A {}' }) + '/index.ts')).toThrow(/capabilities/);
	});
});

describe('capability descriptions', () => {
	const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

	test('every declared capability has a first sentence in the interface', () => {
		const described = capabilityDescriptions(path.join(repo, 'src/adapter.ts'));
		expect(described.get('chemistry')).toBe('Labs, reactions, minerals in labs, and related chemistry APIs.');
		for (const engine of ['vanilla', 'xxscreeps']) {
			const undescribed = [...adapterCapabilities(path.join(repo, 'adapters', engine, 'index.ts')).keys()].filter(name => !described.has(name));
			expect(undescribed).toEqual([]);
		}
	});

	test('a capability without a doc comment fails the read', () => {
		const root = tree({ 'adapter.ts': 'export interface AdapterCapabilities {\n\t/** Documented. */\n\tone: boolean;\n\ttwo: boolean;\n}\n' });
		expect(() => capabilityDescriptions(path.join(root, 'adapter.ts'))).toThrow(/two/);
	});
});
