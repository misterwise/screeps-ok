import { describe, test, expect, code, STRUCTURE_STORAGE, RESOURCE_ENERGY } from '../../src/index.js';

// A Store's methods (getUsedCapacity/getCapacity/getFreeCapacity) are non-enumerable,
// so `for (const res in obj.store)` and `Object.keys(obj.store)` yield ONLY resource
// amounts — never the method names. Real bots iterate stores this way to sum assets;
// leaking the methods as fake "resources" breaks them (a function where a number is
// expected). Conformance previously exercised the methods but not the enumeration.
describe('STORE-ENUM-001: store enumeration yields only resources', () => {
	test('for-in / Object.keys over a store omit the store methods', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 4, owner: 'p1' }],
		});
		const storageId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_STORAGE, owner: 'p1',
			store: { [RESOURCE_ENERGY]: 1000, H: 50 },
		});
		await shard.tick();

		// for-in keys, sorted, joined — should be exactly the two resources.
		const forInKeys = await shard.runPlayer('p1', code`
			(function () {
				const store = Game.getObjectById(${storageId}).store;
				const keys = [];
				for (const r in store) keys.push(r);
				return keys.sort().join(',');
			})()
		`);
		expect(forInKeys).toBe(['H', RESOURCE_ENERGY].sort().join(','));

		// Object.keys agrees; every enumerated value is a number, never a function.
		const allNumbers = await shard.runPlayer('p1', code`
			(function () {
				const store = Game.getObjectById(${storageId}).store;
				return Object.keys(store).every(k => typeof store[k] === 'number');
			})()
		`);
		expect(allNumbers).toBe(true);

		// The methods are still present and callable (just non-enumerable).
		const used = await shard.runPlayer('p1', code`
			Game.getObjectById(${storageId}).store.getUsedCapacity(${RESOURCE_ENERGY})
		`);
		expect(used).toBe(1000);
	});
});
