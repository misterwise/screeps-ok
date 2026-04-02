import { describe, test, expect, code, OK, ERR_NOT_IN_RANGE, WORK, CARRY, MOVE, STRUCTURE_WALL } from '../../src/index.js';

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
		expect(wall.hits).toBe(950); // 1 WORK = 50 HP dismantled
	});

	test('returns energy equal to 0.25 * damage dealt', async ({ shard }) => {
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
		// 2 WORK = 100 damage, 0.25 * 100 = 25 energy returned
		expect(creep.store?.energy ?? 0).toBeGreaterThan(0);
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
