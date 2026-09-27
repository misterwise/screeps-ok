import { describe, test, expect, code,
	STRUCTURE_CONTAINER, STRUCTURE_EXTENSION, STRUCTURE_SPAWN, STRUCTURE_STORAGE,
	RESOURCE_ENERGY, RESOURCE_HYDROGEN,
	MOVE, CARRY,
} from '../../src/index.js';

describe('store access', () => {
	// Bots hit the empty case constantly (an empty container, a mineral the storage never held); an engine
	// that returns `undefined` there silently inverts every emptiness test a bot writes.
	test('STORE-ACCESS-001:structure a structure store reads its amount of a resource, 0 for one it holds none of', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 4);
		const storageId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_STORAGE, owner: 'p1',
			store: { [RESOURCE_ENERGY]: 1000 },
		});
		const containerId = await shard.placeStructure('W1N1', {
			pos: [26, 25], structureType: STRUCTURE_CONTAINER,
		});
		const extensionId = await shard.placeStructure('W1N1', {
			pos: [27, 25], structureType: STRUCTURE_EXTENSION, owner: 'p1',
			store: { [RESOURCE_ENERGY]: 0 },
		});

		const result = await shard.runPlayer('p1', code`
			[
				Game.getObjectById(${storageId}).store[RESOURCE_ENERGY],
				Game.getObjectById(${storageId}).store[RESOURCE_HYDROGEN],
				Game.getObjectById(${containerId}).store[RESOURCE_ENERGY],
				Game.getObjectById(${extensionId}).store[RESOURCE_ENERGY],
			]
		`);
		expect(result).toEqual([1000, 0, 0, 0]);
	});

	test('STORE-ACCESS-001:creep a creep store reads its amount of a resource, 0 for one it holds none of', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', name: 'loaded',
			body: [MOVE, CARRY], store: { [RESOURCE_ENERGY]: 30 },
		});
		await shard.placeCreep('W1N1', {
			pos: [26, 25], owner: 'p1', name: 'empty',
			body: [MOVE, CARRY], store: {},
		});

		const result = await shard.runPlayer('p1', code`
			[
				Game.creeps.loaded.store[RESOURCE_ENERGY],
				Game.creeps.loaded.store[RESOURCE_HYDROGEN],
				Game.creeps.empty.store[RESOURCE_ENERGY],
			]
		`);
		expect(result).toEqual([30, 0, 0]);
	});

	// The zero default is scoped to resource types, so a bot probing a store for
	// a field that does not exist still sees `undefined` rather than a silent 0.
	test('STORE-ACCESS-004 store[nonResourceKey] returns undefined, not 0', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 4);
		const storageId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_STORAGE, owner: 'p1',
			store: { [RESOURCE_ENERGY]: 1000 },
		});

		const result = await shard.runPlayer('p1', code`
			Game.getObjectById(${storageId}).store.notAResource === undefined
		`);
		expect(result).toBe(true);
	});

	test('STORE-ACCESS-002 the capacity calls return null for a resource the store cannot hold', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
		});

		const result = await shard.runPlayer('p1', code`
			const store = Game.getObjectById(${spawnId}).store;
			[store.getCapacity(RESOURCE_HYDROGEN), store.getUsedCapacity(RESOURCE_HYDROGEN), store.getFreeCapacity(RESOURCE_HYDROGEN)]
		`);
		expect(result).toEqual([null, null, null]);
	});

	// Bots sum assets by iterating stores; enumerable methods would hand
	// them a function where a number is expected.
	test('STORE-ACCESS-003 for-in / Object.keys over a store yield only resource keys, not the store methods', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 4);
		const storageId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_STORAGE, owner: 'p1',
			store: { [RESOURCE_ENERGY]: 1000, [RESOURCE_HYDROGEN]: 50 },
		});

		const result = await shard.runPlayer('p1', code`
			const store = Game.getObjectById(${storageId}).store;
			const forIn = [];
			for (const r in store) forIn.push(r);
			({
				forIn: forIn.sort(),
				keys: Object.keys(store).sort(),
				values: Object.keys(store).map(k => typeof store[k]),
				// Methods stay callable: non-enumerable, not absent.
				used: store.getUsedCapacity(RESOURCE_ENERGY),
			})
		`);
		const keys = [RESOURCE_HYDROGEN, RESOURCE_ENERGY].sort();
		expect(result).toEqual({ forIn: keys, keys, values: ['number', 'number'], used: 1000 });
	});
});
