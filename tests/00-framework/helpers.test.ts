/// <reference types="vite/client" />
import { describe, expect, test } from 'vitest';
import { code } from '../../src/code.js';
import { body } from '../../src/helpers/body.js';
import { makeValidationCases } from '../../src/matrices/validation-cases.js';

describe('code tag', () => {
	test('a value JSON would change fails instead of interpolating as something else', () => {
		for (const value of [NaN, Infinity, () => 1, Symbol('s'), { range: -Infinity }, [() => 1]]) {
			expect(() => code`f(${value})`).toThrow(/code`/);
		}
	});

	test('JSON-safe values and undefined interpolate as literals', () => {
		expect(code`f(${'a\'b'}, ${[1, null]}, ${{ x: 2 }}, ${undefined})`).toBe(`f("a'b", [1,null], {"x":2}, undefined)`);
	});
});

describe('body', () => {
	test('a count is a positive integer followed by a part', () => {
		expect(() => body(3)).toThrow(/body/);
		expect(() => body(0, 'work')).toThrow(/body/);
		expect(() => body(1.5, 'work')).toThrow(/body/);
		expect(() => body(2, 3, 'work')).toThrow(/body/);
	});

	test('a count repeats its part; a bare part counts once', () => {
		expect(body(2, 'work', 'move')).toEqual(['work', 'work', 'move']);
	});
});

describe('makeValidationCases', () => {
	const conditions = [
		{ condition: 'not-owner', expectedRc: -1 },
		{ condition: 'busy', expectedRc: -4 },
	] as const;

	test('an exclusion names two of its conditions in declaration order', () => {
		expect(() => makeValidationCases('X-001', conditions, [['busy', 'not-owner']])).toThrow(/busy.*not-owner/);
		expect(() => makeValidationCases('X-001', conditions, [['not-owner', 'nope' as 'busy']])).toThrow(/nope/);
	});

	test('two conditions with one label fail', () => {
		expect(() => makeValidationCases('X-001', [
			{ condition: 'not-owner', expectedRc: -1 },
			{ condition: 'not_owner', expectedRc: -1 },
		])).toThrow(/notOwner/);
	});

	test('every shipped matrix loads', () => {
		expect(Object.keys(import.meta.glob('../../src/matrices/*.ts', { eager: true })).length).toBeGreaterThan(0);
	});
});
