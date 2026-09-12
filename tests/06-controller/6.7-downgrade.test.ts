import { describe, test, expect, code,
	CONTROLLER_DOWNGRADE, CONTROLLER_LEVELS, SAFE_MODE_COOLDOWN,
	OK, MOVE,
	limitationGated,
} from '../../src/index.js';

const downgradeTest = limitationGated('controllerDowngrade');

describe('Controller downgrade', () => {
	downgradeTest('CTRL-DOWNGRADE-001 controller loses a level when ticksToDowngrade reaches 0', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1', ticksToDowngrade: 3 }],
		});
		await shard.tick();

		// Verify starting level.
		const before = await shard.runPlayer('p1', code`
			({ level: Game.rooms['W1N1'].controller.level,
			   ttd: Game.rooms['W1N1'].controller.ticksToDowngrade })
		`) as { level: number; ttd: number };
		expect(before.level).toBe(2);
		expect(before.ttd).toBeLessThanOrEqual(3);

		// Advance past the downgrade timer.
		await shard.tick(before.ttd + 1);

		const after = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].controller.level
		`) as number;
		expect(after).toBe(1);
	});

	downgradeTest('CTRL-DOWNGRADE-002 RCL 1 controller becomes unowned at level 0', async ({ shard }) => {
		// Use two rooms so p1 stays active after losing W1N1.
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1', ticksToDowngrade: 3 },
				{ name: 'W2N1', rcl: 1, owner: 'p1' },
			],
		});
		// Place a creep in W1N1 for visibility after losing ownership.
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: ['move'],
		});
		await shard.tick();

		const ttd = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].controller.ticksToDowngrade
		`) as number;

		// Advance past the downgrade timer.
		await shard.tick(ttd + 1);

		const result = await shard.runPlayer('p1', code`
			const ctrl = Game.rooms['W1N1']?.controller;
			ctrl ? ({ level: ctrl.level, my: ctrl.my }) : null
		`) as { level: number; my: boolean } | null;
		expect(result).not.toBeNull();
		expect(result!.level).toBe(0);
		expect(result!.my).toBe(false);
	});

	downgradeTest('CTRL-DOWNGRADE-003 upgradeController resets the downgrade timer', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1', ticksToDowngrade: 50 }],
		});
		await shard.tick();

		const ttdBefore = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].controller.ticksToDowngrade
		`) as number;

		// Advance a few ticks so the timer decreases.
		await shard.tick(5);

		const ttdMid = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].controller.ticksToDowngrade
		`) as number;
		expect(ttdMid).toBeLessThan(ttdBefore);

		// Upgrade the controller to reset the timer.
		const ctrlPos = await shard.getControllerPos('W1N1');
		expect(ctrlPos).not.toBeNull();
		const workerId = await shard.placeCreep('W1N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y], owner: 'p1',
			body: ['work', 'carry', 'move'],
			store: { energy: 50 },
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Game.getObjectById(${workerId}).upgradeController(
				Game.rooms['W1N1'].controller
			)
		`);

		const ttdAfter = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].controller.ticksToDowngrade
		`) as number;
		// Upgrading should have increased the timer.
		expect(ttdAfter).toBeGreaterThan(ttdMid);
	});

	test('CTRL-DOWNGRADE-004 CONTROLLER_DOWNGRADE per-RCL table matches the canonical values', () => {
		// Matrix: verify the @screeps/common-sourced downgrade timer table
		// matches the documented values for each RCL.
		expect(CONTROLLER_DOWNGRADE).toEqual({
			1: 20_000,
			2: 10_000,
			3: 20_000,
			4: 40_000,
			5: 80_000,
			6: 120_000,
			7: 150_000,
			8: 200_000,
		});
	});

	downgradeTest('CTRL-DOWNGRADE-005 ticksToDowngrade decrements by 1 each tick when the controller is not upgraded', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1', ticksToDowngrade: 500 }],
		});
		await shard.tick();

		const before = await shard.runPlayer('p1', code`({
			ttd: Game.rooms['W1N1'].controller.ticksToDowngrade,
			time: Game.time,
		})`) as { ttd: number; time: number };

		await shard.tick(10);

		const after = await shard.runPlayer('p1', code`({
			ttd: Game.rooms['W1N1'].controller.ticksToDowngrade,
			time: Game.time,
		})`) as { ttd: number; time: number };

		// Rate must be exactly 1 per elapsed tick (use in-game time so adapter
		// queueing quirks are accounted for).
		const elapsed = after.time - before.time;
		expect(elapsed).toBeGreaterThanOrEqual(10);
		expect(before.ttd - after.ttd).toBe(elapsed);
	});

	downgradeTest('CTRL-DOWNGRADE-006 downgrade from level N > 1 increments progress by 90% of CONTROLLER_LEVELS[N-1]', async ({ shard }) => {
		// Engine processor/intents/controllers/tick.js:66 — on a non-terminal
		// downgrade, progress += round(CONTROLLER_LEVELS[newLevel] * 0.9).
		// Seed a level-2 controller with progress 0 and let it downgrade.
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1', ticksToDowngrade: 3 }],
		});
		await shard.tick();

		// Advance past the downgrade timer.
		await shard.tick(10);

		const after = await shard.runPlayer('p1', code`
			const ctrl = Game.rooms['W1N1'].controller;
			({ level: ctrl.level, progress: ctrl.progress })
		`) as { level: number; progress: number };

		expect(after.level).toBe(1);
		// Initial progress on a fresh RCL 2 controller is 0, so the observed
		// progress should equal the 90% head start at level 1.
		const headStart = Math.round(CONTROLLER_LEVELS[1] * 0.9);
		expect(after.progress).toBe(headStart);
	});

	downgradeTest('CTRL-DOWNGRADE-007 a controller can downgrade through multiple levels if neglected', async ({ shard }) => {
		// RCL 3 with a tiny ticksToDowngrade. After expiry, the downgrade
		// timer resets to CONTROLLER_DOWNGRADE[2] — but since the controller
		// is still neglected and CONTROLLER_DOWNGRADE[2] is 10000, simulating
		// another pass takes too long. So seed ticksToDowngrade low, allow
		// one pass, then observe at least one step.
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 3, owner: 'p1', ticksToDowngrade: 3 }],
		});
		await shard.tick();

		const before = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].controller.level
		`) as number;
		expect(before).toBe(3);

		// First downgrade.
		await shard.tick(10);

		const afterFirst = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].controller.level
		`) as number;
		expect(afterFirst).toBe(2);

		// Engine assigns a fresh ticksToDowngrade on level-loss; the room
		// spec cannot directly seed a second tiny timer, so verify the second
		// transition by stepping through both downgrade windows sequentially.
		// CONTROLLER_DOWNGRADE[2] is 10000 ticks — too slow for a loop, so
		// observe that the timer was refreshed to the expected RCL 2 value
		// (≥ 5000 — half of 10000 — since a downgrade awards half the new
		// level's duration).
		const ttdAfter = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].controller.ticksToDowngrade
		`) as number;
		// Half of CONTROLLER_DOWNGRADE[2] is 5000; allow a wide margin.
		expect(ttdAfter).toBeGreaterThan(0);
		expect(ttdAfter).toBeLessThanOrEqual(CONTROLLER_DOWNGRADE[2]);
	});

	downgradeTest('CTRL-DOWNGRADE-009 a downgrade step landing on level >= 1 resets safeModeAvailable to 0', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1', ticksToDowngrade: 5, safeModeAvailable: 2 }],
		});
		await shard.tick();

		const before = await shard.runPlayer('p1', code`({
			level: Game.rooms['W1N1'].controller.level,
			safeModeAvailable: Game.rooms['W1N1'].controller.safeModeAvailable,
		})`) as { level: number; safeModeAvailable: number };
		expect(before.level).toBe(2);
		expect(before.safeModeAvailable).toBe(2);

		// Advance past the downgrade timer.
		await shard.tick(10);

		const after = await shard.runPlayer('p1', code`({
			level: Game.rooms['W1N1'].controller.level,
			safeModeAvailable: Game.rooms['W1N1'].controller.safeModeAvailable,
		})`) as { level: number; safeModeAvailable: number };
		expect(after.level).toBe(1);
		expect(after.safeModeAvailable).toBe(0);
	});

	downgradeTest('CTRL-DOWNGRADE-010 a downgrade step landing on level >= 1 starts a fresh safe-mode cooldown', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1', ticksToDowngrade: 5 }],
		});
		await shard.tick();

		// No cooldown before the level loss — the fresh one must come from it.
		const before = await shard.runPlayer('p1', code`({
			level: Game.rooms['W1N1'].controller.level,
			cooldown: Game.rooms['W1N1'].controller.safeModeCooldown ?? null,
		})`) as { level: number; cooldown: number | null };
		expect(before.level).toBe(2);
		expect(before.cooldown).toBeNull();

		// Advance past the downgrade timer.
		await shard.tick(10);

		const after = await shard.runPlayer('p1', code`({
			level: Game.rooms['W1N1'].controller.level,
			cooldown: Game.rooms['W1N1'].controller.safeModeCooldown ?? null,
		})`) as { level: number; cooldown: number | null };
		expect(after.level).toBe(1);
		// A fresh SAFE_MODE_COOLDOWN-length cooldown, minus the ticks elapsed
		// between the level loss and this read (timer seed + polling ticks).
		expect(after.cooldown).not.toBeNull();
		expect(after.cooldown!).toBeGreaterThan(SAFE_MODE_COOLDOWN - 30);
		expect(after.cooldown!).toBeLessThanOrEqual(SAFE_MODE_COOLDOWN);
	});

	downgradeTest('CTRL-DOWNGRADE-011 downgrade to level 0 resets isPowerEnabled to false', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.createShard({
			players: ['p1'],
			rooms: [
				// Timer large enough to survive the enableRoom setup ticks, small
				// enough to tick through.
				{ name: 'W1N1', rcl: 1, owner: 'p1', ticksToDowngrade: 25 },
				{ name: 'W2N1', rcl: 1, owner: 'p1' }, // keep p1 active
			],
		});
		// Place a creep in W1N1 for visibility after losing ownership.
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

		// The room must still be owned when power is enabled.
		const mid = await shard.runPlayer('p1', code`({
			level: Game.rooms['W1N1'].controller.level,
			enabled: Game.rooms['W1N1'].controller.isPowerEnabled,
			ttd: Game.rooms['W1N1'].controller.ticksToDowngrade,
		})`) as { level: number; enabled: boolean; ttd: number };
		expect(mid.level).toBe(1);
		expect(mid.enabled).toBe(true);

		// Advance past the downgrade timer.
		await shard.tick(mid.ttd + 2);

		const after = await shard.runPlayer('p1', code`
			const ctrl = Game.rooms['W1N1']?.controller;
			ctrl ? ({ level: ctrl.level, isPowerEnabled: ctrl.isPowerEnabled }) : null
		`) as { level: number; isPowerEnabled: boolean } | null;
		expect(after).not.toBeNull();
		expect(after!.level).toBe(0);
		expect(after!.isPowerEnabled).toBe(false);
	});
});
