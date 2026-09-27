import { describe, test, expect, code,
	OK,
	STRUCTURE_LAB, STRUCTURE_SPAWN,
	ATTACK, MOVE, CARRY, WORK,
	LAB_BOOST_MINERAL, LAB_BOOST_ENERGY, LAB_MINERAL_CAPACITY, LAB_ENERGY_CAPACITY,
} from '../../src/index.js';
import { boostCreepValidationCases } from '../../src/matrices/boost-creep-validation.js';

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

	for (const row of boostCreepValidationCases) {
		test(`BOOST-CREEP-010:${row.label} boostCreep() validation returns the canonical code`, async ({ shard }) => {
			shard.requires('chemistry');
			const blockers = shard.validationBlockers(row);
			const labOwner = blockers.has('not-owner') ? 'p2' : 'p1';
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [{ name: 'W1N1', rcl: blockers.has('rcl') ? 5 : 6, owner: 'p1' }],
			});
			const labStore = {
				energy: blockers.has('not-enough-energy') ? 0 : LAB_ENERGY_CAPACITY,
				UH: blockers.has('not-enough-mineral') ? LAB_BOOST_MINERAL - 1 : LAB_BOOST_MINERAL,
			};
			const labId = await shard.placeStructure('W1N1', {
				pos: [25, 25],
				structureType: STRUCTURE_LAB,
				owner: labOwner,
				store: labStore,
			});
			let targetId: string;
			const targetPos: [number, number] = blockers.has('range') ? [25, 28] : [25, 26];
			if (blockers.has('invalid-target')) {
				await shard.placeStructure('W1N1', {
					pos: targetPos,
					structureType: STRUCTURE_SPAWN,
					owner: 'p1',
					store: { energy: 300 },
				});
				await shard.tick();
				const spawnRc = await shard.runPlayer('p1', code`
					Object.values(Game.spawns)[0].spawnCreep([${blockers.has('not-found') ? CARRY : ATTACK}, MOVE], 'BoostTarget')
				`);
				expect(spawnRc).toBe(OK);
				targetId = await shard.runPlayer('p1', code`
					Game.creeps['BoostTarget'].id
				`) as string;
			} else {
				targetId = await shard.placeCreep('W1N1', {
					pos: targetPos,
					owner: 'p1',
					body: blockers.has('not-found') ? [CARRY, MOVE] : [ATTACK, MOVE],
				});
				await shard.tick();
			}

			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${labId}).boostCreep(Game.getObjectById(${targetId}))
			`);
			expect(rc).toBe(row.expectedRc);
		});
	}
});
