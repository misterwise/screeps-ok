import { describe, test, expect, code, OK, ERR_NOT_IN_RANGE, WORK, CARRY, MOVE, STRUCTURE_ROAD, BUILD_POWER } from '../../src/index.js';

describe('creep.build()', () => {
	test('increases site progress by 5 per WORK part', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});

		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25],
			owner: 'p1',
			body: [WORK, CARRY, MOVE],
			store: { energy: 50 },
		});

		const siteId = await shard.placeSite('W1N1', {
			pos: [25, 26],
			owner: 'p1',
			structureType: STRUCTURE_ROAD,
		});

		const returnCode = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			const site = Game.getObjectById(${siteId});
			creep.build(site)
		`);
		expect(returnCode).toBe(OK);

		await shard.tick();

		const site = await shard.expectObject(siteId, 'site');
		expect(site.progress).toBe(BUILD_POWER);
	});

	test('spends 1 energy per build progress point', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});

		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25],
			owner: 'p1',
			body: [WORK, CARRY, MOVE],
			store: { energy: 50 },
		});

		const siteId = await shard.placeSite('W1N1', {
			pos: [25, 26],
			owner: 'p1',
			structureType: STRUCTURE_ROAD,
		});

		const returnCode = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			const site = Game.getObjectById(${siteId});
			creep.build(site)
		`);
		expect(returnCode).toBe(OK);

		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store.energy).toBe(50 - BUILD_POWER);
	});

	test('returns ERR_NOT_IN_RANGE when too far', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});

		const creepId = await shard.placeCreep('W1N1', {
			pos: [10, 10],
			owner: 'p1',
			body: [WORK, CARRY, MOVE],
			store: { energy: 50 },
		});

		const siteId = await shard.placeSite('W1N1', {
			pos: [20, 20],
			owner: 'p1',
			structureType: STRUCTURE_ROAD,
		});

		const returnCode = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			const site = Game.getObjectById(${siteId});
			creep.build(site)
		`);
		expect(returnCode).toBe(ERR_NOT_IN_RANGE);
	});
});
