import { describe, test, expect, code,
	OK,
	MOVE, CLAIM,
	CONTROLLER_DOWNGRADE_SAFEMODE_THRESHOLD, CONTROLLER_DOWNGRADE, SAFE_MODE_DURATION, SAFE_MODE_COOLDOWN,
} from '../../src/index.js';
import { ctrlSafemodeValidationCases } from '../../src/matrices/ctrl-safemode-validation.js';

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
		expect(after.safeMode).toBe(SAFE_MODE_DURATION - 2);
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
		expect(cooldown).toBe(SAFE_MODE_COOLDOWN - 2);
	});

	// ---- CTRL-SAFEMODE-008: same-tick double activation dedupe ----
	test('CTRL-SAFEMODE-008 same-tick activateSafeMode on two controllers processes only the most recent intent', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1', safeModeAvailable: 1 },
				{ name: 'W2N1', rcl: 1, owner: 'p1', safeModeAvailable: 1 },
			],
		});

		// Place a creep in W2N1 so p1 has visibility there.
		await shard.placeCreep('W2N1', { pos: [25, 25], owner: 'p1', body: [MOVE] });

		// Issue both activations in the same tick. The runtime's safeMode scan
		// sees no active safe mode yet (the processor hasn't run), so both calls
		// return OK — the engine dedupes by dropping the earlier intent.
		const result = await shard.runPlayer('p1', code`
			const rc1 = Game.rooms['W1N1'].controller.activateSafeMode();
			const rc2 = Game.rooms['W2N1'].controller.activateSafeMode();
			({ rc1, rc2 })
		`) as { rc1: number; rc2: number };
		expect(result.rc1).toBe(OK);
		expect(result.rc2).toBe(OK);

		await shard.tick();

		const after = await shard.runPlayer('p1', code`
			const w1 = Game.rooms['W1N1'].controller;
			const w2 = Game.rooms['W2N1'].controller;
			({
				w1SafeMode: w1.safeMode,
				w1Available: w1.safeModeAvailable,
				w2SafeMode: w2.safeMode,
				w2Available: w2.safeModeAvailable,
			})
		`) as {
			w1SafeMode: number | undefined;
			w1Available: number;
			w2SafeMode: number;
			w2Available: number;
		};

		// First intent was dropped: W1N1 never entered safe mode and kept its charge.
		expect(after.w1SafeMode).toBeUndefined();
		expect(after.w1Available).toBe(1);

		// Second intent processed: W2N1 consumed its charge and entered safe mode.
		expect(after.w2Available).toBe(0);
		expect(after.w2SafeMode).toBe(SAFE_MODE_DURATION - 2);
	});

	for (const row of ctrlSafemodeValidationCases) {
		test(`CTRL-SAFEMODE-009:${row.label} activateSafeMode() validation returns the canonical code`, async ({ shard }) => {
			const blockers = shard.validationBlockers(row);
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [
					{
						name: 'W1N1',
						rcl: 1,
						owner: 'p1',
						safeModeAvailable: blockers.has('not-enough') ? blockers.has('cooldown') ? 1 : 0 : 2,
						...(blockers.has('downgrade-timer')
							? { ticksToDowngrade: CONTROLLER_DOWNGRADE[1] / 2 - CONTROLLER_DOWNGRADE_SAFEMODE_THRESHOLD - 1 }
							: {}),
					},
					...(blockers.has('busy') ? [{ name: 'W2N1', rcl: 1, owner: 'p1', safeModeAvailable: 1 }] : []),
				],
			});
			if (blockers.has('not-owner')) {
				await shard.placeCreep('W1N1', { pos: [25, 25], owner: 'p2', body: [MOVE] });
			}
			if (blockers.has('upgrade-blocked')) {
				const ctrlPos = await shard.getControllerPos('W1N1');
				const attackerId = await shard.placeCreep('W1N1', {
					pos: [ctrlPos!.x + 1, ctrlPos!.y], owner: 'p2', body: [CLAIM, MOVE],
				});
				await shard.tick();
				const attackRc = await shard.runPlayer('p2', code`
					Game.getObjectById(${attackerId}).attackController(Game.rooms['W1N1'].controller)
				`);
				expect(attackRc).toBe(OK);
			}
			if (blockers.has('busy')) {
				await shard.placeCreep('W2N1', { pos: [25, 25], owner: 'p1', body: [MOVE] });
				const busyRc = await shard.runPlayer('p1', code`
					Game.rooms['W2N1'].controller.activateSafeMode()
				`);
				expect(busyRc).toBe(OK);
				await shard.tick();
			}
			if (blockers.has('cooldown')) {
				const cooldownRc = await shard.runPlayer('p1', code`
					Game.rooms['W1N1'].controller.activateSafeMode()
				`);
				expect(cooldownRc).toBe(OK);
				await shard.tick();
			}

			const caller = blockers.has('not-owner') ? 'p2' : 'p1';
			const rc = await shard.runPlayer(caller, code`
				Game.rooms['W1N1'].controller.activateSafeMode()
			`);
			expect(rc).toBe(row.expectedRc);
		});
	}
});
