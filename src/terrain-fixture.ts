import type { TerrainSpec } from './adapter.js';

// A crafted terrain fixture used by a small number of tests that need to
// observe specific terrain features through player-facing APIs
// (Room.getTerrain, PathFinder, moveTo pathfinding, findPath).
//
// The vanilla adapter pre-loads this room into the engine_runner subprocess's
// one-shot terrain cache at startup, so tests that reference it see the same
// terrain the player APIs see without any cache-invalidation dance. Tests that
// need fresh player-facing terrain should use THIS fixture room rather than
// crafting their own RoomSpec.terrain — crafting new terrain at test time
// writes to storage but is silently ignored by the runner's cached copy.

/**
 * The room that holds the crafted terrain fixture. Pre-loaded into the
 * engine_runner cache by the vanilla adapter. Pick a name far from W1N1 so
 * it doesn't collide with cross-room neighbor tests.
 */
export const TERRAIN_FIXTURE_ROOM = 'W5N5';

/**
 * A blank-terrain neighbor of TERRAIN_FIXTURE_ROOM, also pre-loaded into the
 * vanilla engine_runner cache. Exists so tests that need cross-room
 * PathFinder behavior (e.g. maxRooms) have a pair of adjacent rooms both
 * visible to the runner's static terrain cache.
 */
export const TERRAIN_FIXTURE_NEIGHBOR = 'W5N6';

/**
 * Canonical map-generator invariant: every room corner is a wall. The Screeps
 * map generator (`@screeps/backend/lib/cli/map.js`) restricts exits to
 * x∈[2,47] on every edge and unconditionally walls all border tiles that
 * aren't exit-forced, so (0,0), (49,0), (0,49), (49,49) are always walls in
 * a generated world. Adapters apply this to every test-supplied terrain spec
 * so tests can't observe behaviors that are impossible in real gameplay.
 */
export function withCornerWalls(terrain: TerrainSpec): TerrainSpec {
	const out = terrain.slice() as TerrainSpec;
	out[0] = 1;
	out[49] = 1;
	out[49 * 50] = 1;
	out[49 * 50 + 49] = 1;
	return out;
}

// Landmark coordinates baked into TERRAIN_FIXTURE_SPEC below. Tests reference
// these instead of hard-coding positions, so the fixture layout can evolve
// without touching every call site.
export const TERRAIN_FIXTURE_LANDMARKS = {
	/**
	 * A tile surrounded by walls on all 8 neighbors — any creep placed here
	 * is isolated and moveTo() to any other tile returns ERR_NO_PATH.
	 */
	wallPocketCenter: [5, 5] as [number, number],
	/**
	 * A single wall terrain tile with plain neighbors — useful for tests
	 * that need to place a construction site on a wall and observe
	 * ERR_INVALID_TARGET.
	 */
	isolatedWallTile: [20, 20] as [number, number],
	/**
	 * A swamp tile inside a swamp patch, adjacent to a plain tile. Tests
	 * that verify PathFinder.swampCost can probe these coordinates directly
	 * or scan the room for "swamp with plain neighbor" and land here.
	 */
	swampTile: [10, 10] as [number, number],
	swampPlainNeighbor: [9, 10] as [number, number],
	/**
	 * A plain tile in the open part of the room — safe default for placing
	 * creeps when the test doesn't care about surrounding terrain.
	 */
	plainOrigin: [30, 30] as [number, number],
} as const;

function buildFixtureSpec(): TerrainSpec {
	const t: (0 | 1 | 2)[] = new Array(2500).fill(0);
	const idx = (x: number, y: number) => y * 50 + x;

	// Wall pocket around (5, 5): mark all 8 neighbors as walls, leaving
	// (5, 5) itself plain so a creep can stand there but can't leave.
	const [wx, wy] = TERRAIN_FIXTURE_LANDMARKS.wallPocketCenter;
	for (let dy = -1; dy <= 1; dy++) {
		for (let dx = -1; dx <= 1; dx++) {
			if (dx === 0 && dy === 0) continue;
			t[idx(wx + dx, wy + dy)] = 1;
		}
	}

	// Swamp patch: a 6x6 block at (10..15, 10..15). Landmark (10, 10) is
	// inside, (9, 10) is the adjacent plain tile outside.
	for (let y = 10; y <= 15; y++) {
		for (let x = 10; x <= 15; x++) {
			t[idx(x, y)] = 2;
		}
	}

	// Isolated wall tile at (20, 20) for construction-site-on-wall tests.
	t[idx(20, 20)] = 1;

	// Wall off borders that don't connect to TERRAIN_FIXTURE_NEIGHBOR (W5N6,
	// which is north). This prevents PathFinder from expanding into rooms
	// that don't exist in the terrain cache.
	// South border (y=49), west border (x=0), east border (x=49) — all walls.
	// North border (y=0) stays open as the exit to the neighbor room.
	for (let i = 0; i < 50; i++) {
		t[idx(i, 49)] = 1; // south
		t[idx(0, i)] = 1;  // west
		t[idx(49, i)] = 1; // east
	}

	return t;
}

function buildNeighborSpec(): TerrainSpec {
	const t: (0 | 1 | 2)[] = new Array(2500).fill(0);
	const idx = (x: number, y: number) => y * 50 + x;

	// Wall off borders that don't connect to TERRAIN_FIXTURE_ROOM (W5N5,
	// which is south). North (y=0), west (x=0), east (x=49) — all walls.
	// South border (y=49) stays open as the exit to the fixture room.
	for (let i = 0; i < 50; i++) {
		t[idx(i, 0)] = 1;  // north
		t[idx(0, i)] = 1;  // west
		t[idx(49, i)] = 1; // east
	}

	return t;
}

/**
 * The full 2500-tile terrain array for TERRAIN_FIXTURE_ROOM. Tests that need
 * to add the fixture room to their shard spec should pass this as the
 * `terrain` field on the `RoomSpec` so the DB and the runner cache agree.
 */
export const TERRAIN_FIXTURE_SPEC: TerrainSpec = buildFixtureSpec();

/**
 * Terrain for TERRAIN_FIXTURE_NEIGHBOR. Blank interior with walled borders
 * on all edges except south (which connects to TERRAIN_FIXTURE_ROOM).
 */
export const TERRAIN_FIXTURE_NEIGHBOR_SPEC: TerrainSpec = buildNeighborSpec();
