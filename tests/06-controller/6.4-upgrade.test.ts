import { describe, test, expect, code,
	OK, ERR_NOT_IN_RANGE, ERR_NOT_ENOUGH_RESOURCES, ERR_INVALID_TARGET,
	WORK, CARRY, MOVE, CLAIM, UPGRADE_CONTROLLER_POWER,
	CONTROLLER_LEVELS, CONTROLLER_MAX_UPGRADE_PER_TICK,
	CONTROLLER_NUKE_BLOCKED_UPGRADE,
} from '../../src/index.js';
import { body } from '../../src/helpers/body.js';

describe('creep.upgradeController()', () => {
	test('CTRL-UPGRADE-001 returns OK when adjacent to own controller with energy', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const ctrlPos = await shard.getControllerPos('W1N1');

		const creepId = await shard.placeCreep('W1N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body: [WORK, CARRY, MOVE],
			store: { energy: 50 },
		});

		const rc = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			const ctrl = creep.room.controller;
			creep.upgradeController(ctrl)
		`);
		expect(rc).toBe(OK);
	});

	test('CTRL-UPGRADE-002 consumes UPGRADE_CONTROLLER_POWER energy per WORK part per tick', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const ctrlPos = await shard.getControllerPos('W1N1');

		const creepId = await shard.placeCreep('W1N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body: [WORK, WORK, CARRY, MOVE],
			store: { energy: 50 },
		});

		await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			creep.upgradeController(creep.room.controller)
		`);
		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store.energy).toBe(50 - 2 * UPGRADE_CONTROLLER_POWER);
	});

	test('CTRL-UPGRADE-003 returns ERR_NOT_IN_RANGE when not within range 3', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
			store: { energy: 50 },
		});

		const rc = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			creep.upgradeController(creep.room.controller)
		`);
		expect(rc).toBe(ERR_NOT_IN_RANGE);
	});

	test('CTRL-UPGRADE-004 returns ERR_NOT_ENOUGH_RESOURCES without energy', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const ctrlPos = await shard.getControllerPos('W1N1');

		const creepId = await shard.placeCreep('W1N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});

		const rc = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			creep.upgradeController(creep.room.controller)
		`);
		expect(rc).toBe(ERR_NOT_ENOUGH_RESOURCES);
	});

	test('CTRL-UPGRADE-005 upgradeController succeeds at Chebyshev range 3 and fails at range 4', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const ctrlPos = await shard.getControllerPos('W1N1');

		// Chebyshev distance 3 — x + 3 is exactly at range 3.
		const nearCreep = await shard.placeCreep('W1N1', {
			pos: [ctrlPos!.x + 3, ctrlPos!.y],
			owner: 'p1',
			body: [WORK, CARRY, MOVE],
			store: { energy: 50 },
		});
		// Chebyshev distance 4 — just out of range.
		const farCreep = await shard.placeCreep('W1N1', {
			pos: [ctrlPos!.x + 4, ctrlPos!.y],
			owner: 'p1',
			body: [WORK, CARRY, MOVE],
			store: { energy: 50 },
		});

		const result = await shard.runPlayer('p1', code`({
			rangeThree: Game.getObjectById(${nearCreep}).upgradeController(
				Game.rooms['W1N1'].controller
			),
			rangeFour: Game.getObjectById(${farCreep}).upgradeController(
				Game.rooms['W1N1'].controller
			),
		})`) as { rangeThree: number; rangeFour: number };
		expect(result.rangeThree).toBe(OK);
		expect(result.rangeFour).toBe(ERR_NOT_IN_RANGE);
	});

	test('CTRL-UPGRADE-006 upgrade at RCL 8 is capped at CONTROLLER_MAX_UPGRADE_PER_TICK', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});
		const ctrlPos = await shard.getControllerPos('W1N1');

		// 20 WORK parts would consume 20 energy per tick uncapped; at RCL 8
		// the per-tick cap is 15.
		const creepId = await shard.placeCreep('W1N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body: body(20, WORK, CARRY, MOVE),
			store: { energy: 100 },
		});

		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).upgradeController(
				Game.rooms['W1N1'].controller
			)
		`);
		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		// Exactly CONTROLLER_MAX_UPGRADE_PER_TICK (15) energy consumed.
		expect(creep.store.energy).toBe(100 - CONTROLLER_MAX_UPGRADE_PER_TICK);
	});

	test('CTRL-UPGRADE-007 CONTROLLER_LEVELS progress thresholds match the canonical table', () => {
		// Matrix: verify the @screeps/common-sourced table matches the
		// documented thresholds. This oracle check does not need a shard.
		expect(CONTROLLER_LEVELS).toEqual({
			1: 200,
			2: 45_000,
			3: 135_000,
			4: 405_000,
			5: 1_215_000,
			6: 3_645_000,
			7: 10_935_000,
		});
	});

	test('CTRL-UPGRADE-008 upgradeController increments Game.gcl.progress', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const ctrlPos = await shard.getControllerPos('W1N1');

		const creepId = await shard.placeCreep('W1N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body: [WORK, WORK, CARRY, MOVE],
			store: { energy: 50 },
		});

		const before = await shard.runPlayer('p1', code`
			Game.gcl.progress
		`) as number;

		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).upgradeController(
				Game.rooms['W1N1'].controller
			)
		`);
		await shard.tick();

		const after = await shard.runPlayer('p1', code`
			Game.gcl.progress
		`) as number;
		// Two WORK parts at UPGRADE_CONTROLLER_POWER (1) each → +2 GCL progress.
		expect(after - before).toBe(2 * UPGRADE_CONTROLLER_POWER);
	});

	test('CTRL-UPGRADE-009 upgradeController returns ERR_INVALID_TARGET while upgradeBlocked is active', async ({ shard }) => {
		// Engine client check @screeps/engine/src/game/creeps.js:937 returns
		// ERR_INVALID_TARGET when upgradeBlocked is set. Catalog originally
		// said ERR_BUSY — corrected.
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 2, owner: 'p2' },
			],
		});
		const ctrlPos = await shard.getControllerPos('W2N1');

		// Hostile creep attacks p2's controller to set upgradeBlocked on it.
		const attackerId = await shard.placeCreep('W2N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body: [CLAIM, MOVE],
		});
		// p2's upgrader stands on another adjacent tile (avoid x=0 border).
		const upgraderId = await shard.placeCreep('W2N1', {
			pos: [ctrlPos!.x, ctrlPos!.y + 1],
			owner: 'p2',
			body: [WORK, CARRY, MOVE],
			store: { energy: 50 },
		});
		await shard.tick();

		const attackRc = await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).attackController(
				Game.rooms['W2N1'].controller
			)
		`);
		expect(attackRc).toBe(OK);
		await shard.tick();

		// p2 attempts to upgrade their own controller — upgradeBlocked rejects it.
		const upgradeRc = await shard.runPlayer('p2', code`
			Game.getObjectById(${upgraderId}).upgradeController(
				Game.rooms['W2N1'].controller
			)
		`);
		expect(upgradeRc).toBe(ERR_INVALID_TARGET);
	});

	test('CTRL-UPGRADE-010 upgradeController is blocked after a nuke lands in the room', async ({ shard }) => {
		shard.requires('nuke', 'nuke capability required for CTRL-UPGRADE-010');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});

		// Drop a nuke with a short timeToLand so we can process the landing
		// without 50K ticks of elapsed time.
		await shard.placeNuke('W1N1', {
			pos: [10, 10],
			launchRoomName: 'W1N1',
			timeToLand: 1,
		});
		// Advance two ticks so the nuke lands. The nuke processor kills every
		// creep in the room, so the upgrader must be placed afterward.
		await shard.tick(2);

		const ctrlPos = await shard.getControllerPos('W1N1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body: [WORK, CARRY, MOVE],
			store: { energy: 50 },
		});
		await shard.tick();

		const upgradeRc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).upgradeController(
				Game.rooms['W1N1'].controller
			)
		`);
		// Engine client returns ERR_INVALID_TARGET while upgradeBlocked > 0.
		expect(upgradeRc).toBe(ERR_INVALID_TARGET);

		const upgradeBlocked = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].controller.upgradeBlocked
		`) as number;
		expect(upgradeBlocked).toBeGreaterThan(0);
		expect(upgradeBlocked).toBeLessThanOrEqual(CONTROLLER_NUKE_BLOCKED_UPGRADE);
	});

	test('CTRL-UPGRADE-011 partial upgrade uses only available energy when below full amount', async ({ shard }) => {
		// Engine upgradeController.js:30 — buildEffect = min(buildPower, energy).
		// 5 WORK = 5 full upgrade, but only 2 energy stored → progress advances 2,
		// energy spent 2.
		await shard.ownedRoom('p1');
		const ctrlPos = await shard.getControllerPos('W1N1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body: body(5, WORK, CARRY, MOVE),
			store: { energy: 2 },
		});

		const before = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].controller.progress
		`) as number;

		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).upgradeController(
				Game.rooms['W1N1'].controller
			)
		`);

		const after = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].controller.progress
		`) as number;
		expect(after - before).toBe(2);

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store.energy ?? 0).toBe(0);
		// Sanity: full upgrade would have contributed 5 × UPGRADE_CONTROLLER_POWER.
		expect(after - before).toBeLessThan(5 * UPGRADE_CONTROLLER_POWER);
	});

	test('CTRL-UPGRADE-012 controller advances to the next level when progress reaches the threshold', async ({ shard }) => {
		// Engine upgradeController.js:63-74 — when progress + boostedEffect crosses
		// CONTROLLER_LEVELS[level], the controller advances to level+1 and progress
		// resets to (progress + boostedEffect - nextLevelProgress). RCL 1 threshold
		// is 200; a 25-WORK creep upgrading 8 ticks crosses it.
		await shard.ownedRoom('p1', 'W1N1', 1);
		const ctrlPos = await shard.getControllerPos('W1N1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body: body(25, WORK, CARRY, MOVE),
			store: { energy: 500 },
		});

		const levelBefore = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].controller.level
		`) as number;
		expect(levelBefore).toBe(1);

		// 25 WORK × 8 upgrades = 200 progress, exactly the RCL 1 threshold.
		for (let i = 0; i < 8; i++) {
			await shard.runPlayer('p1', code`
				Game.getObjectById(${creepId}).upgradeController(
					Game.rooms['W1N1'].controller
				)
			`);
		}

		const result = await shard.runPlayer('p1', code`({
			level: Game.rooms['W1N1'].controller.level,
			progress: Game.rooms['W1N1'].controller.progress,
		})`) as { level: number; progress: number };
		expect(result.level).toBe(2);
		// progress after advance is the overflow past the L1 threshold (0 or small).
		expect(result.progress).toBeGreaterThanOrEqual(0);
		expect(result.progress).toBeLessThan(CONTROLLER_LEVELS[1]);
	});
});
