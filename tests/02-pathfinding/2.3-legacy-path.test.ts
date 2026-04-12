import { describe, test, expect, code } from '../../src/index.js';
import { hasDocumentedAdapterLimitation } from '../../src/limitations.js';
import {
	TERRAIN_FIXTURE_ROOM, TERRAIN_FIXTURE_SPEC,
	TERRAIN_FIXTURE_NEIGHBOR, TERRAIN_FIXTURE_NEIGHBOR_SPEC,
} from '../../src/terrain-fixture.js';

const pathFinderUseTest = hasDocumentedAdapterLimitation('xxscreepsPathFinderUseMissing')
	? test.skip
	: test;

describe('Legacy Pathfinding', () => {
	test('LEGACY-PATH-001 Room.findPath() finds a path between two positions within a room', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const room = Game.rooms['W1N1'];
			const path = room.findPath(
				new RoomPosition(10, 10, 'W1N1'),
				new RoomPosition(20, 10, 'W1N1')
			);
			({
				isArray: Array.isArray(path),
				length: path.length,
				firstStep: path[0] && {
					x: path[0].x,
					y: path[0].y,
					hasDirection: typeof path[0].direction === 'number',
					hasDx: typeof path[0].dx === 'number',
					hasDy: typeof path[0].dy === 'number',
				},
				lastStep: path[path.length - 1] && {
					x: path[path.length - 1].x,
					y: path[path.length - 1].y,
				},
			})
		`) as {
			isArray: boolean;
			length: number;
			firstStep: { x: number; y: number; hasDirection: boolean; hasDx: boolean; hasDy: boolean } | null;
			lastStep: { x: number; y: number } | null;
		};

		expect(result.isArray).toBe(true);
		expect(result.length).toBeGreaterThan(0);
		// Path step shape: { x, y, dx, dy, direction }
		expect(result.firstStep).not.toBeNull();
		expect(result.firstStep!.hasDirection).toBe(true);
		expect(result.firstStep!.hasDx).toBe(true);
		expect(result.firstStep!.hasDy).toBe(true);
		// Path ends at the destination tile.
		expect(result.lastStep).toEqual({ x: 20, y: 10 });
	});

	test('LEGACY-PATH-002 Room.serializePath() and Room.deserializePath() round-trip a path', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const room = Game.rooms['W1N1'];
			const RoomClass = room.constructor;
			const original = room.findPath(
				new RoomPosition(10, 10, 'W1N1'),
				new RoomPosition(20, 10, 'W1N1')
			);
			const serialized = RoomClass.serializePath(original);
			const restored = RoomClass.deserializePath(serialized);
			({
				serializedType: typeof serialized,
				originalLength: original.length,
				restoredLength: restored.length,
				firstMatches: original[0] && restored[0]
					&& original[0].x === restored[0].x
					&& original[0].y === restored[0].y
					&& original[0].direction === restored[0].direction,
				lastMatches: original[original.length - 1] && restored[restored.length - 1]
					&& original[original.length - 1].x === restored[restored.length - 1].x
					&& original[original.length - 1].y === restored[restored.length - 1].y
					&& original[original.length - 1].direction === restored[restored.length - 1].direction,
			})
		`) as {
			serializedType: string;
			originalLength: number;
			restoredLength: number;
			firstMatches: boolean;
			lastMatches: boolean;
		};

		expect(result.serializedType).toBe('string');
		expect(result.originalLength).toBeGreaterThan(0);
		expect(result.restoredLength).toBe(result.originalLength);
		expect(result.firstMatches).toBe(true);
		expect(result.lastMatches).toBe(true);
	});

	test('LEGACY-PATH-004 findPath() returns empty array when source is not in the room', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const room = Game.rooms['W1N1'];
			try {
				const path = room.findPath(
					new RoomPosition(25, 25, 'W2N1'),
					new RoomPosition(30, 30, 'W1N1'),
					{}
				);
				({ length: path.length, isArray: Array.isArray(path), threw: false })
			} catch(e) {
				({ threw: true, error: String(e) })
			}
		`) as { length?: number; isArray?: boolean; threw: boolean; error?: string };

		expect(result.threw).toBe(false);
		expect(result.isArray).toBe(true);
		expect(result.length).toBe(0);
	});

	test('LEGACY-PATH-005 findPath() with cross-room destination returns only intra-room steps', async ({ shard }) => {
		shard.requires('terrain', 'cross-room findPath needs terrain fixture pair');
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: TERRAIN_FIXTURE_ROOM, rcl: 1, owner: 'p1', terrain: TERRAIN_FIXTURE_SPEC },
				{ name: TERRAIN_FIXTURE_NEIGHBOR, terrain: TERRAIN_FIXTURE_NEIGHBOR_SPEC },
			],
		});

		const result = await shard.runPlayer('p1', code`
			const room = Game.rooms[${TERRAIN_FIXTURE_ROOM}];
			const path = room.findPath(
				new RoomPosition(25, 25, ${TERRAIN_FIXTURE_ROOM}),
				new RoomPosition(25, 25, ${TERRAIN_FIXTURE_NEIGHBOR}),
				{}
			);
			({
				isArray: Array.isArray(path),
				length: path.length,
				allInRoom: Array.isArray(path) && path.every(
					s => s.x >= 0 && s.x <= 49 && s.y >= 0 && s.y <= 49
				),
			})
		`) as { isArray: boolean; length: number; allInRoom: boolean };

		expect(result.isArray).toBe(true);
		expect(result.length).toBeGreaterThan(0);
		expect(result.allInRoom).toBe(true);
	});

	test('LEGACY-PATH-006 findPath() returns empty array when source equals destination', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const room = Game.rooms['W1N1'];
			const path = room.findPath(
				new RoomPosition(25, 25, 'W1N1'),
				new RoomPosition(25, 25, 'W1N1')
			);
			({ length: path.length, isArray: Array.isArray(path) })
		`) as { length: number; isArray: boolean };

		expect(result.isArray).toBe(true);
		expect(result.length).toBe(0);
	});

	test('LEGACY-PATH-007 findPath() returns a single step for adjacent positions', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const room = Game.rooms['W1N1'];
			const path = room.findPath(
				new RoomPosition(25, 25, 'W1N1'),
				new RoomPosition(26, 25, 'W1N1')
			);
			({
				length: path.length,
				step: path[0] && { x: path[0].x, y: path[0].y },
			})
		`) as { length: number; step: { x: number; y: number } | null };

		expect(result.length).toBe(1);
		expect(result.step).toEqual({ x: 26, y: 25 });
	});

	test('LEGACY-PATH-008 findPath({ serialize: true }) returns a serialized string', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const room = Game.rooms['W1N1'];
			const serialized = room.findPath(
				new RoomPosition(10, 10, 'W1N1'),
				new RoomPosition(20, 10, 'W1N1'),
				{ serialize: true }
			);
			({
				type: typeof serialized,
				length: typeof serialized === 'string' ? serialized.length : -1,
			})
		`) as { type: string; length: number };

		expect(result.type).toBe('string');
		expect(result.length).toBeGreaterThan(0);
	});

	test('LEGACY-PATH-009 path step dx/dy match positional deltas and direction matches dx/dy', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const room = Game.rooms['W1N1'];
			const path = room.findPath(
				new RoomPosition(10, 10, 'W1N1'),
				new RoomPosition(20, 10, 'W1N1')
			);
			let prevX = 10, prevY = 10;
			const checks = path.map(step => {
				const expectedDx = step.x - prevX;
				const expectedDy = step.y - prevY;
				const ok = step.dx === expectedDx && step.dy === expectedDy
					&& typeof step.direction === 'number'
					&& step.direction >= 1 && step.direction <= 8;
				prevX = step.x;
				prevY = step.y;
				return ok;
			});
			({
				length: path.length,
				allCorrect: checks.every(Boolean),
				sample: path[0] && ({ x: path[0].x, y: path[0].y, dx: path[0].dx, dy: path[0].dy, direction: path[0].direction }),
			})
		`) as { length: number; allCorrect: boolean; sample: { x: number; y: number; dx: number; dy: number; direction: number } | null };

		expect(result.length).toBeGreaterThan(0);
		expect(result.allCorrect).toBe(true);
	});

	pathFinderUseTest('LEGACY-PATH-003 PathFinder.use() exists and toggles between new PathFinder and legacy mode without throwing', async ({ shard }) => {
		// Catalog rule: "PathFinder.use() toggles between new PathFinder and legacy mode."
		// The actual mode-switch is not observable from user code (legacy and new
		// pathfinder produce the same step format and converge on simple maps),
		// and xxscreeps's PathFinder.use is a no-op (path-finder/index.js:77).
		// We test the contract: the function exists, accepts boolean toggles,
		// returns undefined, and Room.findPath remains usable across toggles.
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const useType = typeof PathFinder.use;
			const enableResult = PathFinder.use(true);
			const disableResult = PathFinder.use(false);
			const reEnableResult = PathFinder.use(true);
			// Confirm findPath still works after toggling.
			const room = Game.rooms['W1N1'];
			const path = room.findPath(
				new RoomPosition(10, 10, 'W1N1'),
				new RoomPosition(15, 10, 'W1N1')
			);
			({
				useType,
				enableResult,
				disableResult,
				reEnableResult,
				pathLength: path.length,
			})
		`) as {
			useType: string;
			enableResult: unknown;
			disableResult: unknown;
			reEnableResult: unknown;
			pathLength: number;
		};

		expect(result.useType).toBe('function');
		expect(result.enableResult).toBeUndefined();
		expect(result.disableResult).toBeUndefined();
		expect(result.reEnableResult).toBeUndefined();
		expect(result.pathLength).toBeGreaterThan(0);
	});
});
