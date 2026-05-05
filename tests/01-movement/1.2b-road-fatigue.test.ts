import { describe, test, expect, code,
	OK, MOVE, WORK,
	STRUCTURE_ROAD, TOP, TERRAIN_WALL,
} from '../../src/index.js';

function terrainWithWalls(walls: Array<[number, number]>): Array<0 | 1 | 2> {
	const terrain = new Array<0 | 1 | 2>(2500).fill(0);
	for (const [x, y] of walls) terrain[y * 50 + x] = TERRAIN_WALL;
	return terrain;
}

function wallPocketTerrain(cx: number, cy: number): Array<0 | 1 | 2> {
	const walls: Array<[number, number]> = [];
	for (let dy = -1; dy <= 1; dy++) {
		for (let dx = -1; dx <= 1; dx++) {
			if (dx === 0 && dy === 0) continue;
			walls.push([cx + dx, cy + dy]);
		}
	}
	return terrainWithWalls(walls);
}

describe('Road fatigue', () => {
	test('ROAD-FATIGUE-001 creep moving onto a road accumulates half the fatigue of plain terrain', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_ROAD,
		});
		await shard.placeStructure('W1N1', {
			pos: [25, 24], structureType: STRUCTURE_ROAD,
		});
		// 1 WORK + 1 MOVE: on road, 1 non-move * 1 = 1 fatigue, -2 from MOVE = 0
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).move(TOP)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.pos.y).toBe(24);
		// On road: 1 non-move part * 1 (road cost) = 1 fatigue, 1 MOVE removes 2 → net 0
		expect(creep.fatigue).toBe(0);
	});

	test('ROAD-FATIGUE-002 a road on swamp reduces the fatigue multiplier to 1', async ({ shard }) => {
		shard.requires('terrain', 'swamp tile required for swamp-road fatigue assertion');
		// [25, 24] = swamp, everything else plain.
		const terrain = new Array(2500).fill(0);
		terrain[24 * 50 + 25] = 2;
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1', terrain }],
		});
		await shard.placeStructure('W1N1', {
			pos: [25, 24], structureType: STRUCTURE_ROAD,
		});
		// 3 weighted parts (3 WORK) + 1 MOVE.
		// Without the road, swamp would generate 3 * 10 = 30 fatigue.
		// With the road, the multiplier is 1: 3 * 1 = 3 fatigue.
		// 1 MOVE part reduces by 2 → final = 1.
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [WORK, WORK, WORK, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).move(TOP)
		`);
		expect(rc).toBe(OK);

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.pos.y).toBe(24);
		expect(creep.fatigue).toBe(1);
	});

	test('ROAD-TRAVERSAL-001 a road makes a natural-wall tile walkable by creeps', async ({ shard }) => {
		// Engine @screeps/engine/src/game/creeps.js / checkMovement — a wall
		// terrain tile is normally impassable (see MOVE-BASIC-002), but a road
		// structure on that tile makes it traversable. Pair this test with
		// MOVE-BASIC-002: same move() direction, different terrain+structure,
		// observably different outcome.
		shard.requires('terrain', 'custom terrain required for wall tile traversal');
		const wx = 20, wy = 20;
		await shard.createShard({
			players: ['p1'],
			rooms: [{
				name: 'W1N1', rcl: 1, owner: 'p1',
				terrain: terrainWithWalls([[wx, wy]]),
			}],
		});
		await shard.placeStructure('W1N1', {
			pos: [wx, wy], structureType: STRUCTURE_ROAD,
		});
		// Creep stands on a plain neighbor to the south and moves TOP onto the
		// wall-road tile. One MOVE per weighted part keeps fatigue at 0 so the
		// move resolves immediately.
		const creepId = await shard.placeCreep('W1N1', {
			pos: [wx, wy + 1], owner: 'p1',
			body: [MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).move(TOP)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.pos.x).toBe(wx);
		expect(creep.pos.y).toBe(wy);
	});

	test('ROAD-FATIGUE-003 a road on a natural wall reduces the fatigue multiplier to 1', async ({ shard }) => {
		// Engine fatigue calculation normally treats a wall tile as impassable;
		// with a road on the tile, the per-weighted-part fatigue multiplier is
		// 1 (same as plain or swamp roads). 3 WORK + 1 MOVE moving onto the
		// wall-road generates 3 × 1 = 3 fatigue, then 1 MOVE reduces by 2 → 1.
		shard.requires('terrain', 'custom terrain required for wall-road fatigue');
		const wx = 20, wy = 20;
		await shard.createShard({
			players: ['p1'],
			rooms: [{
				name: 'W1N1', rcl: 1, owner: 'p1',
				terrain: terrainWithWalls([[wx, wy]]),
			}],
		});
		await shard.placeStructure('W1N1', {
			pos: [wx, wy], structureType: STRUCTURE_ROAD,
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [wx, wy + 1], owner: 'p1',
			body: [WORK, WORK, WORK, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).move(TOP)
		`);
		expect(rc).toBe(OK);

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.pos.x).toBe(wx);
		expect(creep.pos.y).toBe(wy);
		expect(creep.fatigue).toBe(1);
	});

	test('ROAD-TRAVERSAL-002 Room.findPath routes through a wall-road when the path is otherwise blocked', async ({ shard }) => {
		// Pairs with ROAD-TRAVERSAL-001. The move resolver accepts a wall-road
		// step; this test asserts the pathfinder agrees — a wall-road must be
		// cost-1 walkable in the room's CostMatrix so `findPath` (and, by
		// extension, `moveTo`) actually routes through it.
		//
		// The wall-pocket center at (5, 5) is a plain tile surrounded by walls
		// on all 8 neighbors. Placing a road on the north wall (5, 4) creates
		// exactly one escape tile. If the pathfinder treats the wall-road as
		// impassable, no path to (5, 3) exists and findPath returns [] (or a
		// 0-step self-path). If it respects the road, the path is 2 steps:
		// (5, 4) then (5, 3).
		shard.requires('terrain', 'custom terrain required for wall-pocket path');
		const px = 5, py = 5;
		await shard.createShard({
			players: ['p1'],
			rooms: [{
				name: 'W1N1', rcl: 1, owner: 'p1',
				terrain: wallPocketTerrain(px, py),
			}],
		});
		await shard.placeStructure('W1N1', {
			pos: [px, py - 1], structureType: STRUCTURE_ROAD,
		});
		// Place a creep so the player has visibility of the room for findPath.
		await shard.placeCreep('W1N1', {
			pos: [px, py], owner: 'p1', body: [MOVE],
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const room = Game.rooms['W1N1'];
			const path = room.findPath(
				new RoomPosition(${px}, ${py}, 'W1N1'),
				new RoomPosition(${px}, ${py - 2}, 'W1N1'),
			);
			path.map(step => ({ x: step.x, y: step.y }))
		`) as { x: number; y: number }[];

		expect(result).toEqual([
			{ x: px, y: py - 1 },
			{ x: px, y: py - 2 },
		]);
	});
});
