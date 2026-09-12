import { describe, test, expect, code,
	STRUCTURE_CONTAINER, STRUCTURE_STORAGE,
	RESOURCE_ENERGY,
} from '../../src/index.js';

// STORE-ACCESS-001 only covers a store whose snapshot CARRIES the key (an extension
// seeded with `energy: 0`). The key-ABSENT case is the one real bots hit constantly:
// upstream's Store is a Proxy whose get-trap returns 0 for any RESOURCES_ALL name the
// store does not currently hold (engine/src/game/store.js). An engine that returns
// `undefined` instead silently inverts every emptiness test a bot writes —
// `creep.store[RESOURCE_ENERGY] === 0` and `battery.store[RESOURCE_ENERGY] < threshold`
// both become false for an empty object, so empty creeps never recharge and empty
// containers never get refilled. Enumeration must stay untouched (STORE-ENUM-001):
// the get-trap adds no keys.
describe('STORE-ABSENT-001: absent resources read as 0, not undefined', () => {
	test('store[resource] is 0 for a resource the store does not hold', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 4, owner: 'p1' }],
		});
		// Empty container: no store keys at all.
		const containerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_CONTAINER,
		});
		// Storage holding only energy: `H` is absent from its snapshot.
		const storageId = await shard.placeStructure('W1N1', {
			pos: [26, 25], structureType: STRUCTURE_STORAGE, owner: 'p1',
			store: { [RESOURCE_ENERGY]: 1000 },
		});
		await shard.tick();

		const emptyEnergy = await shard.runPlayer('p1', code`
			Game.getObjectById(${containerId}).store[${RESOURCE_ENERGY}]
		`);
		expect(emptyEnergy).toBe(0);

		// The comparison bots actually write on an empty store.
		const readsAsEmpty = await shard.runPlayer('p1', code`
			Game.getObjectById(${containerId}).store[${RESOURCE_ENERGY}] === 0
		`);
		expect(readsAsEmpty).toBe(true);

		const absentMineral = await shard.runPlayer('p1', code`
			Game.getObjectById(${storageId}).store.H
		`);
		expect(absentMineral).toBe(0);

		// A non-resource property name is still undefined (the trap only zero-fills
		// RESOURCES_ALL), and enumeration still lists only the held resources.
		const notAResource = await shard.runPlayer('p1', code`
			Game.getObjectById(${storageId}).store.notAResource === undefined
		`);
		expect(notAResource).toBe(true);

		const keys = await shard.runPlayer('p1', code`
			Object.keys(Game.getObjectById(${storageId}).store).sort().join(',')
		`);
		expect(keys).toBe(RESOURCE_ENERGY);

		const emptyKeys = await shard.runPlayer('p1', code`
			Object.keys(Game.getObjectById(${containerId}).store).length
		`);
		expect(emptyKeys).toBe(0);
	});

	test('creep.store[resource] is 0 for an empty creep', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 4, owner: 'p1' }],
		});
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', name: 'empty1',
			body: ['move', 'carry'], store: {},
		});
		await shard.tick();

		const energy = await shard.runPlayer('p1', code`
			Game.creeps['empty1'].store[${RESOURCE_ENERGY}]
		`);
		expect(energy).toBe(0);

		const isZero = await shard.runPlayer('p1', code`
			Game.creeps['empty1'].store[${RESOURCE_ENERGY}] === 0
		`);
		expect(isZero).toBe(true);
	});
});
