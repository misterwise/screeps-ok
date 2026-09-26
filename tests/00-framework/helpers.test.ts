/// <reference types="vite/client" />
import { describe, expect, test } from 'vitest';
import { code } from '../../src/code.js';
import { body } from '../../src/helpers/body.js';
import { makeValidationCases } from '../../src/matrices/validation-cases.js';
import { gclPoints } from '../../src/adapter.js';
import * as constants from '../../src/constants.js';
import { GCL_MULTIPLY, GCL_POW } from '../../src/constants.js';

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

describe('gclPoints', () => {
	// The level engines derive from their stored points (vanilla game.js:130).
	const levelOf = (points: number) => Math.floor((points / GCL_MULTIPLY) ** (1 / GCL_POW)) + 1;

	test('every level reads back, at its threshold and just below the next', () => {
		for (let level = 1; level <= 40; level++) {
			const room = gclPoints({ level: level + 1 }) - gclPoints({ level });
			expect(levelOf(gclPoints({ level }))).toBe(level);
			expect(levelOf(gclPoints({ level, progress: room - 1 }))).toBe(level);
		}
	});

	test('progress counts whole points past the rounded-up threshold', () => {
		expect(gclPoints({ level: 1 })).toBe(0);
		expect(gclPoints({ level: 2, progress: 5 })).toBe(GCL_MULTIPLY + 5);
		expect(gclPoints({ level: 3 })).toBe(Math.ceil(GCL_MULTIPLY * 2 ** GCL_POW));
	});

	test('a level or progress no point total reads back as fails', () => {
		expect(() => gclPoints({ level: 0 })).toThrow(/PlayerSpec.gcl/);
		expect(() => gclPoints({ level: 1.5 })).toThrow(/PlayerSpec.gcl/);
		expect(() => gclPoints({ level: 2, progress: -1 })).toThrow(/PlayerSpec.gcl/);
		expect(() => gclPoints({ level: 1, progress: GCL_MULTIPLY })).toThrow(/below 1000000/);
	});
});

describe('constants', () => {
	test('every constant has a value: a name @screeps/common lacks re-exports as undefined', () => {
		expect(Object.entries(constants).filter(([, value]) => value === undefined).map(([name]) => name)).toEqual([]);
	});
});
