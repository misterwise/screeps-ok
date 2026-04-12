import { describe, test, expect, code,
	OK, ERR_TIRED, ERR_NO_BODYPART,
	STRUCTURE_LAB, STRUCTURE_RAMPART,
	ATTACK, MOVE,
	LAB_REACTION_AMOUNT, REACTION_TIME,
} from '../../src/index.js';

describe('Timer gating', () => {
	test('TIMER-COOLDOWN-001 action gated by cooldownTime becomes available on the tick cooldown reaches 0', async ({ shard }) => {
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);

		// Set up three labs for H + O -> OH reaction.
		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000 },
		});
		const lab1 = await shard.placeStructure('W1N1', {
			pos: [25, 27], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000, H: 500 },
		});
		const lab2 = await shard.placeStructure('W1N1', {
			pos: [27, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000, O: 500 },
		});

		// First reaction to trigger cooldown.
		const rc1 = await shard.runPlayer('p1', code`
			const lab = Game.getObjectById(${labId});
			lab.runReaction(Game.getObjectById(${lab1}), Game.getObjectById(${lab2}))
		`);
		expect(rc1).toBe(OK);

		// Read the cooldown after the first reaction tick.
		const labAfter = await shard.expectStructure(labId, STRUCTURE_LAB);
		const cooldownAfterReaction = labAfter.cooldown;
		expect(cooldownAfterReaction).toBeGreaterThan(0);

		// Tick until cooldown is 0. Each tick decrements cooldown by 1.
		// We need (cooldownAfterReaction) more ticks to reach 0.
		if (cooldownAfterReaction > 1) {
			await shard.tick(cooldownAfterReaction - 1);
		}

		// Verify cooldown is now 0 (or will be 0 after one more tick processing).
		// The lab should report cooldown 0 or 1 at this point.
		const labMid = await shard.expectStructure(labId, STRUCTURE_LAB);
		// After cooldownAfterReaction - 1 additional ticks, cooldown should be 1 or 0.
		// We need it to reach exactly 0 for the next reaction to succeed.
		if (labMid.cooldown > 0) {
			await shard.tick(labMid.cooldown);
		}

		// Now cooldown should be 0 — verify.
		const labReady = await shard.expectStructure(labId, STRUCTURE_LAB);
		expect(labReady.cooldown).toBe(0);

		// Run another reaction — should succeed on the same tick cooldown is 0.
		const rc2 = await shard.runPlayer('p1', code`
			const lab = Game.getObjectById(${labId});
			lab.runReaction(Game.getObjectById(${lab1}), Game.getObjectById(${lab2}))
		`);
		expect(rc2).toBe(OK);
	});

	test('TIMER-SAFEMODE-001 safeMode timer counts down and effects end when it reaches 0', async ({ shard }) => {
		// SAFE_MODE_DURATION is 20000 ticks, which is infeasible to tick
		// through end-to-end. RoomSpec.safeMode pre-sets the active timer
		// to a low remaining-tick value so the expiration path is reachable
		// in a few ticks. The getter at `structures.js:187` returns
		// `safeMode - gameTime` (or undefined when safeMode <= gameTime).
		// Note: each runPlayer call advances gameTime by 1 (the eval rides
		// on the next engine tick), so reads also consume time.
		//
		// This test owns the post-expiration "effects end" assertion: no
		// other test in the suite verifies that hostile combat actions
		// blocked during safe mode become unblocked once the timer hits 0.
		// CTRL-SAFEMODE-006 only checks the during-safemode block path.
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1', safeMode: 10 }],
		});

		// Friendly target + hostile attacker for the unblock probe.
		const rampartId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_RAMPART, owner: 'p1',
			hits: 10000,
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2', body: [ATTACK, MOVE],
		});
		await shard.tick();

		const sm0 = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].controller.safeMode ?? 0
		`) as number;
		expect(sm0).toBeGreaterThan(0);
		expect(sm0).toBeLessThanOrEqual(10);

		// While safe mode is active, the hostile attack is short-circuited
		// to ERR_NO_BODYPART (same path covered by CTRL-SAFEMODE-006).
		const blockedRc = await shard.runPlayer('p2', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${rampartId}))
		`);
		expect(blockedRc).toBe(ERR_NO_BODYPART);

		// Drive a few ticks and confirm the timer counted down.
		await shard.tick(2);
		const sm1 = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].controller.safeMode ?? 0
		`) as number;
		expect(sm1).toBeGreaterThan(0);
		expect(sm1).toBeLessThan(sm0);

		// Drive well past expiration; the engine reports undefined once
		// safeMode <= gameTime, which we map to null in the test return.
		await shard.tick(sm1 + 5);
		const smExpired = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].controller.safeMode ?? null
		`);
		expect(smExpired).toBeNull();

		// With safe mode expired, the same hostile attack now succeeds.
		const unblockedRc = await shard.runPlayer('p2', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${rampartId}))
		`);
		expect(unblockedRc).toBe(OK);
	});
});
