import {
	describe, test, expect, code,
	MOVE, CARRY,
	FIND_MY_CREEPS, FIND_HOSTILE_CREEPS, FIND_MY_STRUCTURES, FIND_HOSTILE_STRUCTURES, FIND_SOURCES,
	LOOK_CREEPS,
	STRUCTURE_EXTENSION, STRUCTURE_SPAWN,
	RESOURCE_ENERGY,
} from '../../src/index.js';
import { roomFindPlayerRelativeCases } from '../support/matrices/room-find.js';

describe('room visibility', () => {
	test('ROOM-VIS-001 visible room has a Game.rooms entry on that tick', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const hasRoom = await shard.runPlayer('p1', code`
			!!Game.rooms['W1N1']
		`);

		expect(hasRoom).toBe(true);
	});

	test('ROOM-VIS-002 non-visible room has no Game.rooms entry on that tick', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1');

		const hasRoom = await shard.runPlayer('p1', code`
			!!Game.rooms['W2N1']
		`);

		expect(hasRoom).toBe(false);
	});
});

describe('room energy tracking', () => {
	test('ROOM-ENERGY-001 [active-extensions] room.energyAvailable sums stored energy in active extensions', async ({ shard }) => {
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
			store: { energy: 17 },
		});
		await shard.tick();

		const energyAvailable = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].energyAvailable
		`);

		expect(energyAvailable).toBe(37);
	});

	test('ROOM-ENERGY-001 [inactive-extension] room.energyAvailable excludes an inactive extension', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const extensionId = await shard.placeStructure('W1N1', {
			pos: [25, 25],
			structureType: STRUCTURE_EXTENSION,
			owner: 'p1',
			store: { energy: 37 },
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const extension = Game.getObjectById(${extensionId});
			({
				energyAvailable: Game.rooms['W1N1'].energyAvailable,
				extensionActive: extension.isActive(),
			})
		`) as {
			energyAvailable: number;
			extensionActive: boolean;
		};

		expect(result).toEqual({
			energyAvailable: 0,
			extensionActive: false,
		});
	});

	test('ROOM-ENERGY-002 [active-extensions] room.energyCapacityAvailable sums energy capacity in active extensions', async ({ shard }) => {
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

	test('ROOM-ENERGY-002 [inactive-extension] room.energyCapacityAvailable excludes an inactive extension', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const extensionId = await shard.placeStructure('W1N1', {
			pos: [25, 25],
			structureType: STRUCTURE_EXTENSION,
			owner: 'p1',
			store: { energy: 0 },
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const extension = Game.getObjectById(${extensionId});
			({
				energyCapacityAvailable: Game.rooms['W1N1'].energyCapacityAvailable,
				extensionActive: extension.isActive(),
			})
		`) as {
			energyCapacityAvailable: number;
			extensionActive: boolean;
		};

		expect(result).toEqual({
			energyCapacityAvailable: 0,
			extensionActive: false,
		});
	});
});

describe('Room.find', () => {
	for (const { label, findConstant, expectedValues } of roomFindPlayerRelativeCases) {
		test(`ROOM-FIND-001 [${label}] player-relative FIND constants evaluate from the current player perspective`, async ({ shard }) => {
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
		await shard.placeStructure('W1N1', {
			pos: [24, 25], owner: 'p1', structureType: STRUCTURE_SPAWN,
		});
		await shard.placeStructure('W1N1', {
			pos: [27, 25], owner: 'p2', structureType: STRUCTURE_SPAWN,
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			Game.rooms['W1N1']
				.find(${findConstant})
				.map(obj => obj.structureType || obj.name)
				.sort()
		`) as string[];

		expect(result).toEqual(expectedValues);
		});
	}

	test('ROOM-FIND-002 Room.find(type, { filter }) applies the filter to the selected result set', async ({ shard }) => {
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

	test('ROOM-FIND-005 FIND_SOURCES returns sources in the room', async ({ shard }) => {
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
	test('ROOMPOS-LOOK-002 lookForAt(type, x, y) returns only entries of the requested LOOK_* type at that position', async ({ shard }) => {
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
	test('ROOMPOS-001 RoomPosition exposes x, y, and roomName', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const pos = new RoomPosition(10, 20, 'W1N1');
			({ x: pos.x, y: pos.y, roomName: pos.roomName })
		`) as { x: number; y: number; roomName: string };

		expect(result).toEqual({ x: 10, y: 20, roomName: 'W1N1' });
	});
});

describe('RoomPosition find helpers', () => {
	test('ROOMPOS-FIND-004 findInRange() returns all matching objects within the given range', async ({ shard }) => {
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

	test('ROOMPOS-FIND-001 findClosestByPath() returns a target already on the same tile before considering other targets', async ({ shard }) => {
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
	test('STORE-ACCESS-001 store[RESOURCE_TYPE] returns 0 when the store currently holds none of that resource', async ({ shard }) => {
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

	test('STORE-ACCESS-002 store.getCapacity(type) returns null when the store cannot hold that resource type', async ({ shard }) => {
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
