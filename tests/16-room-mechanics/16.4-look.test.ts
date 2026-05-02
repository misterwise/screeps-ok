import { describe, test, expect, code,
	ERR_INVALID_ARGS,
	MOVE,
	RESOURCE_ENERGY,
	STRUCTURE_ROAD,
	LOOK_STRUCTURES, LOOK_CREEPS, LOOK_TERRAIN,
	LOOK_ENERGY, LOOK_RESOURCES,
	LOOK_NUKES, LOOK_POWER_CREEPS, LOOK_DEPOSITS,
} from '../../src/index.js';

describe('Room look API', () => {
	test('ROOM-LOOK-001 lookAt returns terrain plus creeps and structures on the tile', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_ROAD,
		});
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [MOVE],
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const items = Game.rooms['W1N1'].lookAt(25, 25);
			items.map(i => i.type).sort()
		`);
		const types = result as string[];
		expect(types).toContain('terrain');
		expect(types).toContain('structure');
		expect(types).toContain('creep');
	});

	test('ROOM-LOOK-002 lookForAt(LOOK_STRUCTURES) returns only structures at the tile', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_ROAD,
		});
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [MOVE],
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const structs = Game.rooms['W1N1'].lookForAt(LOOK_STRUCTURES, 25, 25);
			structs.map(s => s.structureType)
		`);
		expect(result).toEqual(['road']);
	});

	test('ROOM-LOOK-003 lookForAt(LOOK_CREEPS) returns only creeps at the tile', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_ROAD,
		});
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [MOVE], name: 'LookTest',
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const creeps = Game.rooms['W1N1'].lookForAt(LOOK_CREEPS, 25, 25);
			creeps.map(c => c.name)
		`);
		expect(result).toEqual(['LookTest']);
	});

	test('ROOM-LOOK-004 lookForAt(LOOK_TERRAIN) returns the terrain string at the tile', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].lookForAt(LOOK_TERRAIN, 25, 25)
		`);
		expect(result).toEqual(['plain']);
	});

	test('ROOM-LOOK-005 lookForAtArea filters to objects inside the bounding box', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', {
			pos: [10, 10], owner: 'p1',
			body: [MOVE], name: 'InArea',
		});
		await shard.placeCreep('W1N1', {
			pos: [40, 40], owner: 'p1',
			body: [MOVE], name: 'OutOfArea',
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const area = Game.rooms['W1N1'].lookForAtArea(LOOK_CREEPS, 5, 5, 15, 15, true);
			area.map(entry => entry.creep.name)
		`);
		const names = result as string[];
		expect(names).toContain('InArea');
		expect(names).not.toContain('OutOfArea');
	});

	test('ROOM-LOOK-006 lookForAt returns ERR_INVALID_ARGS for an unrecognized LOOK type', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const invalidLookType = LOOK_CREEPS.toUpperCase();

		const rc = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].lookForAt(${invalidLookType}, 25, 25)
		`);
		expect(rc).toBe(ERR_INVALID_ARGS);
	});

	test('ROOM-LOOK-007 lookForAt(LOOK_ENERGY) returns the same Resource as LOOK_RESOURCES', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const dropId = await shard.placeDroppedResource('W1N1', {
			pos: [25, 25], resourceType: RESOURCE_ENERGY, amount: 250,
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const room = Game.rooms['W1N1'];
			const byEnergy = room.lookForAt(LOOK_ENERGY, 25, 25);
			const byResource = room.lookForAt(LOOK_RESOURCES, 25, 25);
			({
				energyIds: byEnergy.map(r => r.id),
				resourceIds: byResource.map(r => r.id),
				energyTypes: byEnergy.map(r => r.resourceType),
			})
		`) as { energyIds: string[]; resourceIds: string[]; energyTypes: string[] };

		expect(result.energyIds).toEqual([dropId]);
		expect(result.resourceIds).toEqual([dropId]);
		expect(result.energyTypes).toEqual([RESOURCE_ENERGY]);
	});

	test('ROOM-LOOK-008 lookForAtArea(LOOK_ENERGY) returns the same Resource shaped under the energy key', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const dropId = await shard.placeDroppedResource('W1N1', {
			pos: [25, 25], resourceType: RESOURCE_ENERGY, amount: 75,
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const room = Game.rooms['W1N1'];
			const energyArea = room.lookForAtArea(LOOK_ENERGY, 20, 20, 30, 30, true);
			const resourceArea = room.lookForAtArea(LOOK_RESOURCES, 20, 20, 30, 30, true);
			({
				energyIds: energyArea.map(e => e.energy && e.energy.id).filter(Boolean),
				resourceIds: resourceArea.map(e => e.resource && e.resource.id).filter(Boolean),
			})
		`) as { energyIds: string[]; resourceIds: string[] };

		expect(result.energyIds).toEqual([dropId]);
		expect(result.resourceIds).toEqual([dropId]);
	});

	test('ROOM-LOOK-009 lookAt yields both energy and resource entries on a dropped-resource tile', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const dropId = await shard.placeDroppedResource('W1N1', {
			pos: [25, 25], resourceType: RESOURCE_ENERGY, amount: 100,
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const items = Game.rooms['W1N1'].lookAt(25, 25);
			items
				.filter(i => i.type === 'energy' || i.type === 'resource')
				.map(i => ({ type: i.type, id: (i.energy || i.resource).id }))
		`) as Array<{ type: string; id: string }>;

		const energyEntries = result.filter(r => r.type === 'energy');
		const resourceEntries = result.filter(r => r.type === 'resource');
		expect(energyEntries).toEqual([{ type: 'energy', id: dropId }]);
		expect(resourceEntries).toEqual([{ type: 'resource', id: dropId }]);
	});

	test('ROOM-LOOK-010 lookForAt returns [] for valid LOOK_* constants whose register is empty', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const room = Game.rooms['W1N1'];
			({
				nukes: room.lookForAt(LOOK_NUKES, 25, 25),
				powerCreeps: room.lookForAt(LOOK_POWER_CREEPS, 25, 25),
				deposits: room.lookForAt(LOOK_DEPOSITS, 25, 25),
			})
		`) as { nukes: unknown; powerCreeps: unknown; deposits: unknown };

		expect(result.nukes).toEqual([]);
		expect(result.powerCreeps).toEqual([]);
		expect(result.deposits).toEqual([]);
	});
});
