import { describe, test, expect, code } from '../../src/index.js';

describe('creep.repair()', () => {
	test('repairs 100 HP per WORK part per tick', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: ['work', 'carry', 'move'],
			store: { energy: 50 },
		});
		const roadId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: 'road',
			hits: 100, // damaged (max 5000)
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).repair(Game.getObjectById(${roadId}))
		`);
		expect(rc).toBe(0);
		await shard.tick();

		const road = await shard.getObject(roadId);
		if (road?.kind === 'structure' && road.hits !== undefined) {
			expect(road.hits).toBe(200); // 1 WORK = 100 HP repaired
		}

		const creep = await shard.getObject(creepId);
		if (creep?.kind === 'creep') {
			expect(creep.store.energy).toBe(49); // repair costs 1 energy per tick
		}
	});

	test('returns ERR_NOT_IN_RANGE when too far', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [10, 10], owner: 'p1',
			body: ['work', 'carry', 'move'],
			store: { energy: 50 },
		});
		const roadId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: 'road', hits: 100,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).repair(Game.getObjectById(${roadId}))
		`);
		expect(rc).toBe(-9);
	});

	test('returns ERR_NOT_ENOUGH_RESOURCES without energy', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: ['work', 'carry', 'move'],
		});
		const roadId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: 'road', hits: 100,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).repair(Game.getObjectById(${roadId}))
		`);
		expect(rc).toBe(-6);
	});
});
