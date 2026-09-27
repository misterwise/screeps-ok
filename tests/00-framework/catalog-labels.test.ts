import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { catalogLabelErrors } from '../../scripts/lib/catalog-labels.js';
import { parseCatalog } from '../../scripts/lib/parse-catalog.js';

const dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function catalogOf(rows: string) {
	const dir = mkdtempSync(path.join(tmpdir(), 'screeps-ok-catalog-'));
	dirs.push(dir);
	const file = path.join(dir, 'behaviors.md');
	writeFileSync(file, `## 1. Section\n### 1.1 Facet \`capability: multiShard\`\n${rows}\n`);
	return () => parseCatalog(file);
}

const vanilla = { unsupported: new Set(['multiShard']), registered: new Set(['GAP-002']) };

describe('catalog labels', () => {
	test('a row with no label, or one outside the vocabulary, fails the parse', () => {
		expect(catalogOf('- `GAP-001` `behavior`')).toThrow(/GAP-001 is labeled nothing/);
		expect(catalogOf('- `GAP-001` `behavior` `needs_vanilla_verification`')).toThrow(/GAP-001 is labeled `needs_vanilla_verification`/);
		expect(catalogOf('- `GAP-001` `behavior` `documented`\n- `GAP-002` `matrix` `reported`')().map(e => e.oracle))
			.toEqual(['documented', 'reported']);
	});

	test('a row\'s text on its header line fails the parse; capability tags may follow the label', () => {
		expect(catalogOf('- `GAP-001` `behavior` `documented` Text on the header line.')).toThrow(/GAP-001's first line/);
		expect(catalogOf('- `GAP-001` `behavior` `documented` `capability: powerEffects`\n  Text.')().map(e => e.capabilities))
			.toEqual([['multiShard', 'powerEffects']]);
	});

	test('verified_vanilla fails on a row vanilla lacks the capability for or registers', () => {
		const entries = catalogOf('- `GAP-001` `behavior` `verified_vanilla`')();
		expect(catalogLabelErrors(entries, new Set(), vanilla)).toEqual([
			'GAP-001 is verified_vanilla but needs `multiShard`, which vanilla lacks: label it documented or reported',
		]);
		const ungated = entries.map(entry => ({ ...entry, id: 'GAP-002', capabilities: [] }));
		expect(catalogLabelErrors(ungated, new Set(['GAP-002']), vanilla)).toEqual([
			'GAP-002 is verified_vanilla but is registered in vanilla\'s parity.json: label it documented or reported',
		]);
	});

	test('a tested row vanilla runs green is verified_vanilla; an untested one keeps its source', () => {
		const entries = catalogOf('- `GAP-003` `behavior` `documented`')().map(entry => ({ ...entry, capabilities: [] }));
		expect(catalogLabelErrors(entries, new Set(['GAP-003']), vanilla)).toEqual([
			'GAP-003 is documented but vanilla runs it green: label it verified_vanilla',
		]);
		expect(catalogLabelErrors(entries, new Set(), vanilla)).toEqual([]);
	});
});
