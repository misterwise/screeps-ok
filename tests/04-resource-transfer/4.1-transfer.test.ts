import { describe, test, expect, code, OK, ERR_NOT_IN_RANGE, ERR_NOT_ENOUGH_RESOURCES, ERR_INVALID_ARGS, ERR_INVALID_TARGET, ERR_FULL, CARRY, MOVE, STRUCTURE_CONTAINER, STRUCTURE_SPAWN, STRUCTURE_LAB, SPAWN_ENERGY_CAPACITY } from '../../src/index.js';

describe('creep.transfer()', () => {
	test('TRANSFER-001 transfers energy from the creep store to the target store', async ({ shard }) => {
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

	test('TRANSFER-002 transfers partial amount', async ({ shard }) => {
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

	test('TRANSFER-003 returns ERR_NOT_IN_RANGE when far', async ({ shard }) => {
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

	test('TRANSFER-004 returns ERR_NOT_ENOUGH_RESOURCES with empty store', async ({ shard }) => {
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

	test('TRANSFER-005 requires a resource type — omitted or unknown returns ERR_INVALID_ARGS', async ({ shard }) => {
		// Engine creeps.js:438: `!_.contains(C.RESOURCES_ALL, resourceType)` → ERR_INVALID_ARGS
		// Both undefined and an unknown string fail this check.
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { energy: 50 },
		});
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_SPAWN, owner: 'p1',
		});

		const result = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			const target = Game.getObjectById(${spawnId});
			({
				omitted: creep.transfer(target),
				unknown: creep.transfer(target, 'not_a_resource'),
			})
		`) as { omitted: number; unknown: number };

		expect(result.omitted).toBe(ERR_INVALID_ARGS);
		expect(result.unknown).toBe(ERR_INVALID_ARGS);
	});

	test('TRANSFER-006 returns ERR_FULL when target store has no free capacity', async ({ shard }) => {
		// Engine creeps.js:473: `storedAmount >= targetCapacity` → ERR_FULL.
		// Pre-fill the spawn to SPAWN_ENERGY_CAPACITY so there is zero free capacity for energy.
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { energy: 50 },
		});
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: SPAWN_ENERGY_CAPACITY },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).transfer(Game.getObjectById(${spawnId}), RESOURCE_ENERGY)
		`);
		expect(rc).toBe(ERR_FULL);
	});

	test('TRANSFER-007 returns ERR_INVALID_TARGET when the target cannot hold the resource type', async ({ shard }) => {
		// Engine creeps.js:459-461 — `!utils.capacityForResource(data(target.id), resourceType)`
		// → ERR_INVALID_TARGET. Spawns accept only energy; transferring any
		// mineral to a spawn hits this path.
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { H: 10 },
		});
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_SPAWN, owner: 'p1',
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).transfer(Game.getObjectById(${spawnId}), RESOURCE_HYDROGEN)
		`);
		expect(rc).toBe(ERR_INVALID_TARGET);
	});

	test('TRANSFER-008 transferring a mineral into a lab loaded with a different mineral returns ERR_INVALID_TARGET', async ({ shard }) => {
		// Labs only accept the mineral type they currently hold (plus energy).
		// Pre-loading the lab with 'H' sets the lab's mineral slot to H; an
		// attempt to transfer 'O' must be rejected via capacityForResource.
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { O: 10 },
		});
		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { H: 50 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).transfer(Game.getObjectById(${labId}), RESOURCE_OXYGEN)
		`);
		expect(rc).toBe(ERR_INVALID_TARGET);
	});
});
