import { describe, test, expect, code,
	MOVE, WORK, OK, ERR_NO_BODYPART, ERR_NOT_FOUND, ERR_NO_PATH, ERR_TIRED,
	ERR_INVALID_ARGS, ERR_NOT_OWNER, ERR_NOT_IN_RANGE, ERR_BUSY, ERR_INVALID_TARGET,
	TOP, BOTTOM, RIGHT, STRUCTURE_SPAWN,
} from '../../src/index.js';
import { moveDirectionCases } from '../../src/matrices/move-directions.js';
import {
	TERRAIN_FIXTURE_ROOM, TERRAIN_FIXTURE_SPEC, TERRAIN_FIXTURE_LANDMARKS,
} from '../../src/terrain-fixture.js';

describe('creep.move()', () => {
	for (const { label, direction, dx, dy } of moveDirectionCases) {
		test(`MOVE-BASIC-001 [${label}] move(direction) moves one tile toward the direction constant`, async ({ shard }) => {
			await shard.ownedRoom('p1');
			const id = await shard.placeCreep('W1N1', {
				pos: [25, 25], owner: 'p1', body: [MOVE],
			});

			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${id}).move(${direction})
			`);
			expect(rc).toBe(OK);

			await shard.tick();
			const c = await shard.expectObject(id, 'creep');
			expect(c.pos.x).toBe(25 + dx);
			expect(c.pos.y).toBe(25 + dy);
		});
	}

	test('MOVE-BASIC-002 move() into a wall tile returns OK but the creep does not move', async ({ shard }) => {
		shard.requires('terrain', 'custom terrain setup is required for wall-movement assertions');
		const terrain = new Array(2500).fill(0);
		terrain[24 * 50 + 25] = 1;
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1', terrain }],
		});
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE],
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${id}).move(TOP)
		`);
		expect(rc).toBe(OK);

		await shard.tick();
		const c = await shard.expectObject(id, 'creep');
		expect(c.pos.x).toBe(25);
		expect(c.pos.y).toBe(25);
	});

	test('MOVE-BASIC-004 move() returns ERR_NO_BODYPART when the creep has no active MOVE parts', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [WORK],
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${id}).move(TOP)
		`);
		expect(rc).toBe(ERR_NO_BODYPART);

		await shard.tick();
		const c = await shard.expectObject(id, 'creep');
		expect(c.pos.x).toBe(25);
		expect(c.pos.y).toBe(25);
	});

	test('MOVE-BASIC-005 move() returns ERR_INVALID_ARGS for invalid direction', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${id}).move(99)
		`);
		expect(rc).toBe(ERR_INVALID_ARGS);
	});

	test('MOVE-BASIC-006 move(targetCreep) on adjacent creep returns OK', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE], name: 'mover',
		});
		await shard.placeCreep('W1N1', {
			pos: [25, 24], owner: 'p1', body: [MOVE], name: 'target',
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.creeps['mover'].move(Game.creeps['target'])
		`);
		expect(rc).toBe(OK);
	});

	test('MOVE-BASIC-007 move(targetCreep) returns ERR_NOT_IN_RANGE when not adjacent', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE], name: 'mover',
		});
		await shard.placeCreep('W1N1', {
			pos: [25, 20], owner: 'p1', body: [MOVE], name: 'far',
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.creeps['mover'].move(Game.creeps['far'])
		`);
		expect(rc).toBe(ERR_NOT_IN_RANGE);
	});

	test('MOVE-BASIC-023 move() returns ERR_NOT_OWNER on unowned creep', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const enemyId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p2', body: [MOVE],
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${enemyId}).move(TOP)
		`);
		expect(rc).toBe(ERR_NOT_OWNER);
	});

	test('MOVE-BASIC-024 move() returns ERR_BUSY while spawning', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 1);
		await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		await shard.tick();

		const spawnRc = await shard.runPlayer('p1', code`
			const spawns = Object.values(Game.spawns);
			spawns[0].spawnCreep([MOVE, MOVE, MOVE], 'Mover')
		`);
		expect(spawnRc).toBe(OK);

		const rc = await shard.runPlayer('p1', code`
			const c = Game.creeps['Mover'];
			c ? c.move(TOP) : -99
		`);
		expect(rc).toBe(ERR_BUSY);
	});

	test('MOVE-BASIC-025 move(targetCreep) moves toward the target creep', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const moverId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE], name: 'mover',
		});
		await shard.placeCreep('W1N1', {
			pos: [25, 24], owner: 'p1', body: [MOVE], name: 'target',
		});

		// target moves away so the tile is vacated for mover.
		await shard.runPlayer('p1', code`
			Game.creeps['target'].move(TOP);
			Game.creeps['mover'].move(Game.creeps['target'])
		`);

		const mover = await shard.expectObject(moverId, 'creep');
		expect(mover.pos.x).toBe(25);
		expect(mover.pos.y).toBe(24);
	});
});

describe('creep.moveByPath()', () => {
	test('MOVE-BASIC-008 moveByPath() moves the creep one step along a provided path', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE],
		});
		await shard.tick();

		// Use Room.findPath to generate a real Screeps path, then call moveByPath
		// with it. The path leads from the creep at [25,25] to [25,20] (TOP * 5).
		await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${id});
			const path = creep.room.findPath(creep.pos, new RoomPosition(25, 20, 'W1N1'));
			creep.moveByPath(path)
		`);

		const creep = await shard.expectObject(id, 'creep');
		// First step of the path takes the creep one tile closer to [25, 20]
		// (i.e., one tile north).
		expect(creep.pos.x).toBe(25);
		expect(creep.pos.y).toBe(24);
	});

	test('MOVE-BASIC-009 moveByPath() moves along a serialized path string', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE],
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${id});
			const path = creep.room.findPath(creep.pos, new RoomPosition(25, 20, 'W1N1'));
			const serialized = Room.serializePath(path);
			creep.moveByPath(serialized)
		`);

		const creep = await shard.expectObject(id, 'creep');
		expect(creep.pos.x).toBe(25);
		expect(creep.pos.y).toBe(24);
	});

	test('MOVE-BASIC-010 moveByPath() moves along an array of RoomPosition objects', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE],
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${id});
			creep.moveByPath([
				new RoomPosition(25, 25, 'W1N1'),
				new RoomPosition(25, 24, 'W1N1'),
				new RoomPosition(25, 23, 'W1N1'),
			])
		`);

		const creep = await shard.expectObject(id, 'creep');
		expect(creep.pos.x).toBe(25);
		expect(creep.pos.y).toBe(24);
	});

	test('MOVE-BASIC-011 moveByPath() returns OK when the next step is valid', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${id});
			const path = creep.room.findPath(creep.pos, new RoomPosition(25, 20, 'W1N1'));
			creep.moveByPath(path)
		`);
		expect(rc).toBe(OK);
	});

	test('MOVE-BASIC-012 moveByPath() returns ERR_NOT_FOUND when the creep is not on the path', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE],
		});
		await shard.tick();

		// A path that does not include or border the creep's position.
		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${id}).moveByPath([
				{ x: 10, y: 10, dx: 0, dy: -1, direction: TOP },
				{ x: 10, y: 9,  dx: 0, dy: -1, direction: TOP },
			])
		`);
		expect(rc).toBe(ERR_NOT_FOUND);
	});

	test('MOVE-BASIC-013 moveByPath() returns ERR_NOT_FOUND at path end', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE],
		});
		await shard.tick();

		// A single-step path whose only entry IS the creep's current tile.
		// The creep is already at the last step, so there is no next move.
		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${id}).moveByPath([
				{ x: 25, y: 25, dx: 0, dy: -1, direction: TOP },
			])
		`);
		expect(rc).toBe(ERR_NOT_FOUND);
	});

	test('MOVE-BASIC-014 moveByPath() returns ERR_INVALID_ARGS for non-path argument', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${id}).moveByPath(12345)
		`);
		expect(rc).toBe(ERR_INVALID_ARGS);
	});

	test('MOVE-BASIC-026 moveByPath() returns ERR_TIRED when fatigued', async ({ shard }) => {
		await shard.ownedRoom('p1');
		// 3 WORK + 1 MOVE: move generates 6 fatigue, reduced by 2 → 4 residual.
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [WORK, WORK, WORK, MOVE],
		});
		await shard.tick();

		// First move to generate fatigue.
		await shard.runPlayer('p1', code`Game.getObjectById(${id}).move(TOP)`);

		// Creep now has fatigue. moveByPath should return ERR_TIRED.
		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${id}).moveByPath([
				{ x: 25, y: 23, dx: 0, dy: -1, direction: TOP },
			])
		`);
		expect(rc).toBe(ERR_TIRED);
	});
});

describe('creep.moveTo()', () => {
	test('MOVE-BASIC-015 moveTo() computes a path and moves one step toward the target', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE],
		});
		await shard.tick();

		// Target 5 Chebyshev tiles away. moveTo should advance the creep
		// exactly one step closer per tick. The exact direction depends on the
		// pathfinder, but Chebyshev distance to the target must decrease by 1.
		const targetX = 30;
		const targetY = 25;
		const initialDist = Math.max(
			Math.abs(25 - targetX), Math.abs(25 - targetY),
		);

		await shard.runPlayer('p1', code`
			Game.getObjectById(${id}).moveTo(${targetX}, ${targetY})
		`);

		const creep = await shard.expectObject(id, 'creep');
		const newDist = Math.max(
			Math.abs(creep.pos.x - targetX), Math.abs(creep.pos.y - targetY),
		);
		expect(newDist).toBe(initialDist - 1);
	});

	test('MOVE-BASIC-016 moveTo() returns OK when the creep successfully moves', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${id}).moveTo(30, 25)
		`);
		expect(rc).toBe(OK);
	});

	test('MOVE-BASIC-018 moveTo() returns ERR_NO_PATH when no path exists', async ({ shard }) => {
		shard.requires('terrain', 'wall pocket fixture requires custom terrain support');
		// Use the shared terrain fixture room: its wall-pocket landmark is a
		// plain tile surrounded by walls on all 8 neighbors, so no path out
		// exists. The fixture is pre-loaded into the runner cache at adapter
		// init, so the runner pathfinder sees the walls — a test crafting
		// RoomSpec.terrain on the fly would be invisible to the cached copy.
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: TERRAIN_FIXTURE_ROOM, terrain: TERRAIN_FIXTURE_SPEC },
			],
		});
		const id = await shard.placeCreep(TERRAIN_FIXTURE_ROOM, {
			pos: TERRAIN_FIXTURE_LANDMARKS.wallPocketCenter,
			owner: 'p1',
			body: [MOVE],
		});

		// Target a plain tile well outside the wall pocket.
		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${id}).moveTo(40, 40)
		`);
		expect(rc).toBe(ERR_NO_PATH);
	});

	test('MOVE-BASIC-020 moveTo() returns ERR_TIRED when the creep has fatigue > 0', async ({ shard }) => {
		await shard.ownedRoom('p1');
		// 3 WORK + 1 MOVE: each move on plains generates 6 fatigue, MOVE
		// reduces by 2, leaving 4 — non-zero on the next tick.
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [WORK, WORK, WORK, MOVE],
		});
		await shard.tick();

		// First move: succeeds and creates lingering fatigue.
		await shard.runPlayer('p1', code`Game.getObjectById(${id}).move(TOP)`);

		// Next tick: fatigue still > 0, moveTo must report ERR_TIRED.
		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${id}).moveTo(40, 25)
		`);
		expect(rc).toBe(ERR_TIRED);
	});

	test('MOVE-BASIC-021 moveTo() returns ERR_NO_BODYPART when the creep has no MOVE parts', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [WORK],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${id}).moveTo(30, 25)
		`);
		expect(rc).toBe(ERR_NO_BODYPART);
	});

	test('MOVE-BASIC-017 moveTo() returns OK when already at target', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${id}).moveTo(25, 25)
		`);
		expect(rc).toBe(OK);

		await shard.tick();
		const c = await shard.expectObject(id, 'creep');
		expect(c.pos.x).toBe(25);
		expect(c.pos.y).toBe(25);
	});

	test('MOVE-BASIC-019 moveTo({noPathFinding: true}) returns ERR_NOT_FOUND without reusable path', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE],
		});
		await shard.tick();

		// Fresh creep with no cached path in memory.
		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${id}).moveTo(30, 25, { noPathFinding: true })
		`);
		expect(rc).toBe(ERR_NOT_FOUND);
	});

	test('MOVE-BASIC-022 moveTo() returns ERR_INVALID_TARGET for invalid target', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${id}).moveTo(null)
		`);
		expect(rc).toBe(ERR_INVALID_TARGET);
	});
});
