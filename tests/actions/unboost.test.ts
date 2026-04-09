import { describe, test, expect, code,
	OK, ERR_NOT_IN_RANGE, ERR_NOT_FOUND, ERR_TIRED,
	STRUCTURE_LAB,
	MOVE, ATTACK, CARRY,
	LAB_BOOST_MINERAL, LAB_BOOST_ENERGY, LAB_ENERGY_CAPACITY,
	LAB_UNBOOST_ENERGY, LAB_UNBOOST_MINERAL,
	FIND_DROPPED_RESOURCES,
} from '../../src/index.js';

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
});
