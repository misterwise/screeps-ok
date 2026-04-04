import {
	describe, test, expect, code,
	MOVE, CARRY,
	FIND_MY_CREEPS, FIND_HOSTILE_CREEPS, FIND_SOURCES,
	LOOK_CREEPS,
	STRUCTURE_EXTENSION, STRUCTURE_SPAWN,
	RESOURCE_ENERGY,
} from '../../src/index.js';

describe('room visibility', () => {
	test('visible room has a Game.rooms entry on that tick', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const hasRoom = await shard.runPlayer('p1', code`
			!!Game.rooms['W1N1']
		`);

		expect(hasRoom).toBe(true);
	});

	test('non-visible room has no Game.rooms entry on that tick', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1');

		const hasRoom = await shard.runPlayer('p1', code`
			!!Game.rooms['W2N1']
		`);

		expect(hasRoom).toBe(false);
	});
});

describe('room energy tracking', () => {
	test('room.energyAvailable equals the sum of stored energy in active spawns and extensions', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		await shard.placeStructure('W1N1', {
			pos: [25, 25],
			structureType: STRUCTURE_EXTENSION,
			owner: 'p1',
			store: { energy: 20 },
		});
		await shard.placeStructure('W1N1', {
			pos: [26, 25],
			structureType: STRUCTURE_EXTENSION,
			owner: 'p1',
			store: { energy: 50 },
		});
		await shard.tick();

		const energyAvailable = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].energyAvailable
		`);

		expect(energyAvailable).toBe(70);
	});

	test('room.energyCapacityAvailable equals the sum of energy capacity in active spawns and extensions', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		await shard.placeStructure('W1N1', {
			pos: [25, 25],
			structureType: STRUCTURE_EXTENSION,
			owner: 'p1',
			store: { energy: 0 },
		});
		await shard.placeStructure('W1N1', {
			pos: [26, 25],
			structureType: STRUCTURE_EXTENSION,
			owner: 'p1',
			store: { energy: 0 },
		});
		await shard.tick();

		const energyCapacityAvailable = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].energyCapacityAvailable
		`);

		expect(energyCapacityAvailable).toBe(100);
	});
});

describe('Room.find', () => {
	test('player-relative FIND constants evaluate from the current player perspective', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE], name: 'Mine',
		});
		await shard.placeCreep('W1N1', {
			pos: [26, 25], owner: 'p2', body: [MOVE], name: 'Hostile',
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const room = Game.rooms['W1N1'];
			({
				my: room.find(FIND_MY_CREEPS).map(c => c.name).sort(),
				hostile: room.find(FIND_HOSTILE_CREEPS).map(c => c.name).sort(),
			})
		`) as { my: string[]; hostile: string[] };

		expect(result.my).toEqual(['Mine']);
		expect(result.hostile).toEqual(['Hostile']);
	});

	test('Room.find(type, { filter }) applies the filter to the selected result set', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE], name: 'Keep',
		});
		await shard.placeCreep('W1N1', {
			pos: [26, 25], owner: 'p1', body: [MOVE], name: 'Drop',
		});
		await shard.tick();

		const names = await shard.runPlayer('p1', code`
			Game.rooms['W1N1']
				.find(FIND_MY_CREEPS, { filter: c => c.name === 'Keep' })
				.map(c => c.name)
		`) as string[];

		expect(names).toEqual(['Keep']);
	});

	test('FIND_SOURCES returns sources in the room', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeSource('W1N1', { pos: [10, 10] });
		await shard.placeSource('W1N1', { pos: [40, 40] });
		await shard.tick();

		const count = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].find(FIND_SOURCES).length
		`);

		expect(count).toBe(2);
	});
});

describe('Room look APIs', () => {
	test('lookForAt(type, x, y) returns only entries of the requested LOOK_* type at that position', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE], name: 'LookTest',
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			({
				creeps: Game.rooms['W1N1'].lookForAt(LOOK_CREEPS, 25, 25).map(c => c.name),
				structures: Game.rooms['W1N1'].lookForAt(LOOK_STRUCTURES, 25, 25).length,
			})
		`) as { creeps: string[]; structures: number };

		expect(result.creeps).toEqual(['LookTest']);
		expect(result.structures).toBe(0);
	});
});

describe('RoomPosition basics', () => {
	test('RoomPosition exposes x, y, and roomName', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const pos = new RoomPosition(10, 20, 'W1N1');
			({ x: pos.x, y: pos.y, roomName: pos.roomName })
		`) as { x: number; y: number; roomName: string };

		expect(result).toEqual({ x: 10, y: 20, roomName: 'W1N1' });
	});
});

describe('RoomPosition find helpers', () => {
	test('findInRange() returns all matching objects within the given range', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE], name: 'NearA',
		});
		await shard.placeCreep('W1N1', {
			pos: [27, 25], owner: 'p1', body: [MOVE], name: 'NearB',
		});
		await shard.placeCreep('W1N1', {
			pos: [40, 40], owner: 'p1', body: [MOVE], name: 'Far',
		});
		await shard.tick();

		const names = await shard.runPlayer('p1', code`
			new RoomPosition(25, 25, 'W1N1')
				.findInRange(FIND_MY_CREEPS, 2)
				.map(c => c.name)
				.sort()
		`) as string[];

		expect(names).toEqual(['NearA', 'NearB']);
	});

	test('findClosestByPath() returns a target already on the same tile before considering other targets', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeSource('W1N1', { pos: [25, 25] });
		await shard.placeSource('W1N1', { pos: [30, 30] });
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const source = new RoomPosition(25, 25, 'W1N1').findClosestByPath(FIND_SOURCES);
			source ? ({ x: source.pos.x, y: source.pos.y }) : null
		`) as { x: number; y: number } | null;

		expect(result).toEqual({ x: 25, y: 25 });
	});
});

describe('store access', () => {
	test('store[RESOURCE_TYPE] returns 0 when the store currently holds none of that resource', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const containerId = await shard.placeStructure('W1N1', {
			pos: [25, 25],
			structureType: STRUCTURE_EXTENSION,
			owner: 'p1',
			store: { energy: 0 },
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			Game.getObjectById(${containerId}).store[${RESOURCE_ENERGY}]
		`);

		expect(result).toBe(0);
	});

	test('store.getCapacity(type) returns null when the store cannot hold that resource type', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25],
			structureType: STRUCTURE_SPAWN,
			owner: 'p1',
			store: { energy: 0 },
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).store.getCapacity('H')
		`);

		expect(result).toBeNull();
	});
});
