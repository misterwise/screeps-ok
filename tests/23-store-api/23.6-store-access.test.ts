import { describe, test, expect, code,
	STRUCTURE_EXTENSION, STRUCTURE_SPAWN, STRUCTURE_STORAGE,
	RESOURCE_ENERGY, RESOURCE_HYDROGEN,
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

	// Bots sum assets by iterating stores; enumerable methods would hand
	// them a function where a number is expected.
	test('STORE-ACCESS-003 for-in / Object.keys over a store yield only resource keys, not the store methods', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 4, owner: 'p1' }],
		});
		const storageId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_STORAGE, owner: 'p1',
			store: { [RESOURCE_ENERGY]: 1000, [RESOURCE_HYDROGEN]: 50 },
		});
		await shard.tick();

		const forInKeys = await shard.runPlayer('p1', code`
			(function () {
				const store = Game.getObjectById(${storageId}).store;
				const keys = [];
				for (const r in store) keys.push(r);
				return keys.sort().join(',');
			})()
		`);
		expect(forInKeys).toBe([RESOURCE_HYDROGEN, RESOURCE_ENERGY].sort().join(','));

		const allNumbers = await shard.runPlayer('p1', code`
			(function () {
				const store = Game.getObjectById(${storageId}).store;
				return Object.keys(store).every(k => typeof store[k] === 'number');
			})()
		`);
		expect(allNumbers).toBe(true);

		// Methods stay callable — non-enumerable, not absent.
		const used = await shard.runPlayer('p1', code`
			Game.getObjectById(${storageId}).store.getUsedCapacity(${RESOURCE_ENERGY})
		`);
		expect(used).toBe(1000);
	});
});
