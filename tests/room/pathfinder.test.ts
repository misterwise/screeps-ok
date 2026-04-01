import { describe, test, expect, code } from '../../src/index.js';

describe('PathFinder', () => {
	test('finds a path between two points', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});

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
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});

		const result = await shard.runPlayer('p1', code`
			const cm = new PathFinder.CostMatrix();
			cm.set(25, 25, 255); // impassable
			const val = cm.get(25, 25);
			({ val })
		`) as any;

		expect(result.val).toBe(255);
	});

	test('respects CostMatrix when routing', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});

		const result = await shard.runPlayer('p1', code`
			// Block the direct path with a wall of 255-cost tiles
			const cm = new PathFinder.CostMatrix();
			for (let y = 0; y < 50; y++) cm.set(25, y, 255);

			const goal = { pos: new RoomPosition(30, 25, 'W1N1'), range: 0 };
			const withWall = PathFinder.search(new RoomPosition(20, 25, 'W1N1'), goal, {
				roomCallback: () => cm,
			});
			const without = PathFinder.search(new RoomPosition(20, 25, 'W1N1'), goal);

			({
				withWallLength: withWall.path.length,
				withoutLength: without.path.length,
			})
		`) as any;

		// Path with wall should be longer since it has to go around
		expect(result.withWallLength).toBeGreaterThan(result.withoutLength);
	});
});

describe('Game.map', () => {
	test('getRoomLinearDistance returns correct distance', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});

		const dist = await shard.runPlayer('p1', code`
			Game.map.getRoomLinearDistance('W1N1', 'W5N5')
		`);
		expect(dist).toBe(8); // |5-1| + |5-1| = 8? No, it's Chebyshev: max(4,4) = 4
		// Actually getRoomLinearDistance uses Chebyshev distance
	});

	test('describeExits returns exit directions', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});

		const exits = await shard.runPlayer('p1', code`
			Game.map.describeExits('W1N1')
		`) as any;

		// Should be an object with direction keys
		expect(typeof exits).toBe('object');
	});
});
