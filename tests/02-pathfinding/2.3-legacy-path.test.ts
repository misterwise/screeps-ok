import { describe, test, expect, code } from '../../src/index.js';
import { hasDocumentedAdapterLimitation } from '../../src/limitations.js';

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
