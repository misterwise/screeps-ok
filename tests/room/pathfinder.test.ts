import { describe, test, expect, code } from '../../src/index.js';
import { knownParityGap } from '../support/parity-gaps.js';

describe('PathFinder', () => {
	knownParityGap('pathfinder-suboptimal')('PATHFINDER-001 PathFinder.search accepts a single goal position with range', async ({ shard }) => {
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

	knownParityGap('describe-exits-topology')('MAP-ROOM-001 describeExits returns only exit direction keys with adjacent room names as values for a valid room name', async ({ shard }) => {
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
});
