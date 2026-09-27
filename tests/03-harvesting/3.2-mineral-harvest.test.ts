import { describe, test, expect, code,
	OK,
	WORK, CARRY, MOVE, body,
	STRUCTURE_CONTAINER, STRUCTURE_EXTRACTOR, HARVEST_MINERAL_POWER, EXTRACTOR_COOLDOWN,
	ENERGY_DECAY, FIND_DROPPED_RESOURCES, RESOURCE_HYDROGEN, RESOURCE_OXYGEN, RESOURCE_UTRIUM,
} from '../../src/index.js';
import { harvestMineralValidationCases } from '../../src/matrices/harvest-mineral-validation.js';
import { spawnBusyCreep } from '../intent-validation-helpers.js';

describe('creep.harvest(mineral)', () => {
	test('HARVEST-MINERAL-001 harvest on a mineral with an extractor returns OK and deposits HARVEST_MINERAL_POWER per WORK part', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 6);
		await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_EXTRACTOR, owner: 'p1',
		});
		const mineralId = await shard.placeMineral('W1N1', {
			pos: [25, 26], mineralType: RESOURCE_HYDROGEN, mineralAmount: 50000,
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: body(2, WORK, CARRY, MOVE),
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${mineralId}))
		`);
		expect(rc).toBe(OK);

		const creep = await shard.expectObject(creepId, 'creep');
		// 2 WORK parts * HARVEST_MINERAL_POWER = 2
		expect(creep.store[RESOURCE_HYDROGEN]).toBe(2 * HARVEST_MINERAL_POWER);
	});

	test('HARVEST-MINERAL-002 harvest reduces mineral amount by the harvested quantity', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 6);
		await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_EXTRACTOR, owner: 'p1',
		});
		const mineralId = await shard.placeMineral('W1N1', {
			pos: [25, 26], mineralType: RESOURCE_HYDROGEN, mineralAmount: 50000,
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${mineralId}))
		`);

		const mineral = await shard.expectObject(mineralId, 'mineral');
		expect(mineral.mineralAmount).toBe(50000 - HARVEST_MINERAL_POWER);
	});

	test('HARVEST-MINERAL-003 extractor enters cooldown after harvest', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 6);
		const extractorId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_EXTRACTOR, owner: 'p1',
		});
		const mineralId = await shard.placeMineral('W1N1', {
			pos: [25, 26], mineralType: RESOURCE_HYDROGEN, mineralAmount: 50000,
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${mineralId}))
		`);

		// Read on the tick that processed the harvest.
		const extractor = await shard.expectStructure(extractorId, STRUCTURE_EXTRACTOR);
		expect(extractor.cooldown).toBe(EXTRACTOR_COOLDOWN);
	});

	test('HARVEST-MINERAL-005 harvested resource key matches mineral.mineralType', async ({ shard }) => {
		// Assert the mineral's mineralType determines the resource dispatched
		// into the creep's store. Cover two distinct types (one per room, as
		// the real game allows only one mineral per room) to prove actual
		// dispatch — not a hard-coded hydrogen.
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 6, owner: 'p1' },
				{ name: 'W2N1', rcl: 6, owner: 'p1' },
			],
		});

		// W1N1: mineral 'O' at (25, 26), extractor, creep at (25, 25).
		await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_EXTRACTOR, owner: 'p1',
		});
		const oMineralId = await shard.placeMineral('W1N1', {
			pos: [25, 26], mineralType: RESOURCE_OXYGEN, mineralAmount: 50000,
		});
		const oCreepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});

		// W2N1: mineral 'U' at (25, 26), extractor, creep at (25, 25).
		await shard.placeStructure('W2N1', {
			pos: [25, 26], structureType: STRUCTURE_EXTRACTOR, owner: 'p1',
		});
		const uMineralId = await shard.placeMineral('W2N1', {
			pos: [25, 26], mineralType: RESOURCE_UTRIUM, mineralAmount: 50000,
		});
		const uCreepId = await shard.placeCreep('W2N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Game.getObjectById(${oCreepId}).harvest(Game.getObjectById(${oMineralId}));
			Game.getObjectById(${uCreepId}).harvest(Game.getObjectById(${uMineralId}));
		`);

		const oCreep = await shard.expectObject(oCreepId, 'creep');
		expect(oCreep.store).toEqual({ [RESOURCE_OXYGEN]: HARVEST_MINERAL_POWER });

		const uCreep = await shard.expectObject(uCreepId, 'creep');
		expect(uCreep.store).toEqual({ [RESOURCE_UTRIUM]: HARVEST_MINERAL_POWER });
	});

	test('HARVEST-MINERAL-011 harvest(mineral) returns OK when all preconditions met', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 6);
		await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_EXTRACTOR, owner: 'p1',
		});
		const mineralId = await shard.placeMineral('W1N1', {
			pos: [25, 26], mineralType: RESOURCE_HYDROGEN, mineralAmount: 50000,
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${mineralId}))
		`);
		expect(rc).toBe(OK);
	});

	test('HARVEST-MINERAL-012 harvest(mineral) overflows mineral when exceeding carry capacity', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 6);
		await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_EXTRACTOR, owner: 'p1',
		});
		const mineralId = await shard.placeMineral('W1N1', {
			pos: [25, 26], mineralType: RESOURCE_HYDROGEN, mineralAmount: 50000,
		});
		// 10 WORK = 10 mineral/tick, 1 CARRY (50 cap) pre-loaded with 45 energy → 5 free.
		// Overflow = 10 - 5 = 5 mineral. In-tick decay reduces by ceil(5/ENERGY_DECAY) = 1.
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: body(10, WORK, CARRY, MOVE),
			store: { energy: 45 },
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${mineralId}))
		`);

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store.energy).toBe(45);
		expect(creep.store[RESOURCE_HYDROGEN]).toBe(5);

		const mineral = await shard.expectObject(mineralId, 'mineral');
		expect(mineral.mineralAmount).toBe(50000 - 10 * HARVEST_MINERAL_POWER);

		const drops = await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES);
		const pile = drops.find(r => r.pos.x === 25 && r.pos.y === 25 && r.resourceType === RESOURCE_HYDROGEN);
		expect(pile).toBeDefined();
		const overflow = 10 * HARVEST_MINERAL_POWER - 5;
		expect(pile!.amount).toBe(overflow - Math.ceil(overflow / ENERGY_DECAY));
	});

	test('HARVEST-MINERAL-013 partial harvest when mineral amount < full amount', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 6);
		await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_EXTRACTOR, owner: 'p1',
		});
		const mineralId = await shard.placeMineral('W1N1', {
			pos: [25, 26], mineralType: RESOURCE_HYDROGEN, mineralAmount: 2,
		});
		// 5 WORK = 5 mineral/tick, but only 2 available.
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: body(5, WORK, CARRY, MOVE),
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${mineralId}))
		`);

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store[RESOURCE_HYDROGEN]).toBe(2);

		const mineral = await shard.expectObject(mineralId, 'mineral');
		expect(mineral.mineralAmount).toBe(0);
	});

	for (const row of harvestMineralValidationCases) {
		test(`HARVEST-MINERAL-014:${row.label} harvest(mineral) validation returns the canonical code`, async ({ shard }) => {
			const blockers = shard.validationBlockers(row);
			const owner = blockers.has('not-owner') ? 'p2' : 'p1';
			const rcl = blockers.has('inactive-extractor') ? 5 : 6;
			if (owner === 'p2' || blockers.has('extractor-not-owner')) {
				await shard.createShard({
					players: ['p1', 'p2'],
					rooms: [{ name: 'W1N1', rcl, owner: owner === 'p2' && blockers.has('busy') ? 'p2' : 'p1' }],
				});
				if (owner === 'p2' && !blockers.has('busy')) {
					await shard.placeCreep('W1N1', { pos: [20, 20], owner: 'p1', body: [MOVE] });
				}
			} else {
				await shard.ownedRoom('p1', 'W1N1', rcl);
			}

			const creepId = blockers.has('busy')
				? await spawnBusyCreep(shard, {
					owner,
					observerOwner: owner === 'p2' ? 'p1' : undefined,
					body: blockers.has('no-bodypart') ? [CARRY, MOVE] : [WORK, CARRY, MOVE],
				})
				: await shard.placeCreep('W1N1', {
					pos: [25, 25],
					owner,
					body: blockers.has('no-bodypart') ? [CARRY, MOVE] : [WORK, CARRY, MOVE],
				});
			const targetPos: [number, number] = blockers.has('range') ? [30, 30] : [25, 26];
			const targetId = blockers.has('invalid-target')
				? await shard.placeStructure('W1N1', {
					pos: targetPos,
					structureType: STRUCTURE_CONTAINER,
					store: { energy: 50 },
				})
				: await shard.placeMineral('W1N1', {
					pos: targetPos,
					mineralType: RESOURCE_HYDROGEN,
					mineralAmount: blockers.has('depleted') ? 0 : 50000,
				});
			if (!blockers.has('invalid-target') && !blockers.has('no-extractor')) {
				await shard.placeStructure('W1N1', {
					pos: targetPos,
					structureType: STRUCTURE_EXTRACTOR,
					owner: blockers.has('extractor-not-owner') ? 'p2' : 'p1',
					...(blockers.has('cooldown') ? { cooldown: 10 } : {}),
				});
			}

			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${creepId}).harvest(Game.getObjectById(${targetId}))
			`);
			expect(rc).toBe(row.expectedRc);
		});
	}
});
