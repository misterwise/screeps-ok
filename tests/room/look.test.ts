import { describe, test, expect, code,
	MOVE, CARRY,
	STRUCTURE_SPAWN, STRUCTURE_ROAD,
	LOOK_STRUCTURES, LOOK_CREEPS, LOOK_TERRAIN,
} from '../../src/index.js';

describe('Room look API', () => {
	test('ROOM-LOOK-001 lookAt returns all objects on the specified tile', async ({ shard }) => {
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
		// Should contain at least 'terrain', 'structure' (road), and 'creep'.
		const types = result as string[];
		expect(types).toContain('terrain');
		expect(types).toContain('structure');
		expect(types).toContain('creep');
	});

	test('ROOM-LOOK-002 lookForAt(LOOK_STRUCTURES) returns only structures at the tile', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const roadId = await shard.placeStructure('W1N1', {
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
		const creepId = await shard.placeCreep('W1N1', {
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
		// Default terrain is plain.
		expect(result).toEqual(['plain']);
	});

	test('ROOM-LOOK-005 lookForAtArea returns objects within the bounding box', async ({ shard }) => {
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
});
