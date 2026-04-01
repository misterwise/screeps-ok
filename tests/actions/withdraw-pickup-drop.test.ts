import { describe, test, expect, code } from '../../src/index.js';

describe('creep.withdraw()', () => {
	test('withdraws energy from container', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: ['carry', 'move'],
		});
		const containerId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: 'container',
			store: { energy: 500 },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).withdraw(Game.getObjectById(${containerId}), RESOURCE_ENERGY)
		`);
		expect(rc).toBe(0);
		await shard.tick();

		const creep = await shard.getObject(creepId);
		if (creep?.kind === 'creep') {
			expect(creep.store.energy).toBe(50); // 1 CARRY = 50 capacity
		}
	});

	test('withdraws partial amount', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: ['carry', 'move'],
		});
		const containerId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: 'container',
			store: { energy: 500 },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).withdraw(Game.getObjectById(${containerId}), RESOURCE_ENERGY, 10)
		`);
		expect(rc).toBe(0);
		await shard.tick();

		const creep = await shard.getObject(creepId);
		if (creep?.kind === 'creep') {
			expect(creep.store.energy).toBe(10);
		}
	});

	test('returns ERR_NOT_IN_RANGE', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [10, 10], owner: 'p1',
			body: ['carry', 'move'],
		});
		const containerId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: 'container',
			store: { energy: 500 },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).withdraw(Game.getObjectById(${containerId}), RESOURCE_ENERGY)
		`);
		expect(rc).toBe(-9);
	});

	test('returns ERR_NOT_ENOUGH_RESOURCES from empty container', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: ['carry', 'move'],
		});
		const containerId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: 'container',
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).withdraw(Game.getObjectById(${containerId}), RESOURCE_ENERGY)
		`);
		expect(rc).toBe(-6);
	});
});

describe('creep.drop()', () => {
	test('drops energy on the ground', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: ['carry', 'move'],
			store: { energy: 50 },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).drop(RESOURCE_ENERGY)
		`);
		expect(rc).toBe(0);
		await shard.tick();

		const creep = await shard.getObject(creepId);
		if (creep?.kind === 'creep') {
			expect(creep.store.energy ?? 0).toBe(0);
		}

		// Should create a dropped resource
		const resources = await shard.findInRoom('W1N1', 'droppedResources');
		expect(resources.length).toBeGreaterThanOrEqual(1);
	});

	test('drops partial amount', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: ['carry', 'move'],
			store: { energy: 50 },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).drop(RESOURCE_ENERGY, 20)
		`);
		expect(rc).toBe(0);
		await shard.tick();

		const creep = await shard.getObject(creepId);
		if (creep?.kind === 'creep') {
			expect(creep.store.energy).toBe(30);
		}
	});
});

describe('creep.pickup()', () => {
	test('picks up dropped resource', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		// Place dropper and picker at the same position
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: ['carry', 'move'],
			store: { energy: 30 },
			name: 'dropper',
		});
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: ['carry', 'move'],
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
		expect(rc).toBe(0);
	});
});
