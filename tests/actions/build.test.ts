import { describe, test, expect, code } from '../../src/index.js';

describe('creep.build()', () => {
	test('reduces energy and increases site progress', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});

		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25],
			owner: 'p1',
			body: ['work', 'carry', 'move'],
			store: { energy: 50 },
		});

		const siteId = await shard.placeSite('W1N1', {
			pos: [25, 26],
			owner: 'p1',
			structureType: 'road',
		});

		const returnCode = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			const site = Game.getObjectById(${siteId});
			creep.build(site)
		`);
		expect(returnCode).toBe(0); // OK

		await shard.tick();

		const creep = await shard.getObject(creepId);
		expect(creep).not.toBeNull();
		expect(creep!.kind).toBe('creep');
		if (creep!.kind === 'creep') {
			expect(creep!.store.energy).toBe(45);
		}

		const site = await shard.getObject(siteId);
		expect(site).not.toBeNull();
		expect(site!.kind).toBe('site');
		if (site!.kind === 'site') {
			expect(site!.progress).toBe(5);
		}
	});

	test('returns ERR_NOT_IN_RANGE when too far', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});

		const creepId = await shard.placeCreep('W1N1', {
			pos: [10, 10],
			owner: 'p1',
			body: ['work', 'carry', 'move'],
			store: { energy: 50 },
		});

		const siteId = await shard.placeSite('W1N1', {
			pos: [20, 20],
			owner: 'p1',
			structureType: 'road',
		});

		const returnCode = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			const site = Game.getObjectById(${siteId});
			creep.build(site)
		`);
		expect(returnCode).toBe(-9); // ERR_NOT_IN_RANGE
	});
});
