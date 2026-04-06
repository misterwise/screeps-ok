import { describe, test, expect, code, OK, ERR_NOT_IN_RANGE, WORK, CARRY, MOVE, STRUCTURE_WALL, DISMANTLE_POWER, DISMANTLE_COST } from '../../src/index.js';

describe('creep.dismantle()', () => {
	test('removes 50 HP per WORK part from structure', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, MOVE],
		});
		const wallId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_WALL,
			owner: 'p1', hits: 1000,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).dismantle(Game.getObjectById(${wallId}))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const wall = await shard.expectObject(wallId, 'structure');
		expect(wall.hits).toBe(1000 - DISMANTLE_POWER);
	});

	test('rounds energy gain down for a single 100-damage dismantle tick', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, WORK, CARRY, MOVE],
		});
		const wallId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_WALL,
			owner: 'p1', hits: 1000,
		});

		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).dismantle(Game.getObjectById(${wallId}))
		`);
		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		// floor(2 * DISMANTLE_POWER * DISMANTLE_COST) = floor(100 * 0.005) = 0
		expect(creep.store?.energy ?? 0).toBe(Math.floor(2 * DISMANTLE_POWER * DISMANTLE_COST));
	});

	test('returns ERR_NOT_IN_RANGE', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [10, 10], owner: 'p1',
			body: [WORK, MOVE],
		});
		const wallId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_WALL,
			owner: 'p1', hits: 1000,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).dismantle(Game.getObjectById(${wallId}))
		`);
		expect(rc).toBe(ERR_NOT_IN_RANGE);
	});
});
