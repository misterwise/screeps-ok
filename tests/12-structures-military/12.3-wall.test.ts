import { describe, test, expect, CONTROLLER_STRUCTURES, STRUCTURE_WALL, WALL_HITS_MAX } from '../../src/index.js';

describe('StructureWall', () => {
	test('WALL-001 ordinary constructed walls do not decay', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const hits = 1000;
		const wallId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_WALL, hits,
		});

		await shard.tick(10);
		expect((await shard.expectStructure(wallId, STRUCTURE_WALL)).hits).toBe(hits);
	});

	// The first level that allows walls, and the one below it.
	const wallLevel = [1, 2, 3, 4, 5, 6, 7, 8].find(level => CONTROLLER_STRUCTURES[STRUCTURE_WALL][level] > 0)!;
	for (const rcl of [wallLevel - 1, wallLevel]) {
		const allowed = rcl === wallLevel;
		test(`WALL-002:rcl${rcl} constructed wall hitsMax is ${allowed ? 'WALL_HITS_MAX' : '0'} at RCL ${rcl}`, async ({ shard }) => {
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1', rcl, owner: 'p1' }],
			});
			const wallId = await shard.placeStructure('W1N1', {
				pos: [25, 25], structureType: STRUCTURE_WALL,
				hits: 1,
			});
			// The wall's tick sets hitsMax from the controller (constructedWalls/tick.js:10-15).
			await shard.tick();

			const wall = await shard.expectStructure(wallId, STRUCTURE_WALL);
			expect(wall.hitsMax).toBe(allowed ? WALL_HITS_MAX : 0);
		});
	}
});
