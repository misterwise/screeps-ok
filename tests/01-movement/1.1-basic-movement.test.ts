import { describe, test, expect, code,
	MOVE, WORK, OK, ERR_NO_BODYPART, ERR_NOT_FOUND, ERR_NO_PATH, ERR_TIRED,
	TOP,
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
});

describe('creep.moveByPath()', () => {
	test('MOVE-BASIC-005 moveByPath() moves the creep one step along a provided path', async ({ shard }) => {
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

	test('MOVE-BASIC-006 moveByPath() returns OK when the next step is valid', async ({ shard }) => {
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

	test('MOVE-BASIC-007 moveByPath() returns ERR_NOT_FOUND when the creep is not on the path', async ({ shard }) => {
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
});

describe('creep.moveTo()', () => {
	test('MOVE-BASIC-008 moveTo() computes a path and moves one step toward the target', async ({ shard }) => {
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

	test('MOVE-BASIC-009 moveTo() returns OK when the creep successfully moves', async ({ shard }) => {
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

	test('MOVE-BASIC-010 moveTo() returns ERR_NO_PATH when no path exists', async ({ shard }) => {
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

	test('MOVE-BASIC-011 moveTo() returns ERR_TIRED when the creep has fatigue > 0', async ({ shard }) => {
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

	test('MOVE-BASIC-012 moveTo() returns ERR_NO_BODYPART when the creep has no MOVE parts', async ({ shard }) => {
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
});
