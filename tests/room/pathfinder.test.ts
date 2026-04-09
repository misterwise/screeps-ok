import { describe, test, expect, code,
	ERR_NO_PATH, ERR_INVALID_ARGS,
	FIND_EXIT_TOP,
} from '../../src/index.js';

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

	test('COSTMATRIX-001 new CostMatrix() creates a matrix with all values 0', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const value = await shard.runPlayer('p1', code`
			new PathFinder.CostMatrix().get(25, 25)
		`);

		expect(value).toBe(0);
	});

	test('COSTMATRIX-002 CostMatrix.set(x, y, cost) and get(x, y) round-trip the assigned value', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const value = await shard.runPlayer('p1', code`
			const cm = new PathFinder.CostMatrix();
			cm.set(25, 25, 255);
			cm.get(25, 25)
		`);

		expect(value).toBe(255);
	});

	test('COSTMATRIX-003 CostMatrix.serialize() and CostMatrix.deserialize() round-trip correctly', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const value = await shard.runPlayer('p1', code`
			const cm = new PathFinder.CostMatrix();
			cm.set(25, 25, 255);
			PathFinder.CostMatrix.deserialize(cm.serialize()).get(25, 25)
		`);

		expect(value).toBe(255);
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
