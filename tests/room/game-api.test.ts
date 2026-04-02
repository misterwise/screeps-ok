import { describe, test, expect, code, MOVE, STRUCTURE_SPAWN } from '../../src/index.js';

describe('Game object API', () => {
	test('Game.time is a positive number', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const time = await shard.runPlayer('p1', code`Game.time`);
		expect(typeof time).toBe('number');
		expect(time as number).toBeGreaterThan(0);
	});

	test('Game.rooms contains visible rooms', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const result = await shard.runPlayer('p1', code`
			Object.keys(Game.rooms)
		`) as string[];
		expect(result).toContain('W1N1');
	});

	test('Game.creeps contains owned creeps', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [MOVE], name: 'TestBot',
		});

		const names = await shard.runPlayer('p1', code`
			Object.keys(Game.creeps)
		`) as string[];
		expect(names).toContain('TestBot');
	});

	test('Game.spawns contains owned spawns', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
		});

		const result = await shard.runPlayer('p1', code`
			Object.keys(Game.spawns).length
		`);
		expect(result as number).toBeGreaterThanOrEqual(1);
	});

	test('Game.getObjectById returns null for invalid ID', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const result = await shard.runPlayer('p1', code`
			Game.getObjectById('nonexistent_id_12345')
		`);
		expect(result).toBeNull();
	});

	test('Room.find returns array of objects', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [MOVE], name: 'FindTest',
		});

		const count = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].find(FIND_MY_CREEPS).length
		`);
		expect(count as number).toBeGreaterThanOrEqual(1);
	});

	test('Room.lookForAt returns objects at position', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [MOVE], name: 'LookTest',
		});

		const count = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].lookForAt(LOOK_CREEPS, 25, 25).length
		`);
		expect(count as number).toBeGreaterThanOrEqual(1);
	});

	test('RoomPosition can be constructed', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const result = await shard.runPlayer('p1', code`
			const pos = new RoomPosition(10, 20, 'W1N1');
			({ x: pos.x, y: pos.y, roomName: pos.roomName })
		`) as any;
		expect(result.x).toBe(10);
		expect(result.y).toBe(20);
		expect(result.roomName).toBe('W1N1');
	});

	test('RoomPosition.findInRange works', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE], name: 'Near',
		});
		await shard.placeCreep('W1N1', {
			pos: [40, 40], owner: 'p1', body: [MOVE], name: 'Far',
		});

		const count = await shard.runPlayer('p1', code`
			new RoomPosition(25, 25, 'W1N1').findInRange(FIND_MY_CREEPS, 3).length
		`);
		expect(count).toBe(1); // only 'Near' is within range 3
	});

	test('RoomPosition.findClosestByPath works', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeSource('W1N1', { pos: [10, 10] });
		await shard.placeSource('W1N1', { pos: [30, 30] });
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE], name: 'Finder',
		});

		const result = await shard.runPlayer('p1', code`
			const creep = Game.creeps['Finder'];
			const source = creep.pos.findClosestByPath(FIND_SOURCES);
			source ? ({ x: source.pos.x, y: source.pos.y }) : null
		`) as any;

		expect(result).not.toBeNull();
		// The closest source to (25,25) should be (30,30) by path distance
		// (since (10,10) is further)
		expect(result.x).toBe(30);
		expect(result.y).toBe(30);
	});
});
