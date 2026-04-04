import { describe, test, expect, code } from '../../src/index.js';

describe('PathFinder', () => {
	test('search returns a complete path to within the requested range of a single goal', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const goal = { pos: new RoomPosition(40, 40, 'W1N1'), range: 1 };
			const result = PathFinder.search(new RoomPosition(10, 10, 'W1N1'), goal);
			({
				pathLength: result.path.length,
				first: result.path[0] && { x: result.path[0].x, y: result.path[0].y, roomName: result.path[0].roomName },
				last: result.path[result.path.length - 1] && {
					x: result.path[result.path.length - 1].x,
					y: result.path[result.path.length - 1].y,
					roomName: result.path[result.path.length - 1].roomName,
				},
				incomplete: result.incomplete,
				opsType: typeof result.ops,
				costType: typeof result.cost,
			})
		`) as {
			pathLength: number;
			first: { x: number; y: number; roomName: string } | null;
			last: { x: number; y: number; roomName: string } | null;
			incomplete: boolean;
			opsType: string;
			costType: string;
		};

		expect(result.pathLength).toBe(29);
		expect(result.first).toEqual({ x: 11, y: 11, roomName: 'W1N1' });
		expect(result.last).toEqual({ x: 39, y: 39, roomName: 'W1N1' });
		expect(result.incomplete).toBe(false);
		expect(result.opsType).toBe('number');
		expect(result.costType).toBe('number');
	});

	test('CostMatrix defaults to 0, stores assigned costs, and round-trips through serialization', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const cm = new PathFinder.CostMatrix();
			const before = cm.get(25, 25);
			cm.set(25, 25, 255);
			const after = cm.get(25, 25);
			const roundTrip = PathFinder.CostMatrix.deserialize(cm.serialize()).get(25, 25);
			({ before, after, roundTrip })
		`) as { before: number; after: number; roundTrip: number };

		expect(result.before).toBe(0);
		expect(result.after).toBe(255);
		expect(result.roundTrip).toBe(255);
	});

	test.todo('PathFinder.search respects CostMatrix when routing');
});

describe('Game.map', () => {
	test('getRoomLinearDistance returns the room-grid Manhattan distance between two rooms', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const dist = await shard.runPlayer('p1', code`
			Game.map.getRoomLinearDistance('W1N1', 'W5N5')
		`);

		expect(dist).toBe(4);
	});

	test('describeExits returns only exit direction keys with adjacent room names as values for a valid room name', async ({ shard }) => {
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

	test('describeExits returns null for an invalid room name', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const exits = await shard.runPlayer('p1', code`
			Game.map.describeExits('not_a_room')
		`);

		expect(exits).toBeNull();
	});
});
