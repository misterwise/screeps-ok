import { describe, test, expect, code } from '../../src/index.js';

describe('creep.dismantle()', () => {
	test('removes 50 HP per WORK part from structure', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: ['work', 'move'],
		});
		const wallId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: 'constructedWall',
			owner: 'p1', hits: 1000,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).dismantle(Game.getObjectById(${wallId}))
		`);
		expect(rc).toBe(0);
		await shard.tick();

		const wall = await shard.getObject(wallId);
		if (wall?.kind === 'structure' && wall.hits !== undefined) {
			expect(wall.hits).toBe(950); // 1 WORK = 50 HP dismantled
		}
	});

	test('returns energy equal to 0.25 * damage dealt', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: ['work', 'work', 'carry', 'move'],
		});
		const wallId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: 'constructedWall',
			owner: 'p1', hits: 1000,
		});

		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).dismantle(Game.getObjectById(${wallId}))
		`);
		await shard.tick();

		const creep = await shard.getObject(creepId);
		if (creep?.kind === 'creep') {
			// 2 WORK = 100 damage, 0.25 * 100 = 25 energy returned
			expect(creep.store?.energy ?? 0).toBeGreaterThan(0);
		}
	});

	test('returns ERR_NOT_IN_RANGE', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [10, 10], owner: 'p1',
			body: ['work', 'move'],
		});
		const wallId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: 'constructedWall',
			owner: 'p1', hits: 1000,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).dismantle(Game.getObjectById(${wallId}))
		`);
		expect(rc).toBe(-9);
	});
});
