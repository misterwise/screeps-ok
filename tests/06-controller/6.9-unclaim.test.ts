import { describe, test, expect, code,
	OK,
	STRUCTURE_SPAWN,
	MOVE,
	FIND_STRUCTURES, FIND_RUINS,
	SAFE_MODE_COOLDOWN,
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

	test('CTRL-UNCLAIM-004 unclaim() resets safeModeAvailable to 0', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 3, owner: 'p1', safeModeAvailable: 2 },
				{ name: 'W2N1', rcl: 1, owner: 'p1' }, // keep p1 active
			],
		});
		// Place a creep in W1N1 so p1 retains visibility after losing ownership.
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE],
		});

		const before = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].controller.safeModeAvailable
		`) as number;
		expect(before).toBe(2);

		const rc = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].controller.unclaim()
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const after = await shard.runPlayer('p1', code`
			const ctrl = Game.rooms['W1N1']?.controller;
			ctrl ? ({ level: ctrl.level, safeModeAvailable: ctrl.safeModeAvailable }) : null
		`) as { level: number; safeModeAvailable: number } | null;
		expect(after).not.toBeNull();
		expect(after!.level).toBe(0);
		expect(after!.safeModeAvailable).toBe(0);
	});

	test('CTRL-UNCLAIM-005 unclaim() starts a fresh safe-mode cooldown rather than clearing it', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 3, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p1' }, // keep p1 active
			],
		});
		// Place a creep in W1N1 so p1 retains visibility after losing ownership.
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE],
		});

		// No cooldown before the unclaim — the fresh cooldown must come from it.
		const before = await shard.runPlayer('p1', code`
			({ cooldown: Game.rooms['W1N1'].controller.safeModeCooldown ?? null })
		`) as { cooldown: number | null };
		expect(before.cooldown).toBeNull();

		const rc = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].controller.unclaim()
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const after = await shard.runPlayer('p1', code`
			const ctrl = Game.rooms['W1N1']?.controller;
			ctrl ? ({ level: ctrl.level, cooldown: ctrl.safeModeCooldown ?? null }) : null
		`) as { level: number; cooldown: number | null } | null;
		expect(after).not.toBeNull();
		expect(after!.level).toBe(0);
		// A fresh SAFE_MODE_COOLDOWN-length cooldown, minus the few ticks
		// elapsed between the processor step and this read.
		expect(after!.cooldown).not.toBeNull();
		expect(after!.cooldown!).toBeGreaterThan(SAFE_MODE_COOLDOWN - 20);
		expect(after!.cooldown!).toBeLessThanOrEqual(SAFE_MODE_COOLDOWN);
	});

	test('CTRL-UNCLAIM-006 unclaim() resets isPowerEnabled to false', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 8, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p1' }, // keep p1 active
			],
		});
		// Place a creep in W1N1 so p1 retains visibility after losing ownership.
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE],
		});
		// Power-enable the room first — the only in-game path is enableRoom.
		await shard.placePowerCreep('W1N1', {
			pos: [1, 1], owner: 'p1', // Adjacent to controller at [1,1]
			powers: {},
			store: { ops: 10 },
		});
		await shard.tick();

		const enableRc = await shard.runPlayer('p1', code`
			const pc = Object.values(Game.powerCreeps)[0];
			pc.enableRoom(Game.rooms['W1N1'].controller)
		`);
		expect(enableRc).toBe(OK);

		const enabled = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].controller.isPowerEnabled
		`);
		expect(enabled).toBe(true);

		const rc = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].controller.unclaim()
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const after = await shard.runPlayer('p1', code`
			const ctrl = Game.rooms['W1N1']?.controller;
			ctrl ? ({ level: ctrl.level, isPowerEnabled: ctrl.isPowerEnabled }) : null
		`) as { level: number; isPowerEnabled: boolean } | null;
		expect(after).not.toBeNull();
		expect(after!.level).toBe(0);
		expect(after!.isPowerEnabled).toBe(false);
	});
});
