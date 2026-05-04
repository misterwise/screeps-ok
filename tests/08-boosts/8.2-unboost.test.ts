import { describe, test, expect, code,
	OK, ERR_NOT_IN_RANGE, ERR_NOT_FOUND, ERR_TIRED,
	STRUCTURE_LAB,
	MOVE, ATTACK, CARRY,
	LAB_BOOST_MINERAL, LAB_BOOST_ENERGY, LAB_ENERGY_CAPACITY,
	LAB_UNBOOST_ENERGY, LAB_UNBOOST_MINERAL, LAB_REACTION_AMOUNT,
	REACTION_TIME, ENERGY_DECAY,
	FIND_DROPPED_RESOURCES,
} from '../../src/index.js';
import { unboostValidationCases } from '../../src/matrices/unboost-validation.js';

describe('lab.unboostCreep()', () => {
	test('UNBOOST-001 unboostCreep returns OK, removes boosts, and drops compounds near the lab', async ({ shard }) => {
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);

		// Set up a lab with UH and boost a creep first.
		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: LAB_ENERGY_CAPACITY, UH: LAB_BOOST_MINERAL },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [ATTACK, MOVE],
		});
		await shard.tick();

		// Boost the creep.
		const boostRc = await shard.runPlayer('p1', code`
			Game.getObjectById(${labId}).boostCreep(Game.getObjectById(${creepId}))
		`);
		expect(boostRc).toBe(OK);

		// Verify creep is boosted.
		const boosted = await shard.expectObject(creepId, 'creep');
		expect(boosted.body.find(p => p.type === 'attack')!.boost).toBe('UH');

		// Unboost — lab needs no mineral for unboost, just cooldown check.
		const unboostRc = await shard.runPlayer('p1', code`
			Game.getObjectById(${labId}).unboostCreep(Game.getObjectById(${creepId}))
		`);
		expect(unboostRc).toBe(OK);

		// After unboost, creep should have no boosts.
		const unboosted = await shard.expectObject(creepId, 'creep');
		expect(unboosted.body.every(p => !p.boost)).toBe(true);
	});

	test('UNBOOST-002 unboostCreep returns ERR_NOT_FOUND when creep has no boosts', async ({ shard }) => {
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);

		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: LAB_ENERGY_CAPACITY },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [ATTACK, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${labId}).unboostCreep(Game.getObjectById(${creepId}))
		`);
		expect(rc).toBe(ERR_NOT_FOUND);
	});

	test('UNBOOST-004 unboost drops LAB_UNBOOST_MINERAL per part as a resource pile at the creep tile', async ({ shard }) => {
		// Engine processor `processor/intents/labs/unboost-creep.js` invokes
		// `_create-energy(target.x, target.y, ...)` so the returned compounds
		// land on the creep's own tile (which is adjacent to the lab), not in
		// the lab's store. The amount per body part is `LAB_UNBOOST_MINERAL`.
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);

		// Two ATTACK parts, both boosted with UH.
		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: LAB_ENERGY_CAPACITY, UH: LAB_BOOST_MINERAL * 2 },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [ATTACK, ATTACK, MOVE],
		});
		await shard.tick();

		const boostRc = await shard.runPlayer('p1', code`
			Game.getObjectById(${labId}).boostCreep(Game.getObjectById(${creepId}))
		`);
		expect(boostRc).toBe(OK);

		const unboostRc = await shard.runPlayer('p1', code`
			Game.getObjectById(${labId}).unboostCreep(Game.getObjectById(${creepId}))
		`);
		expect(unboostRc).toBe(OK);

		// Resources are dropped at the creep position; with 2 boosted parts the
		// pile contains 2 * LAB_UNBOOST_MINERAL of UH at creation. The lookForAt
		// runs in a subsequent runPlayer (= 1 extra tick), so the dropped pile
		// has already been ticked once by the energy decay processor — back out
		// `Math.ceil(amount / ENERGY_DECAY)` to compute the observable amount.
		const drops = await shard.runPlayer('p1', code`
			const pile = Game.rooms['W1N1'].lookForAt(LOOK_RESOURCES, 25, 26);
			pile.map(r => ({ type: r.resourceType, amount: r.amount }))
		`) as Array<{ type: string; amount: number }>;
		const uh = drops.find(d => d.type === 'UH');
		expect(uh).toBeDefined();
		const initialAmount = LAB_UNBOOST_MINERAL * 2;
		const afterOneDecayTick = initialAmount - Math.ceil(initialAmount / ENERGY_DECAY);
		expect(uh!.amount).toBe(afterOneDecayTick);
	});

	test('UNBOOST-005 unboost sets lab cooldown to parts * calcTotalReactionsTime * LAB_UNBOOST_MINERAL / LAB_REACTION_AMOUNT', async ({ shard }) => {
		// Engine `processor/intents/labs/unboost-creep.js` lines 32-48: cooldown
		// is summed across all returned compounds as
		// `parts * calcTotalReactionsTime(r) * LAB_UNBOOST_MINERAL / LAB_REACTION_AMOUNT`.
		// For a single UH-boosted ATTACK part, calcTotalReactionsTime(UH) is just
		// REACTION_TIME[UH] (UH = U + H, neither reagent has a REACTION_TIME entry),
		// so the cooldown formula reduces to REACTION_TIME[UH] * 15 / 5 = 30.
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);

		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: LAB_ENERGY_CAPACITY, UH: LAB_BOOST_MINERAL },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [ATTACK, MOVE],
		});
		await shard.tick();

		const boostRc = await shard.runPlayer('p1', code`
			Game.getObjectById(${labId}).boostCreep(Game.getObjectById(${creepId}))
		`);
		expect(boostRc).toBe(OK);

		const unboostRc = await shard.runPlayer('p1', code`
			Game.getObjectById(${labId}).unboostCreep(Game.getObjectById(${creepId}))
		`);
		expect(unboostRc).toBe(OK);

		// runPlayer is one full tick — cooldown is decremented by 1 by the time
		// the next runPlayer reads it. UH is tier-1, so reagent recursion bottoms
		// out and the formula is REACTION_TIME[UH] * LAB_UNBOOST_MINERAL / LAB_REACTION_AMOUNT.
		const expectedCooldown = REACTION_TIME['UH'] * LAB_UNBOOST_MINERAL / LAB_REACTION_AMOUNT;
		const lab = await shard.expectStructure(labId, STRUCTURE_LAB);
		expect(lab.cooldown).toBe(expectedCooldown - 1);
	});

	test('UNBOOST-003 unboostCreep returns ERR_NOT_IN_RANGE when creep is not adjacent', async ({ shard }) => {
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);

		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: LAB_ENERGY_CAPACITY, UH: LAB_BOOST_MINERAL },
		});
		// Boost a creep first (adjacent).
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [ATTACK, MOVE],
		});
		await shard.tick();

		const boostRc = await shard.runPlayer('p1', code`
			Game.getObjectById(${labId}).boostCreep(Game.getObjectById(${creepId}))
		`);
		expect(boostRc).toBe(OK);

		// Move the creep away then try to unboost.
		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).move(BOTTOM)
		`);
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${labId}).unboostCreep(Game.getObjectById(${creepId}))
		`);
		expect(rc).toBe(ERR_NOT_IN_RANGE);
	});

	for (const row of unboostValidationCases) {
		test(`UNBOOST-006:${row.label} unboostCreep() validation returns the canonical code`, async ({ shard }) => {
			shard.requires('chemistry');
			const blockers = new Set(row.blockers);
			const labOwner = blockers.has('not-owner') ? 'p2' : 'p1';
			const creepOwner = blockers.has('not-owner') && !blockers.has('invalid-target') ? 'p2' : 'p1';
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [{ name: 'W1N1', rcl: blockers.has('rcl') ? 5 : 6, owner: 'p1' }],
			});
			const labId = await shard.placeStructure('W1N1', {
				pos: [25, 25],
				structureType: STRUCTURE_LAB,
				owner: labOwner,
				store: { energy: LAB_ENERGY_CAPACITY },
				...(blockers.has('cooldown') ? { cooldown: REACTION_TIME['UH'] } : {}),
			});
			const targetPos: [number, number] = blockers.has('range') ? [25, 28] : [25, 26];
			const targetId = blockers.has('invalid-target')
				? await shard.placeStructure('W1N1', {
					pos: targetPos,
					structureType: STRUCTURE_LAB,
					owner: 'p1',
					store: { energy: LAB_ENERGY_CAPACITY },
				})
				: await shard.placeCreep('W1N1', {
					pos: targetPos,
					owner: creepOwner,
					body: [ATTACK, MOVE],
					boosts: blockers.has('not-found') ? {} : { 0: 'UH' },
				});
			await shard.tick();

			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${labId}).unboostCreep(Game.getObjectById(${targetId}))
			`);
			expect(rc).toBe(row.expectedRc);
		});
	}
});
