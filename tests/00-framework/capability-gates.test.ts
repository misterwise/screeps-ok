import { describe, expect, test } from 'vitest';
import { ungatedCapabilities } from '../../src/fixture.js';

// The fixture fails a test when the list is not empty.
describe('capability gates', () => {
	const rows = new Map([['GAP-001', ['deposit', 'market']], ['GAP-002', []]]);

	test('a tagged row\'s test owes each tag it never gated, keyed or not', () => {
		expect(ungatedCapabilities('GAP-001:key', new Set(['deposit']), rows)).toEqual(['market']);
		expect(ungatedCapabilities('GAP-001', new Set(), rows)).toEqual(['deposit', 'market']);
	});

	test('gates from matrix data count, and an untagged row owes none', () => {
		expect(ungatedCapabilities('GAP-001', new Set(['market', 'deposit']), rows)).toEqual([]);
		expect(ungatedCapabilities('GAP-002', new Set(), rows)).toEqual([]);
	});
});
