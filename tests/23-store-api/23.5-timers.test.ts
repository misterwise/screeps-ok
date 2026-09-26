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

		// Anchored on the reaction tick: refused while it reads 1, allowed at 0.
		const cooldown = REACTION_TIME.OH;
		const first = await shard.runPlayer('p1', code`Game.getObjectById(${labId}).cooldown`);
		expect(first).toBe(cooldown - 1);
		await shard.tick(cooldown - 3);
		const react = code`
			const lab = Game.getObjectById(${labId});
			({ cooldown: lab.cooldown, rc: lab.runReaction(Game.getObjectById(${lab1}), Game.getObjectById(${lab2})) })
		`;
		expect(await shard.runPlayer('p1', react)).toEqual({ cooldown: 1, rc: ERR_TIRED });
		expect(await shard.runPlayer('p1', react)).toEqual({ cooldown: 0, rc: OK });
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
		// Seeded 10 at creation; one tick has elapsed.
		expect(sm0).toBe(9);

		// While safe mode is active, the hostile attack is short-circuited
		// to ERR_NO_BODYPART (same path covered by CTRL-SAFEMODE-006).
		const blockedRc = await shard.runPlayer('p2', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${rampartId}))
		`);
		expect(blockedRc).toBe(ERR_NO_BODYPART);

		// Four ticks separate the reads: sm0's, the blocked attack, and tick(2).
		await shard.tick(2);
		const sm1 = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].controller.safeMode ?? 0
		`) as number;
		expect(sm1).toBe(sm0 - 4);

		// Run to the last safe-mode tick; the attack is blocked while it reads 1
		// and allowed on the next tick, when the getter reports undefined.
		await shard.tick(sm1 - 2);
		const probe = code`({
			safeMode: Game.rooms['W1N1'].controller.safeMode ?? null,
			rc: Game.getObjectById(${attackerId}).attack(Game.getObjectById(${rampartId})),
		})`;
		expect(await shard.runPlayer('p2', probe)).toEqual({ safeMode: 1, rc: ERR_NO_BODYPART });
		expect(await shard.runPlayer('p2', probe)).toEqual({ safeMode: null, rc: OK });
	});
});
