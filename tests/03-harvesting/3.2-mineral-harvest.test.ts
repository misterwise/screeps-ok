import { describe, test, expect, code,
	OK, ERR_NOT_OWNER, ERR_NOT_IN_RANGE, ERR_NOT_FOUND, ERR_NOT_ENOUGH_RESOURCES,
	ERR_TIRED, ERR_RCL_NOT_ENOUGH,
	WORK, CARRY, MOVE, body,
	STRUCTURE_EXTRACTOR, HARVEST_MINERAL_POWER, EXTRACTOR_COOLDOWN,
	CARRY_CAPACITY, ENERGY_DECAY, FIND_DROPPED_RESOURCES,
} from '../../src/index.js';

describe('creep.harvest(mineral)', () => {
	test('HARVEST-MINERAL-001 harvest on a mineral with an extractor returns OK and deposits HARVEST_MINERAL_POWER per WORK part', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 6);
		await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_EXTRACTOR, owner: 'p1',
		});
		const mineralId = await shard.placeMineral('W1N1', {
			pos: [25, 26], mineralType: 'H', mineralAmount: 50000,
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
		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		// 2 WORK parts * HARVEST_MINERAL_POWER = 2
		expect(creep.store.H).toBe(2 * HARVEST_MINERAL_POWER);
	});

	test('HARVEST-MINERAL-002 harvest reduces mineral amount by the harvested quantity', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 6);
		await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_EXTRACTOR, owner: 'p1',
		});
		const mineralId = await shard.placeMineral('W1N1', {
			pos: [25, 26], mineralType: 'H', mineralAmount: 50000,
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${mineralId}))
		`);
		await shard.tick();

		const mineral = await shard.expectObject(mineralId, 'mineral');
		expect(mineral.mineralAmount).toBe(50000 - HARVEST_MINERAL_POWER);
	});

	test('HARVEST-MINERAL-003 extractor enters cooldown after harvest', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 6);
		const extractorId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_EXTRACTOR, owner: 'p1',
		});
		const mineralId = await shard.placeMineral('W1N1', {
			pos: [25, 26], mineralType: 'H', mineralAmount: 50000,
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${mineralId}))
		`);
		await shard.tick();

		// Cooldown is set to EXTRACTOR_COOLDOWN on harvest, then decremented
		// by 1 during the tick that processes the intent.
		const extractor = await shard.expectStructure(extractorId, STRUCTURE_EXTRACTOR);
		expect(extractor.cooldown).toBe(EXTRACTOR_COOLDOWN - 1);
	});

	test('HARVEST-MINERAL-004 harvest returns ERR_NOT_ENOUGH_RESOURCES on depleted mineral', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 6);
		await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_EXTRACTOR, owner: 'p1',
		});
		const mineralId = await shard.placeMineral('W1N1', {
			pos: [25, 26], mineralType: 'H', mineralAmount: 0,
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${mineralId}))
		`);
		expect(rc).toBe(ERR_NOT_ENOUGH_RESOURCES);
	});

	test('HARVEST-MINERAL-005 harvested resource key matches mineral.mineralType', async ({ shard }) => {
		// Assert the mineral's mineralType determines the resource dispatched
		// into the creep's store. Cover two distinct types (one per room, as
		// the real game allows only one mineral per room) to prove actual
		// dispatch — not a hard-coded 'H'.
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
			pos: [25, 26], mineralType: 'O', mineralAmount: 50000,
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
			pos: [25, 26], mineralType: 'U', mineralAmount: 50000,
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
		await shard.tick();

		const oCreep = await shard.expectObject(oCreepId, 'creep');
		expect(oCreep.store.O).toBe(HARVEST_MINERAL_POWER);
		expect(oCreep.store.U ?? 0).toBe(0);
		expect(oCreep.store.H ?? 0).toBe(0);

		const uCreep = await shard.expectObject(uCreepId, 'creep');
		expect(uCreep.store.U).toBe(HARVEST_MINERAL_POWER);
		expect(uCreep.store.O ?? 0).toBe(0);
		expect(uCreep.store.H ?? 0).toBe(0);
	});

	test('HARVEST-MINERAL-006 harvest(mineral) returns ERR_NOT_FOUND without extractor', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 6);
		const mineralId = await shard.placeMineral('W1N1', {
			pos: [25, 26], mineralType: 'H', mineralAmount: 50000,
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${mineralId}))
		`);
		expect(rc).toBe(ERR_NOT_FOUND);
	});

	test('HARVEST-MINERAL-007 harvest(mineral) returns ERR_NOT_OWNER when extractor owned by another player', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 6, owner: 'p1' },
				{ name: 'W2N1', rcl: 6, owner: 'p2' },
			],
		});
		const mineralId = await shard.placeMineral('W1N1', {
			pos: [25, 26], mineralType: 'H', mineralAmount: 50000,
		});
		await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_EXTRACTOR, owner: 'p2',
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${mineralId}))
		`);
		expect(rc).toBe(ERR_NOT_OWNER);
	});

	test('HARVEST-MINERAL-008 harvest(mineral) returns ERR_RCL_NOT_ENOUGH when extractor inactive', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 5);
		const mineralId = await shard.placeMineral('W1N1', {
			pos: [25, 26], mineralType: 'H', mineralAmount: 50000,
		});
		await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_EXTRACTOR, owner: 'p1',
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${mineralId}))
		`);
		expect(rc).toBe(ERR_RCL_NOT_ENOUGH);
	});

	test('HARVEST-MINERAL-009 harvest(mineral) returns ERR_TIRED during extractor cooldown', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 6);
		await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_EXTRACTOR, owner: 'p1',
		});
		const mineralId = await shard.placeMineral('W1N1', {
			pos: [25, 26], mineralType: 'H', mineralAmount: 50000,
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		await shard.tick();

		const first = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${mineralId}))
		`);
		expect(first).toBe(OK);
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${mineralId}))
		`);
		expect(rc).toBe(ERR_TIRED);
	});

	test('HARVEST-MINERAL-010 harvest(mineral) returns ERR_NOT_IN_RANGE when not adjacent', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 6);
		await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_EXTRACTOR, owner: 'p1',
		});
		const mineralId = await shard.placeMineral('W1N1', {
			pos: [25, 26], mineralType: 'H', mineralAmount: 50000,
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [10, 10], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${mineralId}))
		`);
		expect(rc).toBe(ERR_NOT_IN_RANGE);
	});

	test('HARVEST-MINERAL-011 harvest(mineral) returns OK when all preconditions met', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 6);
		await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_EXTRACTOR, owner: 'p1',
		});
		const mineralId = await shard.placeMineral('W1N1', {
			pos: [25, 26], mineralType: 'H', mineralAmount: 50000,
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
			pos: [25, 26], mineralType: 'H', mineralAmount: 50000,
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
		expect((creep.store as Record<string, number>).H).toBe(5);

		const mineral = await shard.expectObject(mineralId, 'mineral');
		expect(mineral.mineralAmount).toBe(50000 - 10 * HARVEST_MINERAL_POWER);

		const drops = await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES);
		const pile = drops.find(r => r.pos.x === 25 && r.pos.y === 25 && r.resourceType === 'H');
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
			pos: [25, 26], mineralType: 'H', mineralAmount: 2,
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
		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		expect((creep.store as Record<string, number>).H).toBe(2);

		const mineral = await shard.expectObject(mineralId, 'mineral');
		expect(mineral.mineralAmount).toBe(0);
	});
});
