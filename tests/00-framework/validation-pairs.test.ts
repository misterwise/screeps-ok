import { describe, expect, test } from 'vitest';
import { pairSetupError, SetupRecorder } from '../../src/fixture.js';
import { makeValidationCases } from '../../src/matrices/validation-cases.js';

const [notOwner, busy, notOwnerBeforeBusy] = makeValidationCases('GAP-001', [
	{ condition: 'not-owner', expectedRc: -1 },
	{ condition: 'busy', expectedRc: -4 },
] as const);

// Records a setup the way the fixture does: calls, then the ids they return.
function record(calls: [string, unknown[], unknown][]) {
	const recorder = new SetupRecorder();
	for (const [method, args, result] of calls) recorder.result(result, recorder.call(method, args));
	return recorder.setup();
}

describe('validation pairs', () => {
	test('a pair that sets up only its left single\'s world fails; one that adds its right condition passes', () => {
		const setups = new Map<string, string>();
		expect(pairSetupError(notOwner, 'placeCreep(p2)', setups)).toBeUndefined();
		expect(pairSetupError(busy, 'spawnBusyCreep(p1)', setups)).toBeUndefined();
		expect(pairSetupError(notOwnerBeforeBusy, 'placeCreep(p2)', setups)).toMatch(/GAP-001:notOwnerBeforeBusy sets up exactly what GAP-001:notOwner does, so 'busy' never holds/);
		expect(pairSetupError(notOwnerBeforeBusy, 'spawnBusyCreep(p2)', setups)).toBeUndefined();
	});

	test('a pair whose single didn\'t run is not judged', () => {
		expect(pairSetupError(notOwnerBeforeBusy, 'placeCreep(p2)', new Map())).toBeUndefined();
	});

	test('engine ids record by the order they arrived; ids a call was given stay as written', () => {
		const one = record([
			['placeCreep', ['W1N1'], 'abc'],
			['placeFlag', ['W1N1', { name: 'dup' }], 'dup'],
			['runPlayer', ['p1', 'Game.getObjectById("abc").move(TOP)'], 0],
		]);
		const two = record([
			['placeCreep', ['W1N1'], 'xyz'],
			['placeFlag', ['W1N1', { name: 'dup' }], 'dup'],
			['runPlayer', ['p1', 'Game.getObjectById("xyz").move(TOP)'], 0],
		]);
		const renamed = record([
			['placeCreep', ['W1N1'], 'xyz'],
			['placeFlag', ['W1N1', { name: 'long' }], 'long'],
			['runPlayer', ['p1', 'Game.getObjectById("xyz").move(TOP)'], 0],
		]);
		expect(one).toBe(two);
		expect(one).toContain('"dup"');
		expect(renamed).not.toBe(one);
	});
});
