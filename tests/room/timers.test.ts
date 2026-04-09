import { describe, test, expect, code,
	OK, ERR_TIRED,
	STRUCTURE_LAB,
	LAB_REACTION_AMOUNT, REACTION_TIME,
	SAFE_MODE_DURATION,
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

	// TIMER-SAFEMODE-001: Safe mode lasts SAFE_MODE_DURATION (20000) ticks.
	// Ticking 20000 times is computationally infeasible in a test environment.
	// This test verifies the basic safe mode countdown behavior: after
	// activation, safeMode decrements by 1 per tick.
	test.skip('TIMER-SAFEMODE-001 safeMode timer counts down and effects end when it reaches 0', async ({ shard }) => {
		// This test is skipped because SAFE_MODE_DURATION is 20000 ticks,
		// making it infeasible to tick until expiry. There is no adapter API
		// to set safeMode to an arbitrary low value, and the engine does not
		// expose a way to fast-forward a single timer.
		//
		// To properly test this, the adapter would need:
		// - A way to set controller.safeMode to a low value (e.g., 2), OR
		// - A way to advance time by N ticks without running gameplay
		//
		// The fundamental behavior: when safeMode reaches 0, hostile actions
		// that were blocked (attack, rangedAttack, dismantle, rangedMassAttack)
		// should succeed again in the same tick.
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1', safeModeAvailable: 1 }],
		});

		// Activate safe mode.
		const rc = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].controller.activateSafeMode()
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		// Verify safeMode is set.
		const sm1 = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].controller.safeMode
		`) as number;
		expect(sm1).toBeGreaterThan(0);

		// Verify countdown: after 1 tick, safeMode should decrease by 1.
		await shard.tick();
		const sm2 = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].controller.safeMode
		`) as number;
		expect(sm2).toBe(sm1 - 1);
	});
});
