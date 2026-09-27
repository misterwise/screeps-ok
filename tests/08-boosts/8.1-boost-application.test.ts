import { describe, test, expect, code,
	OK,
	STRUCTURE_LAB,
	ATTACK, MOVE, CARRY, WORK,
	RESOURCE_UTRIUM_HYDRIDE, SOURCE_ENERGY_CAPACITY,
	LAB_BOOST_MINERAL, LAB_BOOST_ENERGY, LAB_MINERAL_CAPACITY, LAB_ENERGY_CAPACITY,
} from '../../src/index.js';
import { boostCreepValidationCases } from '../../src/matrices/boost-creep-validation.js';
import { boostTableCases } from '../../src/matrices/boost-tables.js';
import { spawnBusyCreep } from '../intent-validation-helpers.js';

const UH = RESOURCE_UTRIUM_HYDRIDE;

describe('Lab boostCreep', () => {
	test('BOOST-CREEP-001 boostCreep returns OK and marks body parts as boosted', async ({ shard }) => {
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);
		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: LAB_ENERGY_CAPACITY, [UH]: LAB_BOOST_MINERAL },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1', body: [ATTACK, MOVE],
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${labId}).boostCreep(Game.getObjectById(${creepId}))
		`);
		expect(rc).toBe(OK);
		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.body.map(part => part.boost ?? null)).toEqual([UH, null]);
	});

	test('BOOST-CREEP-002 boostCreep consumes LAB_BOOST_MINERAL and LAB_BOOST_ENERGY per part', async ({ shard }) => {
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);
		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: LAB_ENERGY_CAPACITY, [UH]: LAB_MINERAL_CAPACITY },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1', body: [ATTACK, ATTACK, MOVE],
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${labId}).boostCreep(Game.getObjectById(${creepId}))
		`);
		expect(rc).toBe(OK);
		const lab = await shard.expectStructure(labId, STRUCTURE_LAB);
		expect(lab.store).toEqual({
			energy: LAB_ENERGY_CAPACITY - 2 * LAB_BOOST_ENERGY,
			[UH]: LAB_MINERAL_CAPACITY - 2 * LAB_BOOST_MINERAL,
		});
	});

	test('BOOST-CREEP-003 boostCreep with bodyPartsCount limits the number of parts boosted', async ({ shard }) => {
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);
		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: LAB_ENERGY_CAPACITY, [UH]: LAB_BOOST_MINERAL * 3 },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1', body: [ATTACK, ATTACK, ATTACK, MOVE],
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${labId}).boostCreep(Game.getObjectById(${creepId}), 1)
		`);
		expect(rc).toBe(OK);
		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.body.filter(part => part.boost === UH)).toHaveLength(1);
		const lab = await shard.expectStructure(labId, STRUCTURE_LAB);
		expect(lab.store[UH]).toBe(LAB_BOOST_MINERAL * 2);
	});

	test('BOOST-CREEP-009 boostCreep affects only unboosted parts of the type the lab compound boosts', async ({ shard }) => {
		shard.requires('chemistry');
		// The lab holds a WORK build compound; the first WORK part already
		// carries a harvest compound.
		const buildCompound = boostTableCases.find(row => row.mechanic === 'build')!.compound;
		const harvestCompound = boostTableCases.find(row => row.mechanic === 'harvest')!.compound;
		await shard.ownedRoom('p1', 'W1N1', 6);
		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: LAB_ENERGY_CAPACITY, [buildCompound]: LAB_MINERAL_CAPACITY },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1', body: [WORK, WORK, ATTACK, MOVE], boosts: { 0: harvestCompound },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${labId}).boostCreep(Game.getObjectById(${creepId}))
		`);
		expect(rc).toBe(OK);
		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.body.map(part => part.boost ?? null)).toEqual([harvestCompound, buildCompound, null, null]);
		const lab = await shard.expectStructure(labId, STRUCTURE_LAB);
		expect(lab.store).toEqual({
			energy: LAB_ENERGY_CAPACITY - LAB_BOOST_ENERGY,
			[buildCompound]: LAB_MINERAL_CAPACITY - LAB_BOOST_MINERAL,
		});
	});

	for (const row of boostCreepValidationCases) {
		test(`BOOST-CREEP-010:${row.label} boostCreep() validation returns the canonical code`, async ({ shard }) => {
			shard.requires('chemistry');
			const blockers = shard.validationBlockers(row);
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [{ name: 'W1N1', rcl: blockers.has('rcl') ? 5 : 6, owner: 'p1' }],
			});
			const labId = await shard.placeStructure('W1N1', {
				pos: [25, 25],
				structureType: STRUCTURE_LAB,
				owner: blockers.has('not-owner') ? 'p2' : 'p1',
				store: {
					energy: blockers.has('not-enough-energy') ? 0 : LAB_ENERGY_CAPACITY,
					[UH]: blockers.has('not-enough-mineral') ? LAB_BOOST_MINERAL - 1 : LAB_BOOST_MINERAL,
				},
			});
			const targetPos: [number, number] = blockers.has('range') ? [25, 28] : [25, 26];
			const targetBody = blockers.has('not-found') ? [CARRY, MOVE] : [ATTACK, MOVE];
			const targetId = blockers.has('invalid-target')
				? await shard.placeSource('W1N1', { pos: targetPos, energy: SOURCE_ENERGY_CAPACITY, energyCapacity: SOURCE_ENERGY_CAPACITY })
				: blockers.has('spawning')
					? await spawnBusyCreep(shard, { pos: targetPos, body: targetBody })
					: await shard.placeCreep('W1N1', { pos: targetPos, owner: 'p1', body: targetBody });
			// One unboosted ATTACK part, fewer than the two asked for.
			const bodyPartsCount = blockers.has('too-many-parts') ? 2 : undefined;

			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${labId}).boostCreep(Game.getObjectById(${targetId}), ${bodyPartsCount})
			`);
			expect(rc).toBe(row.expectedRc);
		});
	}
});
