import { describe, test, expect, code,
	STRUCTURE_EXTENSION, STRUCTURE_SPAWN,
	RESOURCE_ENERGY,
} from '../../src/index.js';

describe('store access', () => {
	test('STORE-ACCESS-001 store[RESOURCE_TYPE] returns 0 when the store currently holds none of that resource', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const containerId = await shard.placeStructure('W1N1', {
			pos: [25, 25],
			structureType: STRUCTURE_EXTENSION,
			owner: 'p1',
			store: { energy: 0 },
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			Game.getObjectById(${containerId}).store[${RESOURCE_ENERGY}]
		`);

		expect(result).toBe(0);
	});

	test('STORE-ACCESS-002 store.getCapacity(type) returns null when the store cannot hold that resource type', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25],
			structureType: STRUCTURE_SPAWN,
			owner: 'p1',
			store: { energy: 0 },
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).store.getCapacity('H')
		`);

		expect(result).toBeNull();
	});
});
