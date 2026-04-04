import { describe, test, expect, code, OK, ERR_NOT_IN_RANGE, ERR_NOT_ENOUGH_RESOURCES, CARRY, MOVE, FIND_DROPPED_RESOURCES, STRUCTURE_CONTAINER } from '../../src/index.js';

describe('creep.withdraw()', () => {
	test('withdraws energy from container', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
		});
		const containerId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_CONTAINER,
			store: { energy: 500 },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).withdraw(Game.getObjectById(${containerId}), RESOURCE_ENERGY)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store.energy).toBe(50); // 1 CARRY = 50 capacity
	});

	test('withdraws partial amount', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
		});
		const containerId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_CONTAINER,
			store: { energy: 500 },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).withdraw(Game.getObjectById(${containerId}), RESOURCE_ENERGY, 10)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store.energy).toBe(10);
	});

	test('returns ERR_NOT_IN_RANGE', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [10, 10], owner: 'p1',
			body: [CARRY, MOVE],
		});
		const containerId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_CONTAINER,
			store: { energy: 500 },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).withdraw(Game.getObjectById(${containerId}), RESOURCE_ENERGY)
		`);
		expect(rc).toBe(ERR_NOT_IN_RANGE);
	});

	test('returns ERR_NOT_ENOUGH_RESOURCES from empty container', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
		});
		const containerId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_CONTAINER,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).withdraw(Game.getObjectById(${containerId}), RESOURCE_ENERGY)
		`);
		expect(rc).toBe(ERR_NOT_ENOUGH_RESOURCES);
	});
});

describe('creep.drop()', () => {
	test('drop() removes the dropped amount from the creep store', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { energy: 50 },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).drop(RESOURCE_ENERGY)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store.energy ?? 0).toBe(0);
	});

	test('drop() creates a dropped resource at the creep position', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { energy: 50 },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).drop(RESOURCE_ENERGY)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const resources = await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES);
		const dropped = resources.find(r => r.pos.x === 25 && r.pos.y === 25);
		expect(dropped).toBeDefined();
		if (dropped) {
			expect(dropped.resourceType).toBe('energy');
			expect(dropped.amount).toBeGreaterThan(0);
		}
	});

	test('drops partial amount', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { energy: 50 },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).drop(RESOURCE_ENERGY, 20)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store.energy).toBe(30);
	});
});

describe('creep.pickup()', () => {
	test('picks up dropped resource', async ({ shard }) => {
		await shard.ownedRoom('p1');
		// Place dropper and picker at the same position
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { energy: 30 },
			name: 'dropper',
		});
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			name: 'picker',
		});

		// Drop energy on tick 1
		await shard.runPlayer('p1', code`
			Game.creeps['dropper'].drop(RESOURCE_ENERGY)
		`);
		await shard.tick();

		// Pick up on tick 2 — resource is now on the ground at (25,25)
		const rc = await shard.runPlayer('p1', code`
			const picker = Game.creeps['picker'];
			const resources = picker.room.find(FIND_DROPPED_RESOURCES);
			resources.length > 0 ? picker.pickup(resources[0]) : -99
		`);
		expect(rc).toBe(OK);
	});
});
