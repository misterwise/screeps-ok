import { describe, test, expect, code, OK, ERR_NOT_IN_RANGE, ERR_NOT_ENOUGH_RESOURCES, CARRY, MOVE, STRUCTURE_CONTAINER, STRUCTURE_SPAWN } from '../../src/index.js';

describe('creep.transfer()', () => {
	test('transfers energy from the creep store to the target store', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { energy: 50 },
		});
		const containerId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_CONTAINER,
			store: {},
		});

		const rc = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			const target = Game.getObjectById(${containerId});
			creep.transfer(target, RESOURCE_ENERGY)
		`);
		expect(rc).toBe(OK);

		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store.energy ?? 0).toBe(0);
		const container = await shard.expectStructure(containerId, STRUCTURE_CONTAINER);
		expect(container.store.energy).toBe(50);
	});

	test('transfers partial amount', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { energy: 50 },
		});
		const containerId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_CONTAINER,
			store: {},
		});

		const rc = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			const target = Game.getObjectById(${containerId});
			creep.transfer(target, RESOURCE_ENERGY, 20)
		`);
		expect(rc).toBe(OK);

		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store.energy).toBe(30);
	});

	test('returns ERR_NOT_IN_RANGE when far', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [10, 10], owner: 'p1',
			body: [CARRY, MOVE],
			store: { energy: 50 },
		});
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_SPAWN, owner: 'p1',
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).transfer(Game.getObjectById(${spawnId}), RESOURCE_ENERGY)
		`);
		expect(rc).toBe(ERR_NOT_IN_RANGE);
	});

	test('returns ERR_NOT_ENOUGH_RESOURCES with empty store', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			// no store
		});
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_SPAWN, owner: 'p1',
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).transfer(Game.getObjectById(${spawnId}), RESOURCE_ENERGY)
		`);
		expect(rc).toBe(ERR_NOT_ENOUGH_RESOURCES);
	});
});
