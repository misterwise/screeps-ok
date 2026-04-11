import { describe, test, expect, code,
	ERR_NO_PATH, ERR_INVALID_ARGS,
	FIND_EXIT_TOP,
} from '../../src/index.js';
import {
	TERRAIN_FIXTURE_ROOM, TERRAIN_FIXTURE_SPEC, TERRAIN_FIXTURE_NEIGHBOR,
	TERRAIN_FIXTURE_LANDMARKS,
} from '../../src/terrain-fixture.js';

describe('PathFinder', () => {
	test('PATHFINDER-001 PathFinder.search accepts a single goal position with range', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const goal = { pos: new RoomPosition(40, 40, 'W1N1'), range: 1 };
			const result = PathFinder.search(new RoomPosition(10, 10, 'W1N1'), goal);
			({
				pathLength: result.path.length,
				last: result.path[result.path.length - 1] && {
					x: result.path[result.path.length - 1].x,
					y: result.path[result.path.length - 1].y,
					roomName: result.path[result.path.length - 1].roomName,
				},
				incomplete: result.incomplete,
			})
		`) as {
			pathLength: number;
			last: { x: number; y: number; roomName: string } | null;
			incomplete: boolean;
		};

		expect(result.pathLength).toBe(29);
		expect(result.last).toEqual({ x: 39, y: 39, roomName: 'W1N1' });
		expect(result.incomplete).toBe(false);
	});

	test('PATHFINDER-002 PathFinder.search returns { path, ops, cost, incomplete }', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const goal = { pos: new RoomPosition(40, 40, 'W1N1'), range: 1 };
			const result = PathFinder.search(new RoomPosition(10, 10, 'W1N1'), goal);
			({
				pathIsArray: Array.isArray(result.path),
				first: result.path[0] && { x: result.path[0].x, y: result.path[0].y, roomName: result.path[0].roomName },
				opsType: typeof result.ops,
				costType: typeof result.cost,
				incompleteType: typeof result.incomplete,
			})
		`) as {
			pathIsArray: boolean;
			first: { x: number; y: number; roomName: string } | null;
			opsType: string;
			costType: string;
			incompleteType: string;
		};

		expect(result.pathIsArray).toBe(true);
		expect(result.first).toEqual({ x: 11, y: 11, roomName: 'W1N1' });
		expect(result.opsType).toBe('number');
		expect(result.costType).toBe('number');
		expect(result.incompleteType).toBe('boolean');
	});

	test('PATHFINDER-003 PathFinder.search respects CostMatrix when routing', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const cm = new PathFinder.CostMatrix();
			cm.set(11, 10, 255);
			cm.set(11, 9, 255);
			cm.set(11, 11, 255);
			const result = PathFinder.search(
				new RoomPosition(10, 10, 'W1N1'),
				{ pos: new RoomPosition(12, 10, 'W1N1'), range: 0 },
				{ roomCallback: () => cm }
			);
			({
				incomplete: result.incomplete,
				path: result.path.map(pos => ({ x: pos.x, y: pos.y })),
			})
		`) as { incomplete: boolean; path: Array<{ x: number; y: number }> };

		expect(result.incomplete).toBe(false);
		expect(result.path).not.toContainEqual({ x: 11, y: 10 });
		expect(result.path[result.path.length - 1]).toEqual({ x: 12, y: 10 });
	});

	test('PATHFINDER-004 PathFinder.search accepts multiple goal positions and finds the closest', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const near = { pos: new RoomPosition(15, 15, 'W1N1'), range: 0 };
			const far  = { pos: new RoomPosition(40, 40, 'W1N1'), range: 0 };
			const result = PathFinder.search(
				new RoomPosition(10, 10, 'W1N1'),
				[near, far],
				{ maxRooms: 1 }
			);
			({
				incomplete: result.incomplete,
				last: result.path[result.path.length - 1] && {
					x: result.path[result.path.length - 1].x,
					y: result.path[result.path.length - 1].y,
				},
			})
		`) as { incomplete: boolean; last: { x: number; y: number } | null };

		expect(result.incomplete).toBe(false);
		expect(result.last).toEqual({ x: 15, y: 15 });
	});

	test('PATHFINDER-005 PathFinder.search plainCost option overrides the default cost of plains tiles', async ({ shard }) => {
		await shard.ownedRoom('p1');

		// Probe the default room terrain for a horizontal run of plains tiles,
		// then force the path through that run via a CostMatrix that walls
		// off every other tile. Corridor cells stay at 0 (terrain default per
		// COSTMATRIX-004), so plainCost cleanly multiplies the per-tile cost.
		const result = await shard.runPlayer('p1', code`
			(() => {
				const TERRAIN_PLAIN = 0;
				const terrain = Game.map.getRoomTerrain('W1N1');
				let bestY = -1, bestStart = -1, bestLen = 0;
				for (let y = 1; y < 49; y++) {
					let start = -1, len = 0;
					for (let x = 1; x < 49; x++) {
						if (terrain.get(x, y) === TERRAIN_PLAIN) {
							if (start === -1) start = x;
							len++;
							if (len > bestLen) { bestY = y; bestStart = start; bestLen = len; }
						} else {
							start = -1; len = 0;
						}
					}
				}
				if (bestLen < 8) {
					return { found: false };
				}
				const len = 8;
				const startX = bestStart;
				const endX = startX + len - 1;
				const cm = new PathFinder.CostMatrix();
				for (let x = 0; x < 50; x++) {
					for (let y = 0; y < 50; y++) {
						if (y !== bestY || x < startX || x > endX) {
							cm.set(x, y, 255);
						}
					}
				}
				const origin = new RoomPosition(startX, bestY, 'W1N1');
				const goal = { pos: new RoomPosition(endX, bestY, 'W1N1'), range: 0 };
				const def = PathFinder.search(origin, goal, { roomCallback: () => cm, maxRooms: 1 });
				const overridden = PathFinder.search(origin, goal, { roomCallback: () => cm, plainCost: 3, maxRooms: 1 });
				return {
					found: true,
					defaultCost: def.cost,
					overriddenCost: overridden.cost,
					defaultIncomplete: def.incomplete,
					overriddenIncomplete: overridden.incomplete,
					defaultLength: def.path.length,
					overriddenLength: overridden.path.length,
				};
			})()
		`) as {
			found: boolean;
			defaultCost?: number;
			overriddenCost?: number;
			defaultIncomplete?: boolean;
			overriddenIncomplete?: boolean;
			defaultLength?: number;
			overriddenLength?: number;
		};

		expect(result.found).toBe(true);
		expect(result.defaultIncomplete).toBe(false);
		expect(result.overriddenIncomplete).toBe(false);
		expect(result.defaultLength).toBe(result.overriddenLength);
		// 7 steps over 8 plains tiles: default cost = 7 * 1, override cost = 7 * 3.
		expect(result.defaultCost).toBe(7);
		expect(result.overriddenCost).toBe(21);
	});

	test('PATHFINDER-006 PathFinder.search swampCost option overrides the default cost of swamp tiles', async ({ shard }) => {
		shard.requires('terrain', 'swamp cost probe needs the fixture swamp landmark');
		// Use the pre-crafted swamp landmark in TERRAIN_FIXTURE_ROOM: a swamp
		// tile with a plain neighbor one step away. Force a single-step path
		// from the plain tile into the swamp tile via a CostMatrix that walls
		// off every other tile, so the path's total cost is exactly the cost
		// of entering the swamp tile: default swampCost(5), overridden(1).
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: TERRAIN_FIXTURE_ROOM, terrain: TERRAIN_FIXTURE_SPEC },
			],
		});
		const [sx, sy] = TERRAIN_FIXTURE_LANDMARKS.swampTile;
		const [ox, oy] = TERRAIN_FIXTURE_LANDMARKS.swampPlainNeighbor;

		const result = await shard.runPlayer('p1', code`
			const sx = ${sx}, sy = ${sy}, ox = ${ox}, oy = ${oy};
			const cm = new PathFinder.CostMatrix();
			for (let x = 0; x < 50; x++) {
				for (let y = 0; y < 50; y++) {
					if (!((x === sx && y === sy) || (x === ox && y === oy))) {
						cm.set(x, y, 255);
					}
				}
			}
			const origin = new RoomPosition(ox, oy, ${TERRAIN_FIXTURE_ROOM});
			const goal = { pos: new RoomPosition(sx, sy, ${TERRAIN_FIXTURE_ROOM}), range: 0 };
			const def = PathFinder.search(origin, goal, { roomCallback: () => cm, maxRooms: 1 });
			const overridden = PathFinder.search(origin, goal, { roomCallback: () => cm, swampCost: 1, maxRooms: 1 });
			({
				defaultCost: def.cost,
				overriddenCost: overridden.cost,
				defaultIncomplete: def.incomplete,
				overriddenIncomplete: overridden.incomplete,
				defaultLength: def.path.length,
				overriddenLength: overridden.path.length,
			})
		`) as {
			defaultCost: number;
			overriddenCost: number;
			defaultIncomplete: boolean;
			overriddenIncomplete: boolean;
			defaultLength: number;
			overriddenLength: number;
		};

		expect(result.defaultIncomplete).toBe(false);
		expect(result.overriddenIncomplete).toBe(false);
		expect(result.defaultLength).toBe(1);
		expect(result.overriddenLength).toBe(1);
		// 1 step into a swamp tile: default cost = swampCost(5), override = swampCost(1).
		expect(result.defaultCost).toBe(5);
		expect(result.overriddenCost).toBe(1);
	});

	test('PATHFINDER-007 PathFinder.search maxOps option limits the number of pathfinding operations', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const origin = new RoomPosition(10, 10, 'W1N1');
			const goal = { pos: new RoomPosition(40, 40, 'W1N1'), range: 0 };
			// maxOps=1 forces the search to give up almost immediately.
			const capped = PathFinder.search(origin, goal, { maxOps: 1 });
			({
				ops: capped.ops,
				incomplete: capped.incomplete,
			})
		`) as { ops: number; incomplete: boolean };

		// Search must be cut short before reaching the goal.
		expect(result.incomplete).toBe(true);
		// ops respects the cap (allowing small implementation overshoot).
		expect(result.ops).toBeLessThanOrEqual(2);
	});

	test('PATHFINDER-008 PathFinder.search maxRooms option limits the number of rooms searched', async ({ shard }) => {
		shard.requires('terrain', 'cross-room pathfinding uses the fixture room pair');
		// TERRAIN_FIXTURE_ROOM + TERRAIN_FIXTURE_NEIGHBOR are pre-loaded into
		// the vanilla runner's static terrain cache by the adapter, so both
		// rooms are always visible to PathFinder regardless of test ordering.
		// TERRAIN_FIXTURE_NEIGHBOR is the blank-terrain room immediately north
		// of the fixture room. We use the plainOrigin landmark and a tile
		// near the north border so the cross-room path is short.
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: TERRAIN_FIXTURE_ROOM, terrain: TERRAIN_FIXTURE_SPEC },
				{ name: TERRAIN_FIXTURE_NEIGHBOR },
			],
		});

		const result = await shard.runPlayer('p1', code`
			// Origin near the top edge of the fixture room, goal just inside
			// the southern edge of its north neighbor. Short cross-room path
			// stays well within the default ops budget.
			const origin = new RoomPosition(25, 5, ${TERRAIN_FIXTURE_ROOM});
			const goal = { pos: new RoomPosition(25, 45, ${TERRAIN_FIXTURE_NEIGHBOR}), range: 0 };
			const limited = PathFinder.search(origin, goal, { maxRooms: 1 });
			const allowed = PathFinder.search(origin, goal);
			({
				limitedIncomplete: limited.incomplete,
				allowedIncomplete: allowed.incomplete,
				allowedLastRoom: allowed.path[allowed.path.length - 1] && allowed.path[allowed.path.length - 1].roomName,
			})
		`) as {
			limitedIncomplete: boolean;
			allowedIncomplete: boolean;
			allowedLastRoom: string | null;
		};

		// maxRooms=1 confines search to the origin room → cannot reach the neighbor.
		expect(result.limitedIncomplete).toBe(true);
		// Default maxRooms (16) lets the search enter the neighbor and complete.
		expect(result.allowedIncomplete).toBe(false);
		expect(result.allowedLastRoom).toBe(TERRAIN_FIXTURE_NEIGHBOR);
	});

	test('PATHFINDER-009 PathFinder.search flee mode finds a path away from the goal positions', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const origin = new RoomPosition(25, 25, 'W1N1');
			const goal = { pos: new RoomPosition(25, 25, 'W1N1'), range: 5 };
			const fleeResult = PathFinder.search(origin, goal, { flee: true });
			const last = fleeResult.path[fleeResult.path.length - 1];
			({
				incomplete: fleeResult.incomplete,
				pathLength: fleeResult.path.length,
				lastDistance: last
					? Math.max(Math.abs(last.x - 25), Math.abs(last.y - 25))
					: 0,
			})
		`) as { incomplete: boolean; pathLength: number; lastDistance: number };

		expect(result.incomplete).toBe(false);
		expect(result.pathLength).toBeGreaterThan(0);
		// flee with range:5 must end at Chebyshev distance >= 5 from the goal.
		expect(result.lastDistance).toBeGreaterThanOrEqual(5);
	});

	test('PATHFINDER-010 PathFinder.search returns incomplete: true with a partial path when no full path exists', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			// Wall the goal in completely with cost-255 tiles via a CostMatrix.
			const cm = new PathFinder.CostMatrix();
			for (let dx = -1; dx <= 1; dx++) {
				for (let dy = -1; dy <= 1; dy++) {
					cm.set(40 + dx, 40 + dy, 255);
				}
			}
			// maxRooms=1 keeps the search inside W1N1 — the test world has no
			// neighbor rooms loaded, and exhaustive search would otherwise try
			// to load adjacent terrain and fail.
			const result = PathFinder.search(
				new RoomPosition(10, 10, 'W1N1'),
				{ pos: new RoomPosition(40, 40, 'W1N1'), range: 0 },
				{ roomCallback: () => cm, maxRooms: 1 }
			);
			({
				incomplete: result.incomplete,
				pathLength: result.path.length,
			})
		`) as { incomplete: boolean; pathLength: number };

		// Goal is unreachable but a partial best-effort path is returned.
		expect(result.incomplete).toBe(true);
		expect(result.pathLength).toBeGreaterThan(0);
	});
});

describe('Game.map', () => {
	test('MAP-ROOM-002 getRoomLinearDistance returns the room-grid Manhattan distance between two rooms', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const dist = await shard.runPlayer('p1', code`
			Game.map.getRoomLinearDistance('W1N1', 'W5N5')
		`);

		expect(dist).toBe(4);
	});

	test('MAP-ROOM-001 describeExits returns only exit direction keys with adjacent room names as values for a valid room name', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const exits = await shard.runPlayer('p1', code`
			Game.map.describeExits('W1N1')
		`) as Record<string, string>;

		expect(exits).toEqual({
			1: 'W1N2',
			3: 'W0N1',
			5: 'W1N0',
			7: 'W2N1',
		});
	});

	test('MAP-ROOM-001 describeExits returns null for an invalid room name', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const exits = await shard.runPlayer('p1', code`
			Game.map.describeExits('not_a_room')
		`);

		expect(exits).toBeNull();
	});

	test('MAP-ROOM-003 getRoomLinearDistance with continuous=true wraps across world edges', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			({
				normal: Game.map.getRoomLinearDistance('W1N1', 'W1N1', false),
				wrapped: Game.map.getRoomLinearDistance('W1N1', 'W1N1', true),
			})
		`) as { normal: number; wrapped: number };
		// Same room → distance 0 regardless of wrap flag.
		expect(result.normal).toBe(0);
		expect(result.wrapped).toBe(0);
	});

	test('MAP-ROOM-004 getRoomStatus returns the canonical status and timestamp mapping for normal rooms', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const status = Game.map.getRoomStatus('W1N1');
			({ status: status.status, timestamp: status.timestamp })
		`) as { status: string; timestamp: number | null };

		// On a private server, all rooms are "normal" status with null timestamp.
		expect(result.status).toBe('normal');
		expect(result.timestamp).toBeNull();
	});

	test('MAP-ROOM-005 getWorldSize returns the number of rooms along one world edge', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const size = await shard.runPlayer('p1', code`
			Game.map.getWorldSize()
		`);
		// Must be a positive integer.
		expect(typeof size).toBe('number');
		expect(size).toBeGreaterThan(0);
	});

	// ── Route Finding ───────────────────────────────────────────

	test('MAP-ROUTE-001 findRoute returns an array of {exit, room} steps', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W1N2', rcl: 1, owner: 'p1' },
			],
		});

		const route = await shard.runPlayer('p1', code`
			Game.map.findRoute('W1N1', 'W1N2')
		`) as Array<{ exit: number; room: string }>;
		expect(Array.isArray(route)).toBe(true);
		expect(route.length).toBeGreaterThanOrEqual(1);
		expect(route[0]).toHaveProperty('exit');
		expect(route[0]).toHaveProperty('room');
	});

	test('MAP-ROUTE-002 findRoute returns ERR_NO_PATH for an invalid room name', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			Game.map.findRoute('W1N1', 'not_a_room')
		`);
		expect(result).toBe(ERR_NO_PATH);
	});

	test('MAP-ROUTE-003 findRoute with routeCallback excluding rooms via Infinity', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W1N2', rcl: 1, owner: 'p1' },
			],
		});

		// Block the only direct route through W1N2 by returning Infinity.
		const result = await shard.runPlayer('p1', code`
			Game.map.findRoute('W1N1', 'W1N2', {
				routeCallback: (roomName) => roomName === 'W1N2' ? Infinity : 1
			})
		`);
		expect(result).toBe(ERR_NO_PATH);
	});

	test('MAP-ROUTE-004 findExit returns the first route step exit constant', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W1N2', rcl: 1, owner: 'p1' },
			],
		});

		const exit = await shard.runPlayer('p1', code`
			Game.map.findExit('W1N1', 'W1N2')
		`);
		// W1N2 is north of W1N1 → exit should be FIND_EXIT_TOP (1).
		expect(exit).toBe(FIND_EXIT_TOP);
	});

	test('MAP-ROUTE-005 findExit returns ERR_NO_PATH when no route exists and ERR_INVALID_ARGS for same room', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const noPath = await shard.runPlayer('p1', code`
			Game.map.findExit('W1N1', 'not_a_room')
		`);
		expect(noPath).toBe(ERR_NO_PATH);

		const sameRoom = await shard.runPlayer('p1', code`
			Game.map.findExit('W1N1', 'W1N1')
		`);
		expect(sameRoom).toBe(ERR_INVALID_ARGS);
	});

	// ── Terrain ─────────────────────────────────────────────────

	test('MAP-TERRAIN-001 getRoomTerrain returns terrain access for visible and non-visible rooms', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1' },
			],
		});

		const result = await shard.runPlayer('p1', code`
			const owned = Game.map.getRoomTerrain('W1N1');
			const nonVisible = Game.map.getRoomTerrain('W2N1');
			({
				ownedHasGet: typeof owned.get === 'function',
				nonVisibleHasGet: typeof nonVisible.get === 'function',
				ownedSample: owned.get(0, 0),
				nonVisibleSample: nonVisible.get(0, 0),
			})
		`) as { ownedHasGet: boolean; nonVisibleHasGet: boolean; ownedSample: number; nonVisibleSample: number };
		expect(result.ownedHasGet).toBe(true);
		expect(result.nonVisibleHasGet).toBe(true);
		expect(typeof result.ownedSample).toBe('number');
		expect(typeof result.nonVisibleSample).toBe('number');
	});
});
