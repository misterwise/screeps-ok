import { describe, test, expect, code,
	OK, ERR_NOT_ENOUGH_RESOURCES, ERR_TIRED, ERR_BUSY, ERR_NO_BODYPART,
	MOVE, ATTACK, RANGED_ATTACK, WORK,
	STRUCTURE_RAMPART,
	CONTROLLER_DOWNGRADE_SAFEMODE_THRESHOLD,
	limitationGated,
} from '../../src/index.js';
import { safeModeBlockedActionCases } from '../../src/matrices/ctrl-safemode-blocked.js';

const downgradeTest = limitationGated('controllerDowngrade');

describe('Safe mode mechanics', () => {
	// ---- CTRL-SAFEMODE-001: activation consumes a charge and starts safe mode ----
	test('CTRL-SAFEMODE-001 activateSafeMode returns OK, consumes one charge, and starts safe mode', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1', safeModeAvailable: 2 }],
		});

		const result = await shard.runPlayer('p1', code`
			const ctrl = Game.rooms['W1N1'].controller;
			const rc = ctrl.activateSafeMode();
			({ rc, availBefore: 2, availAfterIntent: ctrl.safeModeAvailable })
		`) as { rc: number; availBefore: number; availAfterIntent: number };
		expect(result.rc).toBe(OK);

		// After tick processes the intent
		await shard.tick();
		const after = await shard.runPlayer('p1', code`
			const ctrl = Game.rooms['W1N1'].controller;
			({ safeMode: ctrl.safeMode, safeModeAvailable: ctrl.safeModeAvailable })
		`) as { safeMode: number; safeModeAvailable: number };
		expect(after.safeModeAvailable).toBe(1);
		expect(after.safeMode).toBeGreaterThan(0);
	});

	// ---- CTRL-SAFEMODE-002: cooldown period after activation ----
	test('CTRL-SAFEMODE-002 activateSafeMode starts a cooldown period', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1', safeModeAvailable: 1 }],
		});

		const rc = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].controller.activateSafeMode()
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const cooldown = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].controller.safeModeCooldown
		`) as number;
		expect(cooldown).toBeGreaterThan(0);
	});

	// ---- CTRL-SAFEMODE-003: ERR_NOT_ENOUGH_RESOURCES when no charges ----
	test('CTRL-SAFEMODE-003 activateSafeMode returns ERR_NOT_ENOUGH_RESOURCES when safeModeAvailable is 0', async ({ shard }) => {
		await shard.ownedRoom('p1'); // default safeModeAvailable=0

		const rc = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].controller.activateSafeMode()
		`);
		expect(rc).toBe(ERR_NOT_ENOUGH_RESOURCES);
	});

	// ---- CTRL-SAFEMODE-004: ERR_TIRED when cooldown is active ----
	test('CTRL-SAFEMODE-004 activateSafeMode returns ERR_TIRED when safe mode cooldown is active', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1', safeModeAvailable: 2 }],
		});

		// Activate once to start cooldown.
		const rc1 = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].controller.activateSafeMode()
		`);
		expect(rc1).toBe(OK);
		await shard.tick();

		// Safe mode is now active with cooldown. Try to activate again.
		const rc2 = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].controller.activateSafeMode()
		`);
		expect(rc2).toBe(ERR_TIRED);
	});

	test('CTRL-SAFEMODE-007 activateSafeMode returns ERR_BUSY when another owned controller already has active safe mode', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1', safeModeAvailable: 1 },
				{ name: 'W2N1', rcl: 1, owner: 'p1', safeModeAvailable: 1 },
			],
		});

		// Place a creep in W2N1 so p1 has visibility there.
		await shard.placeCreep('W2N1', { pos: [25, 25], owner: 'p1', body: [MOVE] });

		// Activate safe mode on first room.
		const rc1 = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].controller.activateSafeMode()
		`);
		expect(rc1).toBe(OK);
		await shard.tick();

		// Try to activate on second room — should fail with ERR_BUSY.
		const rc2 = await shard.runPlayer('p1', code`
			Game.rooms['W2N1'].controller.activateSafeMode()
		`);
		expect(rc2).toBe(ERR_BUSY);
	});

	// ---- CTRL-SAFEMODE-005: downgrade timer below threshold ----
	downgradeTest('CTRL-SAFEMODE-005 activateSafeMode fails when downgrade timer is below CONTROLLER_DOWNGRADE_SAFEMODE_THRESHOLD', async ({ shard }) => {
		// Use RCL 4 where CONTROLLER_DOWNGRADE[4]/2 - threshold = 15000.
		// ticksToDowngrade=100 is well below 15000 so ERR_TIRED is expected.
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 4, owner: 'p1', safeModeAvailable: 1, ticksToDowngrade: 100 }],
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const ctrl = Game.rooms['W1N1'].controller;
			({ rc: ctrl.activateSafeMode(), ttd: ctrl.ticksToDowngrade })
		`) as { rc: number; ttd: number };

		// Verify the downgrade timer is actually below the threshold.
		expect(result.ttd).toBeLessThan(CONTROLLER_DOWNGRADE_SAFEMODE_THRESHOLD);
		// activateSafeMode must not return OK.
		expect(result.rc).not.toBe(OK);

		// Confirm safe mode did not activate after the tick processes.
		await shard.tick();
		const after = await shard.runPlayer('p1', code`
			const ctrl = Game.rooms['W1N1'].controller;
			({ safeMode: ctrl.safeMode, safeModeAvailable: ctrl.safeModeAvailable })
		`) as { safeMode: number | undefined; safeModeAvailable: number };
		expect(after.safeMode).toBeFalsy();
		expect(after.safeModeAvailable).toBe(1);
	});

	// ---- CTRL-SAFEMODE-006: hostile actions blocked matrix ----
	// Build the body needed for each action type.
	const actionBodyMap: Record<string, string[]> = {
		attack: [ATTACK, MOVE],
		rangedAttack: [RANGED_ATTACK, MOVE],
		rangedMassAttack: [RANGED_ATTACK, MOVE],
		dismantle: [WORK, MOVE],
	};

	for (const { label, method } of safeModeBlockedActionCases) {
		test(`CTRL-SAFEMODE-006:${label} hostile ${label} deals no damage under safe mode`, async ({ shard }) => {
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [
					{ name: 'W1N1', rcl: 1, owner: 'p1', safeModeAvailable: 1 },
					{ name: 'W2N1', rcl: 1, owner: 'p2' },
				],
			});

			// Activate safe mode in p1's room.
			const smRc = await shard.runPlayer('p1', code`
				Game.rooms['W1N1'].controller.activateSafeMode()
			`);
			expect(smRc).toBe(OK);
			await shard.tick();

			// Place a target (rampart) for the hostile creep to attack/dismantle.
			const rampartId = await shard.placeStructure('W1N1', {
				pos: [25, 25], structureType: STRUCTURE_RAMPART, owner: 'p1',
				hits: 10000,
			});
			const body = actionBodyMap[method];
			const creepId = await shard.placeCreep('W1N1', {
				pos: [25, 26], owner: 'p2', body,
			});
			await shard.tick();

			// Issue hostile action — each method needs its own code template
			// since code`` serializes interpolated values, not code fragments.
			let rc: unknown;
			if (method === 'attack') {
				rc = await shard.runPlayer('p2', code`
					Game.getObjectById(${creepId}).attack(Game.getObjectById(${rampartId}))
				`);
			} else if (method === 'rangedAttack') {
				rc = await shard.runPlayer('p2', code`
					Game.getObjectById(${creepId}).rangedAttack(Game.getObjectById(${rampartId}))
				`);
			} else if (method === 'rangedMassAttack') {
				rc = await shard.runPlayer('p2', code`
					Game.getObjectById(${creepId}).rangedMassAttack()
				`);
			} else {
				// dismantle
				rc = await shard.runPlayer('p2', code`
					Game.getObjectById(${creepId}).dismantle(Game.getObjectById(${rampartId}))
				`);
			}
			// Safe mode blocks hostile combat intents with ERR_NO_BODYPART.
			expect(rc).toBe(ERR_NO_BODYPART);
		});
	}
});
