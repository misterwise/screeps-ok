import { describe, test, expect, code, OK, ERR_NOT_IN_RANGE, ERR_NOT_ENOUGH_RESOURCES, CARRY, MOVE, FIND_CREEPS, FIND_DROPPED_RESOURCES, STRUCTURE_CONTAINER, CARRY_CAPACITY } from '../../src/index.js';

describe('creep.withdraw()', () => {
	test('WITHDRAW-001 withdraws energy from container', async ({ shard }) => {
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
		expect(creep.store.energy).toBe(CARRY_CAPACITY);
	});

	test('WITHDRAW-002 withdraws partial amount', async ({ shard }) => {
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

	test('WITHDRAW-003 returns ERR_NOT_IN_RANGE', async ({ shard }) => {
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

	test('WITHDRAW-004 returns ERR_NOT_ENOUGH_RESOURCES from empty container', async ({ shard }) => {
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
	test('DROP-001 drop() removes the dropped amount from the creep store', async ({ shard }) => {
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

	test('DROP-001 drop() creates a dropped resource at the creep position', async ({ shard }) => {
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
			expect(dropped.amount).toBe(49); // 50 dropped, minus 1 tick of decay
		}
	});

	test('DROP-002 drops partial amount', async ({ shard }) => {
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
	test('PICKUP-001 picks up dropped resource', async ({ shard }) => {
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
		await shard.tick();

		// Verify the picker received the energy
		const picker = (await shard.findInRoom('W1N1', FIND_CREEPS))
			.find(c => c.name === 'picker');
		expect(picker).toBeDefined();
		expect(picker!.store.energy).toBe(29); // 30 dropped, minus 1 tick of decay before pickup

		// Verify the dropped resource is gone
		const remaining = await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES);
		expect(remaining.length).toBe(0);
	});
});
