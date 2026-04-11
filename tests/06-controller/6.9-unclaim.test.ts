import { describe, test, expect, code,
	OK,
	STRUCTURE_SPAWN,
	MOVE,
	FIND_STRUCTURES, FIND_RUINS,
} from '../../src/index.js';

describe('StructureController.unclaim()', () => {
	test('CTRL-UNCLAIM-001 unclaim() resets the controller to level 0 and leaves room structures intact', async ({ shard }) => {
		// Engine: @screeps/engine/src/processor/intents/controllers/unclaim.js
		// clears user/level/progress/downgradeTime/safeMode and nothing else.
		// Structures remain present (they simply become inactive because every
		// CONTROLLER_STRUCTURES[t][0] is 0).
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 3, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p1' }, // keep p1 active
			],
		});
		// Seed a spawn so we can assert it survives the unclaim step.
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
		});
		// Place a creep in W1N1 so p1 retains visibility after losing ownership.
		await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1', body: [MOVE],
		});

		const rc = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].controller.unclaim()
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const state = await shard.runPlayer('p1', code`
			const ctrl = Game.rooms['W1N1']?.controller;
			ctrl ? ({ level: ctrl.level, my: ctrl.my, owner: ctrl.owner?.username ?? null })
			     : null
		`) as { level: number; my: boolean; owner: string | null } | null;
		expect(state).not.toBeNull();
		expect(state!.level).toBe(0);
		expect(state!.my).toBe(false);
		expect(state!.owner).toBeNull();

		// The spawn still exists as a room object; no ruin is created.
		const structures = await shard.findInRoom('W1N1', FIND_STRUCTURES);
		const spawn = structures.find(s => s.id === spawnId);
		expect(spawn).toBeDefined();

		const ruins = await shard.findInRoom('W1N1', FIND_RUINS);
		expect(ruins.find(r => r.structureType === STRUCTURE_SPAWN)).toBeUndefined();
	});
});
