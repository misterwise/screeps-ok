import { describe, test, expect, code, OK, ERR_NOT_IN_RANGE, ERR_NOT_ENOUGH_RESOURCES, WORK, CARRY, MOVE, STRUCTURE_ROAD, REPAIR_POWER } from '../../src/index.js';

describe('creep.repair()', () => {
	test('REPAIR-001 repairs REPAIR_POWER HP per WORK part per tick', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
			store: { energy: 50 },
		});
		const roadId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_ROAD,
			hits: 100, // damaged (max 5000)
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).repair(Game.getObjectById(${roadId}))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const road = await shard.expectObject(roadId, 'structure');
		expect(road.hits).toBe(100 + REPAIR_POWER);
	});

	test('REPAIR-002 repairing spends 1 energy per REPAIR_POWER hits repaired', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
			store: { energy: 50 },
		});
		const roadId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_ROAD,
			hits: 100,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).repair(Game.getObjectById(${roadId}))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		// Repair costs 1 energy per REPAIR_POWER hits repaired (1 WORK = 1 energy/tick)
		expect(creep.store.energy).toBe(49);
	});

	test('REPAIR-003 returns ERR_NOT_IN_RANGE when too far', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [10, 10], owner: 'p1',
			body: [WORK, CARRY, MOVE],
			store: { energy: 50 },
		});
		const roadId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_ROAD, hits: 100,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).repair(Game.getObjectById(${roadId}))
		`);
		expect(rc).toBe(ERR_NOT_IN_RANGE);
	});

	test('REPAIR-004 returns ERR_NOT_ENOUGH_RESOURCES without energy', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		const roadId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_ROAD, hits: 100,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).repair(Game.getObjectById(${roadId}))
		`);
		expect(rc).toBe(ERR_NOT_ENOUGH_RESOURCES);
	});
});
