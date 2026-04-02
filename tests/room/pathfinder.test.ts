import { describe, test, expect, code } from '../../src/index.js';

describe('PathFinder', () => {
	test('finds a path between two points', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const goal = { pos: new RoomPosition(40, 40, 'W1N1'), range: 1 };
			const result = PathFinder.search(new RoomPosition(10, 10, 'W1N1'), goal);
			({
				pathLength: result.path.length,
				incomplete: result.incomplete,
				ops: result.ops,
			})
		`) as any;

		expect(result.pathLength).toBeGreaterThan(0);
		expect(result.incomplete).toBe(false);
		expect(result.ops).toBeGreaterThan(0);
	});

	test('CostMatrix sets tile costs', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const cm = new PathFinder.CostMatrix();
			cm.set(25, 25, 255); // impassable
			const val = cm.get(25, 25);
			({ val })
		`) as any;

		expect(result.val).toBe(255);
	});

	// TODO: Enable once the suite can provide the terrain data PathFinder roomCallback
	// needs through the current adapters without special-case harness setup.
	test.todo('respects CostMatrix when routing');
});

describe('Game.map', () => {
	test('getRoomLinearDistance returns correct distance', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const dist = await shard.runPlayer('p1', code`
			Game.map.getRoomLinearDistance('W1N1', 'W5N5')
		`);
		// getRoomLinearDistance uses Chebyshev distance: max(|5-1|, |5-1|) = 4
		expect(dist).toBe(4);
	});

	test('describeExits returns exit directions', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const exits = await shard.runPlayer('p1', code`
			Game.map.describeExits('W1N1')
		`) as any;

		// Should be an object with direction keys
		expect(typeof exits).toBe('object');
	});
});
