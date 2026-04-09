import { describe, test, expect, code,
	OK,
	MOVE, TOUGH,
	STRUCTURE_SPAWN, STRUCTURE_WALL,
	FIND_CREEPS, FIND_TOMBSTONES, BODYPART_HITS,
	CREEP_SPAWN_TIME,
	TERRAIN_WALL,
	BOTTOM,
} from '../../src/index.js';
import { requireCapability } from '../support/policy.js';

// Spawn stomp occurs when:
// 1. All preferred spawn directions are blocked
// 2. A hostile creep occupies one of those blocked tiles
// 3. All OTHER directions are also blocked (no escape route)
// → The hostile creep is destroyed and the new creep spawns on its tile.
//
// Setup: Spawn at center of a 3x3 wall pocket with one tile holding a hostile.
// We use terrain walls to block 7 of 8 adjacent tiles.

describe('Spawn stomping', () => {
	test('SPAWN-STOMP-001 hostile creep is destroyed when all tiles are blocked', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'terrain');
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});

		// Build terrain: wall everywhere around [25,25] except [25,26].
		const terrain = new Array<0 | 1 | 2>(2500).fill(0);
		// Adjacent positions: [24,24],[25,24],[26,24],[24,25],[26,25],[24,26],[26,26]
		const wallPositions = [
			[24, 24], [25, 24], [26, 24],
			[24, 25], /* spawn */ [26, 25],
			[24, 26], /* hostile */ [26, 26],
		];
		for (const [x, y] of wallPositions) {
			terrain[y * 50 + x] = TERRAIN_WALL;
		}
		await shard.setTerrain('W1N1', terrain);

		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});

		// Hostile on the only non-wall adjacent tile.
		const hostileId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2', body: [TOUGH, MOVE],
		});
		await shard.tick();

		// Start spawning a creep (1 MOVE = 1 part × CREEP_SPAWN_TIME ticks).
		const spawnRc = await shard.runPlayer('p1', code`
			Object.values(Game.spawns)[0].spawnCreep([MOVE], 'StompTest')
		`);
		expect(spawnRc).toBe(OK);

		// Advance until spawn completes (CREEP_SPAWN_TIME per body part).
		await shard.tick(CREEP_SPAWN_TIME);

		// The hostile should be gone (stomped).
		const hostile = await shard.getObject(hostileId);
		expect(hostile).toBeNull();
	});

	test('SPAWN-STOMP-002 new creep appears on the vacated tile', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'terrain');
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});

		const terrain = new Array<0 | 1 | 2>(2500).fill(0);
		const wallPositions = [
			[24, 24], [25, 24], [26, 24],
			[24, 25], [26, 25],
			[24, 26], [26, 26],
		];
		for (const [x, y] of wallPositions) {
			terrain[y * 50 + x] = TERRAIN_WALL;
		}
		await shard.setTerrain('W1N1', terrain);

		await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2', body: [TOUGH, MOVE],
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Object.values(Game.spawns)[0].spawnCreep([MOVE], 'StompCreep')
		`);
		await shard.tick(CREEP_SPAWN_TIME);

		// The new creep should be at [25,26] (where the hostile was).
		const creeps = await shard.findInRoom('W1N1', FIND_CREEPS);
		const newCreep = creeps.find(c => c.name === 'StompCreep');
		expect(newCreep).toBeDefined();
		expect(newCreep!.pos.x).toBe(25);
		expect(newCreep!.pos.y).toBe(26);
		expect(newCreep!.spawning).toBe(false);
	});

	test('SPAWN-STOMP-004 no stomp if an open tile exists in preferred directions', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'terrain');
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});

		// Wall 6 of 8 tiles. Leave [25,26] (hostile) and [26,25] (open).
		const terrain = new Array<0 | 1 | 2>(2500).fill(0);
		const wallPositions = [
			[24, 24], [25, 24], [26, 24],
			[24, 25], /* spawn */ /* [26,25] open */
			[24, 26], /* hostile */ [26, 26],
		];
		for (const [x, y] of wallPositions) {
			terrain[y * 50 + x] = TERRAIN_WALL;
		}
		await shard.setTerrain('W1N1', terrain);

		await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		const hostileId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2', body: [TOUGH, MOVE],
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Object.values(Game.spawns)[0].spawnCreep([MOVE], 'NoStomp')
		`);
		await shard.tick(CREEP_SPAWN_TIME);

		// Hostile should still be alive — an open tile was available.
		const hostile = await shard.expectObject(hostileId, 'creep');
		expect(hostile.hits).toBe(2 * BODYPART_HITS);

		// New creep should have spawned on the open tile [26,25].
		const creeps = await shard.findInRoom('W1N1', FIND_CREEPS);
		const newCreep = creeps.find(c => c.name === 'NoStomp');
		expect(newCreep).toBeDefined();
		expect(newCreep!.pos.x).toBe(26);
		expect(newCreep!.pos.y).toBe(25);
	});

	test('SPAWN-STOMP-003 stomp destroys the hostile outside normal combat damage resolution', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'terrain');
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});

		// Wall all 8 tiles except [25,26] where the hostile sits.
		const terrain = new Array<0 | 1 | 2>(2500).fill(0);
		for (const [x, y] of [
			[24, 24], [25, 24], [26, 24],
			[24, 25], [26, 25],
			[24, 26], [26, 26],
		]) {
			terrain[y * 50 + x] = TERRAIN_WALL;
		}
		await shard.setTerrain('W1N1', terrain);

		await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		// Hostile with many hits — stomp should destroy it outright, not deal
		// incremental combat damage.
		const hostileId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2',
			body: [TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, MOVE],
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Object.values(Game.spawns)[0].spawnCreep([MOVE], 'StompKill')
		`);
		await shard.tick(CREEP_SPAWN_TIME);

		// Hostile is fully destroyed regardless of HP — not partially damaged.
		const hostile = await shard.getObject(hostileId);
		expect(hostile).toBeNull();

		// Tombstone should exist at the stomped position.
		const tombs = await shard.findInRoom('W1N1', FIND_TOMBSTONES);
		const tomb = tombs.find(t => t.pos.x === 25 && t.pos.y === 26);
		expect(tomb).toBeDefined();
	});

	test('SPAWN-STOMP-006 restricted directions: no stomp if open tile exists outside chosen directions', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'terrain');
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});

		// Hostile at BOTTOM [25,26]. Wall the other directions in the
		// chosen set but leave RIGHT [26,25] open (outside the chosen set).
		const terrain = new Array<0 | 1 | 2>(2500).fill(0);
		// Wall TOP, TOP_RIGHT, BOTTOM_RIGHT, BOTTOM_LEFT, LEFT, TOP_LEFT
		for (const [x, y] of [
			[25, 24], [26, 24],    // TOP, TOP_RIGHT
			[26, 26],              // BOTTOM_RIGHT
			[24, 26], [24, 25], [24, 24], // BOTTOM_LEFT, LEFT, TOP_LEFT
		]) {
			terrain[y * 50 + x] = TERRAIN_WALL;
		}
		// [26,25] RIGHT is open, [25,26] BOTTOM has hostile
		await shard.setTerrain('W1N1', terrain);

		await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		const hostileId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2', body: [TOUGH, MOVE],
		});
		await shard.tick();

		// Request BOTTOM only — hostile blocks it, but RIGHT is open.
		await shard.runPlayer('p1', code`
			Object.values(Game.spawns)[0].spawnCreep([MOVE], 'NoStompDir', {
				directions: [BOTTOM]
			})
		`);
		await shard.tick(CREEP_SPAWN_TIME);

		// Hostile survives — open tile existed, so no stomp.
		const hostile = await shard.expectObject(hostileId, 'creep');
		expect(hostile.hits).toBe(2 * BODYPART_HITS);
	});

	test('SPAWN-STOMP-005 no stomp when all tiles blocked but no hostiles', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'terrain');
		await shard.ownedRoom('p1', 'W1N1', 1);

		// Wall all 8 adjacent tiles — no hostiles, no open tiles.
		const terrain = new Array<0 | 1 | 2>(2500).fill(0);
		const allAdj = [
			[24, 24], [25, 24], [26, 24],
			[24, 25], [26, 25],
			[24, 26], [25, 26], [26, 26],
		];
		for (const [x, y] of allAdj) {
			terrain[y * 50 + x] = TERRAIN_WALL;
		}
		await shard.setTerrain('W1N1', terrain);

		await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Object.values(Game.spawns)[0].spawnCreep([MOVE], 'Stuck')
		`);
		// Advance past spawn time — creep should not spawn (no exit tile).
		await shard.tick(CREEP_SPAWN_TIME + 2);

		// The creep should still be in spawning state or not exist at the
		// position. Check that no non-spawning creep named 'Stuck' exists.
		const creeps = await shard.findInRoom('W1N1', FIND_CREEPS);
		const stuck = creeps.find(c => c.name === 'Stuck');
		if (stuck) {
			// Creep exists but should still be spawning (delayed).
			expect(stuck.spawning).toBe(true);
		}
		// Either spawning or not found — both indicate no stomp occurred.
	});
});
