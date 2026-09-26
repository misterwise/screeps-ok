import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { parseCatalog } from '../../scripts/lib/parse-catalog.js';

const dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function catalogOf(rows: string) {
	const dir = mkdtempSync(path.join(tmpdir(), 'screeps-ok-catalog-'));
	dirs.push(dir);
	const file = path.join(dir, 'behaviors.md');
	writeFileSync(file, `## 1. Section\n${rows}\n`);
	return () => parseCatalog(file);
}

describe('catalog ids', () => {
	test('a row id outside FAMILY-001 / FAMILY-SUBFAMILY-001 fails the parse', () => {
		expect(catalogOf('- `POWER-GENERATE-OPS-001` `behavior` `verified_vanilla`')).toThrow(/POWER-GENERATE-OPS-001/);
		expect(catalogOf('- `MOVE2-001` `behavior` `verified_vanilla`')).toThrow(/MOVE2-001/);
	});

	test('conforming row ids parse', () => {
		expect(catalogOf('- `MOVE-001` `behavior` `verified_vanilla`\n- `MOVE-PULL-002` `matrix` `verified_vanilla`')().map(e => e.id))
			.toEqual(['MOVE-001', 'MOVE-PULL-002']);
	});
});
