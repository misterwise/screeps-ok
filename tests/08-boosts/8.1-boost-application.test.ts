import { describe, test, expect, code,
	OK, ERR_NOT_IN_RANGE, ERR_NOT_FOUND, ERR_NOT_ENOUGH_RESOURCES,
	STRUCTURE_LAB,
	ATTACK, MOVE, CARRY, WORK, TOUGH, HEAL, RANGED_ATTACK,
	LAB_BOOST_MINERAL, LAB_BOOST_ENERGY, LAB_MINERAL_CAPACITY, LAB_ENERGY_CAPACITY,
	ATTACK_POWER, HEAL_POWER,
} from '../../src/index.js';

describe('Lab boostCreep', () => {
	test('BOOST-CREEP-001 boostCreep returns OK and marks body parts as boosted', async ({ shard }) => {
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);

		// UH boosts ATTACK parts (attack mechanic).
		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: LAB_ENERGY_CAPACITY, UH: LAB_BOOST_MINERAL },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [ATTACK, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const lab = Game.getObjectById(${labId});
			const creep = Game.getObjectById(${creepId});
			lab.boostCreep(creep)
		`);
		expect(rc).toBe(OK);

		// Check that the ATTACK part is now boosted with UH.
		const creep = await shard.expectObject(creepId, 'creep');
		const attackPart = creep.body.find((p: any) => p.type === ATTACK);
		expect(attackPart!.boost).toBe('UH');
	});

	test('BOOST-CREEP-002 boostCreep consumes LAB_BOOST_MINERAL and LAB_BOOST_ENERGY per part', async ({ shard }) => {
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);

		const startMineral = LAB_BOOST_MINERAL * 2;
		const startEnergy = LAB_BOOST_ENERGY * 2;
		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: startEnergy, UH: startMineral },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [ATTACK, ATTACK, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const lab = Game.getObjectById(${labId});
			const creep = Game.getObjectById(${creepId});
			lab.boostCreep(creep)
		`);
		expect(rc).toBe(OK);

		// 2 ATTACK parts boosted → 2 * LAB_BOOST_MINERAL mineral consumed, 2 * LAB_BOOST_ENERGY energy consumed.
		const lab = await shard.expectStructure(labId, STRUCTURE_LAB);
		expect(lab.store.UH ?? 0).toBe(0);
		expect(lab.store.energy ?? 0).toBe(0);
	});

	test('BOOST-CREEP-003 boostCreep with bodyPartsCount limits the number of parts boosted', async ({ shard }) => {
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);

		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: LAB_ENERGY_CAPACITY, UH: LAB_BOOST_MINERAL * 3 },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [ATTACK, ATTACK, ATTACK, MOVE],
		});
		await shard.tick();

		// Only boost 1 of the 3 ATTACK parts.
		const rc = await shard.runPlayer('p1', code`
			const lab = Game.getObjectById(${labId});
			const creep = Game.getObjectById(${creepId});
			lab.boostCreep(creep, 1)
		`);
		expect(rc).toBe(OK);

		const creep = await shard.expectObject(creepId, 'creep');
		const boostedCount = creep.body.filter((p: any) => p.boost === 'UH').length;
		expect(boostedCount).toBe(1);

		// Lab consumed only 1 part's worth.
		const lab = await shard.expectStructure(labId, STRUCTURE_LAB);
		expect(lab.store.UH).toBe(LAB_BOOST_MINERAL * 2);
	});

	test('BOOST-CREEP-004 boostCreep returns ERR_NOT_IN_RANGE when creep is not adjacent', async ({ shard }) => {
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);

		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: LAB_ENERGY_CAPACITY, UH: LAB_BOOST_MINERAL },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 28], owner: 'p1',
			body: [ATTACK, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const lab = Game.getObjectById(${labId});
			const creep = Game.getObjectById(${creepId});
			lab.boostCreep(creep)
		`);
		expect(rc).toBe(ERR_NOT_IN_RANGE);
	});

	test('BOOST-CREEP-005 boostCreep returns ERR_NOT_ENOUGH_RESOURCES when lab lacks mineral', async ({ shard }) => {
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);

		// Lab has energy but not enough mineral.
		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: LAB_ENERGY_CAPACITY, UH: LAB_BOOST_MINERAL - 1 },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [ATTACK, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const lab = Game.getObjectById(${labId});
			const creep = Game.getObjectById(${creepId});
			lab.boostCreep(creep)
		`);
		expect(rc).toBe(ERR_NOT_ENOUGH_RESOURCES);
	});

	test('BOOST-CREEP-006 boostCreep returns ERR_NOT_FOUND when no matching unboosted parts', async ({ shard }) => {
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);

		// UH boosts ATTACK, but creep has only MOVE and CARRY — no matching parts.
		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: LAB_ENERGY_CAPACITY, UH: LAB_BOOST_MINERAL },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [CARRY, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const lab = Game.getObjectById(${labId});
			const creep = Game.getObjectById(${creepId});
			lab.boostCreep(creep)
		`);
		expect(rc).toBe(ERR_NOT_FOUND);
	});

	test('BOOST-CREEP-007 boosted ATTACK part deals increased damage', async ({ shard }) => {
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);

		// UH provides 2x attack multiplier.
		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: LAB_ENERGY_CAPACITY, UH: LAB_BOOST_MINERAL },
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [ATTACK, MOVE],
		});
		await shard.tick();

		// Boost the attacker.
		const boostRc = await shard.runPlayer('p1', code`
			const lab = Game.getObjectById(${labId});
			const creep = Game.getObjectById(${attackerId});
			lab.boostCreep(creep)
		`);
		expect(boostRc).toBe(OK);

		// Place a target creep to attack.
		const targetId = await shard.placeCreep('W1N1', {
			pos: [26, 26], owner: 'p1',
			body: [TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, MOVE],
		});
		await shard.tick();

		const targetBefore = await shard.expectObject(targetId, 'creep');
		const hpBefore = targetBefore.hits;

		await shard.runPlayer('p1', code`
			const attacker = Game.getObjectById(${attackerId});
			const target = Game.getObjectById(${targetId});
			attacker.attack(target)
		`);

		const targetAfter = await shard.expectObject(targetId, 'creep');
		// 1 ATTACK part with UH (2x multiplier) → 1 * ATTACK_POWER * 2 = 60 damage.
		expect(hpBefore - targetAfter.hits).toBe(ATTACK_POWER * 2);
	});

	test('BOOST-CREEP-008 boosted HEAL part heals increased HP', async ({ shard }) => {
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);

		// LO provides 2x heal multiplier.
		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: LAB_ENERGY_CAPACITY, LO: LAB_BOOST_MINERAL },
		});
		const healerId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [HEAL, MOVE],
		});
		// Attacker to deal damage to the heal target.
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [26, 27], owner: 'p1',
			body: [ATTACK, MOVE],
		});
		// Target to be damaged then healed. Enough HP to survive the attack.
		const targetId = await shard.placeCreep('W1N1', {
			pos: [26, 26], owner: 'p1',
			body: [TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, MOVE],
		});
		await shard.tick();

		// Boost the healer.
		const boostRc = await shard.runPlayer('p1', code`
			const lab = Game.getObjectById(${labId});
			const healer = Game.getObjectById(${healerId});
			lab.boostCreep(healer)
		`);
		expect(boostRc).toBe(OK);

		// Damage the target with the attacker.
		await shard.runPlayer('p1', code`
			const attacker = Game.getObjectById(${attackerId});
			const target = Game.getObjectById(${targetId});
			attacker.attack(target)
		`);

		const targetDamaged = await shard.expectObject(targetId, 'creep');
		const hpAfterAttack = targetDamaged.hits;
		// Target should have taken ATTACK_POWER damage.
		expect(hpAfterAttack).toBe(600 - ATTACK_POWER);

		// Now heal the target with the boosted healer.
		await shard.runPlayer('p1', code`
			const healer = Game.getObjectById(${healerId});
			const target = Game.getObjectById(${targetId});
			healer.heal(target)
		`);

		const targetHealed = await shard.expectObject(targetId, 'creep');
		// 1 HEAL part with LO (2x multiplier) → 1 * HEAL_POWER * 2 = 24 HP healed.
		expect(targetHealed.hits - hpAfterAttack).toBe(HEAL_POWER * 2);
	});

	test('BOOST-CREEP-009 boostCreep affects only body parts matching the lab compound', async ({ shard }) => {
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);

		// LH boosts WORK parts (build/repair 1.5x). Creep has WORK + ATTACK + MOVE;
		// only the WORK part should be boosted, ATTACK/MOVE untouched.
		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: LAB_ENERGY_CAPACITY, LH: LAB_MINERAL_CAPACITY },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [WORK, ATTACK, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const lab = Game.getObjectById(${labId});
			const creep = Game.getObjectById(${creepId});
			lab.boostCreep(creep)
		`);
		expect(rc).toBe(OK);

		const creep = await shard.expectObject(creepId, 'creep');
		const workPart = creep.body.find((p: any) => p.type === WORK);
		const attackPart = creep.body.find((p: any) => p.type === ATTACK);
		const movePart = creep.body.find((p: any) => p.type === MOVE);
		expect(workPart!.boost).toBe('LH');
		expect(attackPart!.boost ?? null).toBe(null);
		expect(movePart!.boost ?? null).toBe(null);

		// Only 1 part consumed one mineral-unit + one energy-unit.
		const lab = await shard.expectStructure(labId, STRUCTURE_LAB);
		expect(lab.store.LH).toBe(LAB_MINERAL_CAPACITY - LAB_BOOST_MINERAL);
		expect(lab.store.energy).toBe(LAB_ENERGY_CAPACITY - LAB_BOOST_ENERGY);
	});
});
