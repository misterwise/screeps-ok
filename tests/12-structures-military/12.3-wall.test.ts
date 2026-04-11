import { describe, test, expect, STRUCTURE_WALL, WALL_HITS_MAX } from '../../src/index.js';

describe('StructureWall', () => {
	test('WALL-001 ordinary constructed walls do not decay', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const wallId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_WALL,
			hits: 1000,
		});
		await shard.tick();

		const before = await shard.expectStructure(wallId, STRUCTURE_WALL);
		const hitsBefore = before.hits;

		// Advance several ticks — hits should not change
		await shard.tick(10);

		const after = await shard.expectStructure(wallId, STRUCTURE_WALL);
		expect(after.hits).toBe(hitsBefore);
	});

	test('WALL-002 constructed wall has hitsMax = WALL_HITS_MAX when RCL allows walls', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const wallId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_WALL,
			hits: 1,
		});
		await shard.tick();

		const wall = await shard.expectStructure(wallId, STRUCTURE_WALL);
		expect(wall.hitsMax).toBe(WALL_HITS_MAX);
	});
});
