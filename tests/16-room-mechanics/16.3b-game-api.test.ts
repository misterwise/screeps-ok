import {
	describe, test, expect, code,
	MOVE, CARRY,
	FIND_MY_CREEPS, FIND_HOSTILE_CREEPS, FIND_MY_STRUCTURES, FIND_HOSTILE_STRUCTURES,
	FIND_SOURCES, FIND_SOURCES_ACTIVE,
	LOOK_CREEPS,
	STRUCTURE_EXTENSION, STRUCTURE_FACTORY, STRUCTURE_SPAWN, STRUCTURE_ROAD, STRUCTURE_STORAGE, STRUCTURE_TERMINAL, STRUCTURE_WALL,
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
		// this case while passing ROOM-VIS-002.
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

describe('room structure shortcuts', () => {
	test('ROOM-STRUCTURE-001:storage room.storage exposes the storage object or undefined', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 8, owner: 'p1' },
				{ name: 'W2N1', rcl: 8, owner: 'p1' },
			],
		});
		const storageId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_STORAGE, owner: 'p1',
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const storage = Game.rooms['W1N1'].storage;
			({
				present: storage && { id: storage.id, structureType: storage.structureType },
				absentType: typeof Game.rooms['W2N1'].storage,
			})
		`) as { present: { id: string; structureType: string }; absentType: string };
		expect(result).toEqual({
			present: { id: storageId, structureType: STRUCTURE_STORAGE },
			absentType: 'undefined',
		});
	});

	test('ROOM-STRUCTURE-001:terminal room.terminal exposes the terminal object or undefined', async ({ shard }) => {
		shard.requires('market');
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 8, owner: 'p1' },
				{ name: 'W2N1', rcl: 8, owner: 'p1' },
			],
		});
		const terminalId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p1',
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const terminal = Game.rooms['W1N1'].terminal;
			({
				present: terminal && { id: terminal.id, structureType: terminal.structureType },
				absentType: typeof Game.rooms['W2N1'].terminal,
			})
		`) as { present: { id: string; structureType: string }; absentType: string };
		expect(result).toEqual({
			present: { id: terminalId, structureType: STRUCTURE_TERMINAL },
			absentType: 'undefined',
		});
	});

	test('ROOM-STRUCTURE-001:factory room.factory exposes the factory object or undefined', async ({ shard }) => {
		shard.requires('factory');
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 8, owner: 'p1' },
				{ name: 'W2N1', rcl: 8, owner: 'p1' },
			],
		});
		const factoryId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_FACTORY, owner: 'p1',
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const factory = Game.rooms['W1N1'].factory;
			({
				present: factory && { id: factory.id, structureType: factory.structureType },
				absentType: typeof Game.rooms['W2N1'].factory,
			})
		`) as { present: { id: string; structureType: string }; absentType: string };
		expect(result).toEqual({
			present: { id: factoryId, structureType: STRUCTURE_FACTORY },
			absentType: 'undefined',
		});
	});
});

describe('Room.find', () => {
	for (const { label, findConstant, expectedValues } of roomFindPlayerRelativeCases) {
		test(`ROOM-FIND-001:${label} returns exactly the expected set for the current player`, async ({ shard }) => {
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
			// Unowned structures: must appear in FIND_STRUCTURES but in
			// neither FIND_MY_STRUCTURES nor FIND_HOSTILE_STRUCTURES.
			await shard.placeStructure('W1N1', {
				pos: [23, 25], structureType: STRUCTURE_ROAD,
			});
			await shard.placeStructure('W1N1', {
				pos: [28, 25], structureType: STRUCTURE_WALL,
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

	test('ROOM-FIND-002:functionFilter Room.find(type, { filter: fn }) returns only matching items', async ({ shard }) => {
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
				.sort()
		`) as string[];

		expect(names).toEqual(['Keep']);
	});

	test('ROOM-FIND-002:objectPatternFilter Room.find(type, { filter: pattern }) returns only matching items', async ({ shard }) => {
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
				.find(FIND_MY_CREEPS, { filter: { name: 'Keep' } })
				.map(c => c.name)
				.sort()
		`) as string[];

		expect(names).toEqual(['Keep']);
	});

	test('ROOM-FIND-005 FIND_SOURCES returns every source; FIND_SOURCES_ACTIVE only those with energy > 0', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const fullId = await shard.placeSource('W1N1', { pos: [10, 10], energy: 3000 });
		const emptyId = await shard.placeSource('W1N1', { pos: [40, 40], energy: 0 });
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const room = Game.rooms['W1N1'];
			({
				allIds: room.find(FIND_SOURCES).map(s => s.id).sort(),
				activeIds: room.find(FIND_SOURCES_ACTIVE).map(s => s.id).sort(),
			})
		`) as { allIds: string[]; activeIds: string[] };

		expect(result.allIds).toEqual([fullId, emptyId].sort());
		expect(result.activeIds).toEqual([fullId]);
	});
});
