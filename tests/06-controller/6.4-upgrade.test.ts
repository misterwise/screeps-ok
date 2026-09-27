import { describe, test, expect, code,
	OK, ERR_NOT_IN_RANGE, ERR_INVALID_TARGET,
	WORK, CARRY, MOVE, CLAIM, UPGRADE_CONTROLLER_POWER,
	CONTROLLER_LEVELS, CONTROLLER_MAX_UPGRADE_PER_TICK,
	CONTROLLER_NUKE_BLOCKED_UPGRADE, CONTROLLER_DOWNGRADE, CONTROLLER_DOWNGRADE_RESTORE,
} from '../../src/index.js';
import { body } from '../../src/helpers/body.js';
import { ctrlUpgradeValidationCases } from '../../src/matrices/ctrl-upgrade-validation.js';
import { spawnBusyCreep } from '../intent-validation-helpers.js';

describe('creep.upgradeController()', () => {
	test('CTRL-UPGRADE-001 each WORK part adds UPGRADE_CONTROLLER_POWER progress per tick', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const ctrlPos = await shard.getControllerPos('W1N1');

		const creepId = await shard.placeCreep('W1N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body: [WORK, WORK, CARRY, MOVE],
			store: { energy: 50 },
		});

		const rc = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			creep.upgradeController(creep.room.controller)
		`);
		expect(rc).toBe(OK);
		expect(await shard.runPlayer('p1', code`Game.rooms.W1N1.controller.progress`)).toBe(2 * UPGRADE_CONTROLLER_POWER);
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

	for (const level of [1, 2, 3, 4, 5, 6, 7, 8]) {
		test(`CTRL-UPGRADE-007:level${level} progressTotal reads ${level < 8 ? 'CONTROLLER_LEVELS[level]' : 'undefined'} at level ${level}`, async ({ shard }) => {
			await shard.ownedRoom('p1', 'W1N1', level);
			expect(await shard.runPlayer('p1', code`Game.rooms.W1N1.controller.progressTotal`))
				.toBe(level < 8 ? CONTROLLER_LEVELS[level] : null);
		});
	}

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
		// The nuke lands on the first tick after placement; this read is four
		// ticks after that.
		expect(upgradeBlocked).toBe(CONTROLLER_NUKE_BLOCKED_UPGRADE - 4);
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

	test('CTRL-UPGRADE-017 a level-up adds one safe-mode charge', async ({ shard }) => {
		// 25 WORK × 8 upgrades = 200 progress, the RCL 1 threshold.
		await shard.ownedRoom('p1', 'W1N1', 1);
		const ctrlPos = await shard.getControllerPos('W1N1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body: body(25, WORK, CARRY, MOVE),
			store: { energy: 500 },
		});

		const readController = code`({
			level: Game.rooms['W1N1'].controller.level,
			safeModeAvailable: Game.rooms['W1N1'].controller.safeModeAvailable,
		})`;
		const before = await shard.runPlayer('p1', readController) as { level: number; safeModeAvailable: number };
		expect(before.level).toBe(1);

		for (let i = 0; i < 8; i++) {
			await shard.runPlayer('p1', code`
				Game.getObjectById(${creepId}).upgradeController(Game.rooms['W1N1'].controller)
			`);
		}

		expect(await shard.runPlayer('p1', readController))
			.toEqual({ level: 2, safeModeAvailable: before.safeModeAvailable + 1 });
	});

	// Engine upgradeController.js:63-74: crossing CONTROLLER_LEVELS[level] advances the level and keeps
	// progress + effect - threshold, except that level 8 has no progress.
	for (const { key, rcl, progress } of [
		{ key: 'excess', rcl: 1, progress: (after: number) => after },
		{ key: 'levelEight', rcl: 7, progress: () => 0 },
	]) {
		test(`CTRL-UPGRADE-012:${key} an upgrade across the threshold advances the level and keeps the excess`, async ({ shard }) => {
			const work = 30;
			const short = 10;
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1', rcl, owner: 'p1', progress: CONTROLLER_LEVELS[rcl] - short }],
			});
			const ctrlPos = await shard.getControllerPos('W1N1');
			const creepId = await shard.placeCreep('W1N1', {
				pos: [ctrlPos!.x + 1, ctrlPos!.y], owner: 'p1', body: body(work, WORK, 5, CARRY, MOVE), store: { energy: 250 },
			});

			expect(await shard.runPlayer('p1', code`
				Game.getObjectById(${creepId}).upgradeController(Game.rooms['W1N1'].controller)
			`)).toBe(OK);
			const result = await shard.runPlayer('p1', code`({
				level: Game.rooms['W1N1'].controller.level,
				progress: Game.rooms['W1N1'].controller.progress,
			})`);
			expect(result).toEqual({ level: rcl + 1, progress: progress(work * UPGRADE_CONTROLLER_POWER - short) });
		});
	}

	test('CTRL-UPGRADE-015 a controller whose downgrade timer is far from its ceiling does not level up when progress crosses the threshold', async ({ shard }) => {
		// Engine upgradeController.js:63-64 gates the level-up on
		// downgradeTime + CONTROLLER_DOWNGRADE_RESTORE >= gameTime + CONTROLLER_DOWNGRADE[level].
		// When the gate fails, progress keeps accumulating past the threshold. Bots
		// see a controller stuck at RCL 1 with progress > 200 and no explanation.
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1', ticksToDowngrade: 500 }],
		});
		const ctrlPos = await shard.getControllerPos('W1N1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body: body(25, WORK, CARRY, MOVE),
			store: { energy: 500 },
		});
		await shard.tick();

		// 9 upgrades of 25 = 225 progress, past the RCL 1 threshold of 200, while
		// the timer only climbs from ~500 to ~1400: nowhere near 20000 - 100.
		for (let i = 0; i < 9; i++) {
			await shard.runPlayer('p1', code`
				Game.getObjectById(${creepId}).upgradeController(
					Game.rooms['W1N1'].controller
				)
			`);
		}

		const result = await shard.runPlayer('p1', code`({
			level: Game.rooms['W1N1'].controller.level,
			progress: Game.rooms['W1N1'].controller.progress,
			ttd: Game.rooms['W1N1'].controller.ticksToDowngrade,
		})`) as { level: number; progress: number; ttd: number };
		expect(result.level).toBe(1);
		expect(result.progress).toBe(9 * 25 * UPGRADE_CONTROLLER_POWER);
		expect(result.ttd).toBeLessThan(CONTROLLER_DOWNGRADE[1] - CONTROLLER_DOWNGRADE_RESTORE);
	});

	test('CTRL-UPGRADE-016 a level-up sets the downgrade timer to half the new level ceiling plus that tick\'s restore', async ({ shard }) => {
		// Engine upgradeController.js:68 sets downgradeTime = gameTime +
		// CONTROLLER_DOWNGRADE[newLevel] / 2 on level-up; the controller's own tick
		// (controllers/tick.js:38-42) then applies the ordinary upgraded-tick
		// restore on top, so the next read is half the ceiling + RESTORE.
		await shard.ownedRoom('p1', 'W1N1', 1);
		const ctrlPos = await shard.getControllerPos('W1N1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body: body(25, WORK, CARRY, MOVE),
			store: { energy: 500 },
		});
		await shard.tick();

		for (let i = 0; i < 8; i++) {
			await shard.runPlayer('p1', code`
				Game.getObjectById(${creepId}).upgradeController(
					Game.rooms['W1N1'].controller
				)
			`);
		}

		const result = await shard.runPlayer('p1', code`({
			level: Game.rooms['W1N1'].controller.level,
			ttd: Game.rooms['W1N1'].controller.ticksToDowngrade,
		})`) as { level: number; ttd: number };
		expect(result.level).toBe(2);
		expect(result.ttd).toBe(CONTROLLER_DOWNGRADE[2] / 2 + CONTROLLER_DOWNGRADE_RESTORE);
	});

	for (const row of ctrlUpgradeValidationCases) {
		test(`CTRL-UPGRADE-013:${row.label} upgradeController() validation returns the canonical code`, async ({ shard }) => {
			const blockers = shard.validationBlockers(row);
			const owner = blockers.has('not-owner-creep') ? 'p2' : 'p1';
			const targetRoom = blockers.has('not-owner-controller') ? 'W2N1' : 'W1N1';
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [
					{ name: 'W1N1', rcl: 2, owner: owner === 'p2' && blockers.has('busy') ? 'p2' : 'p1' },
					...(targetRoom === 'W2N1' ? [{ name: 'W2N1', rcl: 2, owner: 'p2' }] : []),
				],
			});
			const ctrlPos = await shard.getControllerPos(targetRoom);
			if (targetRoom === 'W2N1' && blockers.has('busy')) {
				await shard.placeCreep('W2N1', { pos: [20, 20], owner: 'p1', body: [MOVE] });
			}
			if (targetRoom === 'W2N1' && owner === 'p2' && !blockers.has('busy')) {
				await shard.placeCreep('W2N1', { pos: [20, 20], owner: 'p1', body: [MOVE] });
			}
			if (blockers.has('upgrade-blocked')) {
				const attackerId = await shard.placeCreep(targetRoom, {
					pos: [ctrlPos!.x, ctrlPos!.y + 1],
					owner: targetRoom === 'W1N1' ? 'p2' : 'p1',
					body: [CLAIM, MOVE],
				});
				const attackRc = await shard.runPlayer(targetRoom === 'W1N1' ? 'p2' : 'p1', code`
					Game.getObjectById(${attackerId}).attackController(Game.rooms[${targetRoom}].controller)
				`);
				expect(attackRc).toBe(OK);
				await shard.tick();
			}

			const creepId = blockers.has('busy')
				? await spawnBusyCreep(shard, {
					roomName: 'W1N1',
					owner,
					observerOwner: owner === 'p2' ? 'p1' : undefined,
					pos: blockers.has('range') || targetRoom === 'W2N1' ? [25, 25] : [ctrlPos!.x + 1, ctrlPos!.y],
					// Three parts outlast the upgrade-blocked setup's ticks.
					body: blockers.has('no-bodypart') ? [CARRY, MOVE, MOVE] : [WORK, CARRY, MOVE],
				})
				: await shard.placeCreep(targetRoom, {
					pos: blockers.has('range') ? [25, 25] : [ctrlPos!.x + 1, ctrlPos!.y],
					owner,
					body: blockers.has('no-bodypart') ? [CARRY, MOVE] : [WORK, CARRY, MOVE],
					store: blockers.has('not-enough') ? {} : { energy: 50 },
				});
			const sourceId = blockers.has('invalid-target')
				? await shard.placeSource(targetRoom, { pos: [ctrlPos!.x + 1, ctrlPos!.y + 1] })
				: null;

			const rc = blockers.has('invalid-target')
				? await shard.runPlayer('p1', code`
					Game.getObjectById(${creepId}).upgradeController(Game.getObjectById(${sourceId}))
				`)
				: await shard.runPlayer('p1', code`
					Game.getObjectById(${creepId}).upgradeController(Game.rooms[${targetRoom}].controller)
				`);
			expect(rc).toBe(row.expectedRc);
		});
	}
});
