import {
	describe, test, expect, code,
	MOVE, CARRY,
	FIND_MY_CREEPS, FIND_HOSTILE_CREEPS, FIND_MY_STRUCTURES, FIND_HOSTILE_STRUCTURES, FIND_SOURCES,
	LOOK_CREEPS,
	STRUCTURE_EXTENSION, STRUCTURE_SPAWN,
	RESOURCE_ENERGY,
} from '../../src/index.js';
import { roomFindPlayerRelativeCases } from '../../src/matrices/room-find.js';

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

	test('ROOM-VIS-003 existing but unowned room with no player presence has no Game.rooms entry', async ({ shard }) => {
		// Stricter than ROOM-VIS-002: W2N1 is loaded in the engine (exists as
		// a real room), just unowned with no p1 structures or creeps. Canonical
		// Game API must still hide it from p1. Engines that populate Game.rooms
		// from the engine-loaded set (rather than per-player visibility) fail
		// this case while passing VIS-002.
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1' },
			],
		});
		await shard.tick();

		const visible = await shard.runPlayer('p1', code`
			!!Game.rooms['W2N1']
		`);
		expect(visible).toBe(false);
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

