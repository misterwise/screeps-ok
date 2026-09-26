import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { classifyResults, loadParity } from '../../scripts/lib/parity.js';

const dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

// A parity.json (and any sibling files) in a fresh directory.
function parityFile(contents: object, siblings: Record<string, object> = {}) {
	const dir = mkdtempSync(path.join(tmpdir(), 'screeps-ok-skips-'));
	dirs.push(dir);
	for (const [name, sibling] of Object.entries(siblings)) writeFileSync(path.join(dir, name), JSON.stringify(sibling));
	const file = path.join(dir, 'parity.json');
	writeFileSync(file, JSON.stringify(contents));
	return file;
}

const TEST_FILE = '/suite/tests/01-section/1.1-some.test.ts';
const hangs = { why: 'pull(self) loops the processor forever', tests: ['MOVE-PULL-007'] };

describe('parity.json skips', () => {
	test('a skip needs a why and catalog test ids', () => {
		expect(() => loadParity(parityFile({ skips: { hangs: { tests: ['MOVE-PULL-007'] } } }))).toThrow(/skip "hangs" needs "why"/);
		expect(() => loadParity(parityFile({ skips: { hangs: { ...hangs, tests: [] } } }))).toThrow(/skip "hangs" needs non-empty "tests"/);
		expect(() => loadParity(parityFile({ skips: { hangs: { ...hangs, tests: ['pull'] } } }))).toThrow(/no catalog test id/);
		expect(() => loadParity(parityFile({ skips: { hangs: { ...hangs, reason: 'x' } } }))).toThrow(/unknown key "reason"/);
	});

	test('a test id is skipped or registered as a gap, not both', () => {
		expect(() => loadParity(parityFile({
			expected_failures: { 'some-gap': { actual: 'a', expected: 'b', tests: ['MOVE-PULL-007'] } },
			skips: { hangs },
		}))).toThrow(/MOVE-PULL-007 is registered under both gap "some-gap" and "hangs"/);
		expect(() => loadParity(parityFile({ skips: { hangs, again: hangs } }))).toThrow(/under both skip "hangs" and "again"/);
	});

	test('an overlay keeps the skips its base registers', () => {
		const parity = loadParity(parityFile({ extends: './base.json' }, { 'base.json': { skips: { hangs } } }));
		expect(parity.skipForId.get('MOVE-PULL-007')).toBe('hangs');
	});

	test('a skipped test counts under its own id or, registered bare, its row', () => {
		const parity = loadParity(parityFile({ skips: { hangs: { ...hangs, tests: ['MOVE-PULL-007'] } } }));
		const classified = classifyResults(parity, [
			{ fullName: 'MOVE-PULL-007:self pull() returns ERR_INVALID_TARGET for self', state: 'skipped', file: TEST_FILE },
			{ fullName: 'MOVE-PULL-008 an unregistered test', state: 'skipped', file: TEST_FILE },
		], { fullRun: true });
		expect(classified.registeredSkips.map(t => [t.id, t.skipId])).toEqual([['MOVE-PULL-007:self', 'hangs']]);
		expect(classified.orphans).toEqual([]);
	});

	test('a full run counts a skip that names no test as orphaned', () => {
		const parity = loadParity(parityFile({ skips: { hangs } }));
		const results = [{ fullName: 'OTHER-001 passes', state: 'passed', file: TEST_FILE }];
		expect(classifyResults(parity, results, { fullRun: true }).orphans).toEqual(['MOVE-PULL-007']);
		expect(classifyResults(parity, results, { fullRun: false }).orphans).toEqual([]);
	});
});
