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
		// First, drop some energy
		const dropperId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: ['carry', 'move'],
			store: { energy: 30 },
		});
		await shard.runPlayer('p1', code`
			Game.getObjectById(${dropperId}).drop(RESOURCE_ENERGY)
		`);
		await shard.tick();

		// Now pick it up with a different creep
		const pickerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: ['carry', 'move'],
			name: 'picker',
		});

		// Find the dropped resource
		const rc = await shard.runPlayer('p1', code`
			const picker = Game.creeps['picker'];
			const resource = picker.pos.findInRange(FIND_DROPPED_RESOURCES, 0)[0];
			resource ? picker.pickup(resource) : -7
		`);
		expect(rc).toBe(0);
	});
});
