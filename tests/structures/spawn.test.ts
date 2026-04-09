import {
	describe, test, expect, code,
	OK, ERR_NOT_ENOUGH_ENERGY, ERR_NAME_EXISTS, ERR_INVALID_ARGS, ERR_BUSY,
	WORK, CARRY, MOVE, TOUGH, BODYPART_COST,
	STRUCTURE_SPAWN, STRUCTURE_EXTENSION,
	CREEP_SPAWN_TIME, MAX_CREEP_SIZE,
	TOP, TOP_RIGHT, RIGHT, BOTTOM_RIGHT, BOTTOM, BOTTOM_LEFT, LEFT, TOP_LEFT,
	FIND_CREEPS, TERRAIN_WALL,
} from '../../src/index.js';
import { requireCapability } from '../support/policy.js';

describe('StructureSpawn', () => {
	const workerBodyCost = BODYPART_COST[WORK] + BODYPART_COST[CARRY] + BODYPART_COST[MOVE];

	test('SPAWN-CREATE-004 spawnCreep succeeds when available energy exactly matches the summed BODYPART_COST', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: workerBodyCost },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep([WORK, CARRY, MOVE], 'Worker1')
		`);
		expect(rc).toBe(OK);
	});

	test('SPAWN-CREATE-004 spawnCreep fails when available energy is 1 below the summed BODYPART_COST', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: workerBodyCost - 1 },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep([WORK, CARRY, MOVE], 'Worker1')
		`);
		expect(rc).toBe(ERR_NOT_ENOUGH_ENERGY);
	});

	test('SPAWN-CREATE-005 spawnCreep draws energy only from the listed energyStructures', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		const ext1 = await shard.placeStructure('W1N1', {
			pos: [26, 25], structureType: STRUCTURE_EXTENSION, owner: 'p1',
			store: { energy: 50 },
		});
		const ext2 = await shard.placeStructure('W1N1', {
			pos: [27, 25], structureType: STRUCTURE_EXTENSION, owner: 'p1',
			store: { energy: 50 },
		});

		const rc = await shard.runPlayer('p1', code`
			const spawn = Game.getObjectById(${spawnId});
			const selected = Game.getObjectById(${ext1});
			spawn.spawnCreep([MOVE], 'SelectedOnly', {
				energyStructures: [selected],
			})
		`);
		expect(rc).toBe(OK);

		await shard.tick();

		const spawn = await shard.expectStructure(spawnId, STRUCTURE_SPAWN);
		const selected = await shard.expectStructure(ext1, STRUCTURE_EXTENSION);
		const other = await shard.expectStructure(ext2, STRUCTURE_EXTENSION);
		expect(spawn.store.energy).toBe(300);
		expect(selected.store.energy ?? 0).toBe(0);
		expect(other.store.energy ?? 0).toBe(50);
	});

	test('SPAWN-CREATE-006 spawnCreep draws energy from listed energyStructures in listed order', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		const ext1 = await shard.placeStructure('W1N1', {
			pos: [26, 25], structureType: STRUCTURE_EXTENSION, owner: 'p1',
			store: { energy: 50 },
		});
		const ext2 = await shard.placeStructure('W1N1', {
			pos: [27, 25], structureType: STRUCTURE_EXTENSION, owner: 'p1',
			store: { energy: 50 },
		});

		const rc = await shard.runPlayer('p1', code`
			const spawn = Game.getObjectById(${spawnId});
			const first = Game.getObjectById(${ext1});
			const third = Game.getObjectById(${ext2});
			spawn.spawnCreep([WORK], 'OrderedDrain', {
				energyStructures: [first, spawn, third],
			})
		`);
		expect(rc).toBe(OK);

		await shard.tick();

		const first = await shard.expectStructure(ext1, STRUCTURE_EXTENSION);
		const spawn = await shard.expectStructure(spawnId, STRUCTURE_SPAWN);
		const third = await shard.expectStructure(ext2, STRUCTURE_EXTENSION);
		expect(first.store.energy ?? 0).toBe(0);
		expect(spawn.store.energy).toBe(250);
		expect(third.store.energy ?? 0).toBe(50);
	});

	test('SPAWN-CREATE-007 spawnCreep returns ERR_NOT_ENOUGH_ENERGY when the selected energy sources cannot pay the spawn cost', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 0 },
		});
		const ext1 = await shard.placeStructure('W1N1', {
			pos: [26, 25], structureType: STRUCTURE_EXTENSION, owner: 'p1',
			store: { energy: 50 },
		});
		const ext2 = await shard.placeStructure('W1N1', {
			pos: [27, 25], structureType: STRUCTURE_EXTENSION, owner: 'p1',
			store: { energy: 50 },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep(
				[WORK, CARRY, MOVE],
				'Worker1',
				{ energyStructures: [Game.getObjectById(${ext1}), Game.getObjectById(${ext2})] }
			)
		`);
		expect(rc).toBe(ERR_NOT_ENOUGH_ENERGY);
	});

	test('SPAWN-CREATE-008 spawnCreep returns ERR_NAME_EXISTS for duplicate name', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 600 },
		});

		// Place a creep with the name we'll try to spawn
		await shard.placeCreep('W1N1', {
			pos: [20, 20], owner: 'p1',
			body: [MOVE], name: 'DuplicateName',
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep([MOVE], 'DuplicateName')
		`);
		expect(rc).toBe(ERR_NAME_EXISTS);
	});

	test('SPAWN-CREATE-010 spawnCreep(..., { dryRun: true }) does not consume energy or create a creep', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 200 },
		});

		const result = await shard.runPlayer('p1', code`
			const spawn = Game.getObjectById(${spawnId});
			const rc = spawn.spawnCreep([WORK, CARRY, MOVE], 'DryRunWorker', { dryRun: true });
			({
				rc,
				energy: spawn.store.energy,
				hasCreep: !!Game.creeps['DryRunWorker'],
			})
		`) as { rc: number; energy: number; hasCreep: boolean };

		expect(result).toEqual({
			rc: OK,
			energy: 200,
			hasCreep: false,
		});
	});

	// ── New tests: body validation ──────────────────────────────

	test('SPAWN-CREATE-001 spawnCreep returns ERR_INVALID_ARGS for an empty body', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep([], 'EmptyBody')
		`);
		expect(rc).toBe(ERR_INVALID_ARGS);
	});

	test('SPAWN-CREATE-002 spawnCreep returns ERR_INVALID_ARGS for a body exceeding MAX_CREEP_SIZE', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 999999 },
		});

		// MAX_CREEP_SIZE is 50; create a body of 51 parts.
		const bigBody = Array(MAX_CREEP_SIZE + 1).fill('move').map(() => 'MOVE').join(',');
		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep([${bigBody}], 'TooBig')
		`);
		expect(rc).toBe(ERR_INVALID_ARGS);
	});

	test('SPAWN-CREATE-003 spawnCreep returns ERR_INVALID_ARGS for a body containing an invalid part name', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep(['notapart'], 'BadPart')
		`);
		expect(rc).toBe(ERR_INVALID_ARGS);
	});

	test('SPAWN-CREATE-009 spawnCreep returns ERR_BUSY when the spawn is already spawning', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 600 },
		});

		// Start spawning a creep.
		const first = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep([MOVE], 'First')
		`);
		expect(first).toBe(OK);
		// Don't tick enough for spawn to finish — CREEP_SPAWN_TIME * 1 part = 3 ticks.
		await shard.tick();

		// Try to spawn a second creep while the first is still in progress.
		const second = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep([MOVE], 'Second')
		`);
		expect(second).toBe(ERR_BUSY);
	});

	test('SPAWN-CREATE-011 spawnCreep(..., { memory }) seeds the spawned creep initial memory', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep([MOVE], 'MemTest', {
				memory: { role: 'scout', priority: 5 }
			})
		`);
		expect(rc).toBe(OK);

		// Advance past spawn time so creep fully exists.
		await shard.tick(CREEP_SPAWN_TIME);

		const mem = await shard.runPlayer('p1', code`
			Game.creeps['MemTest'].memory
		`);
		expect(mem).toEqual({ role: 'scout', priority: 5 });
	});

	// ── Spawning timing ─────────────────────────────────────────

	test('SPAWN-TIMING-001 spawning.needTime equals CREEP_SPAWN_TIME * body.length', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep([WORK, CARRY, MOVE], 'TimingTest')
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const spawn = await shard.expectStructure(spawnId, STRUCTURE_SPAWN);
		expect(spawn.spawning).not.toBeNull();
		expect(spawn.spawning!.needTime).toBe(CREEP_SPAWN_TIME * 3);
	});

	test('SPAWN-TIMING-002 spawning completes after needTime ticks and creep appears', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep([MOVE], 'SpawnComplete')
		`);
		expect(rc).toBe(OK);

		// CREEP_SPAWN_TIME * 1 part = 3 ticks to complete.
		// After the runPlayer tick + 2 more ticks, spawning should be done.
		await shard.tick(CREEP_SPAWN_TIME - 1);

		const spawn = await shard.expectStructure(spawnId, STRUCTURE_SPAWN);
		expect(spawn.spawning).toBeNull();

		// The creep should now exist in the game.
		const exists = await shard.runPlayer('p1', code`
			!!Game.creeps['SpawnComplete']
		`);
		expect(exists).toBe(true);
	});

	test('SPAWN-TIMING-003 default spawn direction priority: TOP first, then clockwise', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'terrain');
		await shard.ownedRoom('p1', 'W1N1', 2);

		// Wall TOP [25,24] so the spawn must pick the next default: TOP_RIGHT [26,24].
		const terrain = new Array<0 | 1 | 2>(2500).fill(0);
		terrain[24 * 50 + 25] = TERRAIN_WALL; // [25,24] = TOP
		await shard.setTerrain('W1N1', terrain);

		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep([MOVE], 'DirDefault')
		`);
		expect(rc).toBe(OK);
		await shard.tick(CREEP_SPAWN_TIME);

		const creeps = await shard.findInRoom('W1N1', FIND_CREEPS);
		const c = creeps.find(c => c.name === 'DirDefault');
		expect(c).toBeDefined();
		// TOP_RIGHT of [25,25] is [26,24].
		expect(c!.pos.x).toBe(26);
		expect(c!.pos.y).toBe(24);
	});

	test('SPAWN-TIMING-004 opts.directions selects exit tile from the provided order', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'terrain');
		await shard.ownedRoom('p1', 'W1N1', 2);

		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		await shard.tick();

		// Request BOTTOM as first direction — creep should exit to [25,26].
		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep([MOVE], 'DirCustom', {
				directions: [BOTTOM, LEFT, RIGHT]
			})
		`);
		expect(rc).toBe(OK);
		await shard.tick(CREEP_SPAWN_TIME);

		const creeps = await shard.findInRoom('W1N1', FIND_CREEPS);
		const c = creeps.find(c => c.name === 'DirCustom');
		expect(c).toBeDefined();
		// BOTTOM of [25,25] is [25,26].
		expect(c!.pos.x).toBe(25);
		expect(c!.pos.y).toBe(26);
	});

	test('SPAWN-TIMING-006 creep exits the spawn tile in the chosen direction on completion', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep([MOVE], 'ExitCreep')
		`);
		expect(rc).toBe(OK);

		// While spawning, creep is on spawn tile.
		await shard.tick();
		const spawning = await shard.runPlayer('p1', code`
			const c = Game.creeps['ExitCreep'];
			c ? ({ x: c.pos.x, y: c.pos.y, spawning: c.spawning }) : null
		`) as { x: number; y: number; spawning: boolean } | null;
		expect(spawning).not.toBeNull();
		expect(spawning!.x).toBe(25);
		expect(spawning!.y).toBe(25);
		expect(spawning!.spawning).toBe(true);

		// Complete spawning.
		await shard.tick(CREEP_SPAWN_TIME - 1);

		const creeps = await shard.findInRoom('W1N1', FIND_CREEPS);
		const c = creeps.find(c => c.name === 'ExitCreep');
		expect(c).toBeDefined();
		expect(c!.spawning).toBe(false);
		// Creep should no longer be on the spawn tile [25,25].
		const onSpawn = c!.pos.x === 25 && c!.pos.y === 25;
		expect(onSpawn).toBe(false);
	});
});
