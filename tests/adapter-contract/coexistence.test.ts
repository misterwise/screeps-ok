import {
	describe, test, expect, code,
	MOVE, CARRY, WORK,
	STRUCTURE_EXTRACTOR, STRUCTURE_ROAD, STRUCTURE_RAMPART,
	STRUCTURE_CONTAINER, RESOURCE_ENERGY,
	FIND_CREEPS, FIND_STRUCTURES, FIND_MINERALS,
	FIND_TOMBSTONES, FIND_DROPPED_RESOURCES, FIND_RUINS,
} from '../../src/index.js';

/**
 * Adapter contract: tile coexistence.
 *
 * Screeps allows multiple object types to share a tile. When the adapter
 * places co-located objects, each must keep a distinct ID that round-trips
 * through getObject, expectObject, expectStructure, and player-code
 * Game.getObjectById.
 *
 * These tests exercise the adapter's ID resolution, not gameplay rules.
 */
describe('adapter contract: tile coexistence', () => {
	// ── Required by design ─────────────────────────────────

	test('mineral + extractor on the same tile have distinct IDs', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 6, owner: 'p1' }],
		});
		const mineralId = await shard.placeMineral('W1N1', {
			pos: [25, 25], mineralType: 'H', mineralAmount: 50000,
		});
		const extractorId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_EXTRACTOR, owner: 'p1',
		});
		await shard.tick();

		const mineral = await shard.expectObject(mineralId, 'mineral');
		expect(mineral.mineralType).toBe('H');

		const extractor = await shard.expectStructure(extractorId, STRUCTURE_EXTRACTOR);
		expect(extractor.structureType).toBe('extractor');
	});

	test('mineral + extractor resolve to correct types in player code', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 6, owner: 'p1' }],
		});
		const mineralId = await shard.placeMineral('W1N1', {
			pos: [25, 25], mineralType: 'H', mineralAmount: 50000,
		});
		const extractorId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_EXTRACTOR, owner: 'p1',
		});

		const result = await shard.runPlayer('p1', code`
			const m = Game.getObjectById(${mineralId});
			const e = Game.getObjectById(${extractorId});
			({
				mineralHasType: typeof m?.mineralType === 'string',
				extractorHasType: e?.structureType === 'extractor',
				distinctIds: m?.id !== e?.id,
			})
		`) as { mineralHasType: boolean; extractorHasType: boolean; distinctIds: boolean };

		expect(result.mineralHasType).toBe(true);
		expect(result.extractorHasType).toBe(true);
		expect(result.distinctIds).toBe(true);
	});

	// ── Common gameplay ────────────────────────────────────

	test('road + rampart on the same tile have distinct IDs', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const roadId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_ROAD,
		});
		const rampartId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_RAMPART, owner: 'p1',
		});
		await shard.tick();

		const road = await shard.expectStructure(roadId, STRUCTURE_ROAD);
		expect(road.structureType).toBe('road');

		const rampart = await shard.expectStructure(rampartId, STRUCTURE_RAMPART);
		expect(rampart.structureType).toBe('rampart');
	});

	test('container + creep on the same tile have distinct IDs', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const containerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_CONTAINER,
			store: { energy: 100 },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [CARRY, MOVE],
		});
		await shard.tick();

		const container = await shard.expectStructure(containerId, STRUCTURE_CONTAINER);
		expect(container.store.energy).toBe(100);

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.body).toHaveLength(2);
	});

	test('container + dropped resource on the same tile have distinct IDs', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const containerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_CONTAINER,
			store: { energy: 50 },
		});
		const resourceId = await shard.placeDroppedResource('W1N1', {
			pos: [25, 25], resourceType: RESOURCE_ENERGY, amount: 30,
		});
		await shard.tick();

		const container = await shard.expectStructure(containerId, STRUCTURE_CONTAINER);
		expect(container.store.energy).toBe(50);

		// Dropped resources decay by 1 per tick; we ticked once so 30 → 29
		const resource = await shard.expectObject(resourceId, 'resource');
		expect(resource.amount).toBe(29);
	});

	test('road + creep on the same tile have distinct IDs', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const roadId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_ROAD,
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE],
		});
		await shard.tick();

		const road = await shard.expectStructure(roadId, STRUCTURE_ROAD);
		expect(road.structureType).toBe('road');

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.body).toHaveLength(1);
	});

	// ── Three-way coexistence ──────────────────────────────

	test('road + rampart + creep on the same tile all resolve independently', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const roadId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_ROAD,
		});
		const rampartId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_RAMPART, owner: 'p1',
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE],
		});
		await shard.tick();

		const road = await shard.expectStructure(roadId, STRUCTURE_ROAD);
		expect(road.structureType).toBe('road');

		const rampart = await shard.expectStructure(rampartId, STRUCTURE_RAMPART);
		expect(rampart.structureType).toBe('rampart');

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.owner).toBe('p1');
	});

	// ── findInRoom returns all co-located objects ──────────

	test('findInRoom returns both structures when two share a tile', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_ROAD,
		});
		await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_RAMPART, owner: 'p1',
		});
		await shard.tick();

		const structures = await shard.findInRoom('W1N1', FIND_STRUCTURES);
		const atTile = structures.filter(s => s.pos.x === 25 && s.pos.y === 25);
		const types = atTile.map(s => s.structureType).sort();
		expect(types).toContain('road');
		expect(types).toContain('rampart');
	});
});
