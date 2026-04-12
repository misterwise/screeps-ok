import { describe, test, expect, code } from '../../src/index.js';

describe('CostMatrix', () => {
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

	test('COSTMATRIX-004 clone() returns an independent copy of the matrix', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const cm = new PathFinder.CostMatrix();
			cm.set(10, 10, 42);
			const clone = cm.clone();
			clone.set(10, 10, 99);
			({ original: cm.get(10, 10), cloned: clone.get(10, 10) })
		`) as { original: number; cloned: number };

		expect(result.original).toBe(42);
		expect(result.cloned).toBe(99);
	});

	test('COSTMATRIX-005 set(x, y, cost) clamps assigned values into 0..255', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const cm = new PathFinder.CostMatrix();
			cm.set(1, 1, -1);
			cm.set(2, 2, 256);
			cm.set(3, 3, 0);
			cm.set(4, 4, 255);
			({
				negative: cm.get(1, 1),
				overflow: cm.get(2, 2),
				zero: cm.get(3, 3),
				max: cm.get(4, 4),
			})
		`) as { negative: number; overflow: number; zero: number; max: number };

		expect(result.zero).toBe(0);
		expect(result.max).toBe(255);
		expect(result.negative).toBeGreaterThanOrEqual(0);
		expect(result.negative).toBeLessThanOrEqual(255);
		expect(result.overflow).toBeGreaterThanOrEqual(0);
		expect(result.overflow).toBeLessThanOrEqual(255);
	});

	test('COSTMATRIX-006 CostMatrix value 0 means use the default terrain cost', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const origin = new RoomPosition(10, 10, 'W1N1');
			const goal = { pos: new RoomPosition(20, 20, 'W1N1'), range: 0 };
			// All-zero matrix should be indistinguishable from no callback.
			const zeroMatrix = new PathFinder.CostMatrix();
			const withZero = PathFinder.search(origin, goal, { roomCallback: () => zeroMatrix });
			const withoutCallback = PathFinder.search(origin, goal);
			({
				zeroCost: withZero.cost,
				zeroIncomplete: withZero.incomplete,
				baselineCost: withoutCallback.cost,
				baselineIncomplete: withoutCallback.incomplete,
			})
		`) as {
			zeroCost: number;
			zeroIncomplete: boolean;
			baselineCost: number;
			baselineIncomplete: boolean;
		};

		expect(result.zeroIncomplete).toBe(false);
		expect(result.baselineIncomplete).toBe(false);
		expect(result.zeroCost).toBe(result.baselineCost);
	});

	test('COSTMATRIX-008 CostMatrix values 1–254 override terrain cost', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			// Force a straight corridor from [10,25] to [14,25] using 255-walls
			// everywhere else. Set each corridor tile to cost 10.
			const cm = new PathFinder.CostMatrix();
			for (let x = 0; x < 50; x++) {
				for (let y = 0; y < 50; y++) {
					if (y === 25 && x >= 10 && x <= 14) {
						cm.set(x, y, 10);
					} else {
						cm.set(x, y, 255);
					}
				}
			}
			const result = PathFinder.search(
				new RoomPosition(10, 25, 'W1N1'),
				{ pos: new RoomPosition(14, 25, 'W1N1'), range: 0 },
				{ roomCallback: () => cm, maxRooms: 1 }
			);
			({ cost: result.cost, incomplete: result.incomplete, pathLength: result.path.length })
		`) as { cost: number; incomplete: boolean; pathLength: number };

		expect(result.incomplete).toBe(false);
		expect(result.pathLength).toBe(4);
		// 4 steps each entering a tile with cost 10 → total 40.
		expect(result.cost).toBe(40);
	});

	test('COSTMATRIX-007 CostMatrix value 255 means the tile is unwalkable', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			// Surround the goal with cost-255 walls — fully unreachable.
			const cm = new PathFinder.CostMatrix();
			for (let dx = -1; dx <= 1; dx++) {
				for (let dy = -1; dy <= 1; dy++) {
					cm.set(40 + dx, 40 + dy, 255);
				}
			}
			// Also block the goal tile itself for good measure.
			cm.set(40, 40, 255);
			// maxRooms=1 keeps the search inside W1N1 — the test world has no
			// neighbor rooms loaded.
			const result = PathFinder.search(
				new RoomPosition(10, 10, 'W1N1'),
				{ pos: new RoomPosition(40, 40, 'W1N1'), range: 0 },
				{ roomCallback: () => cm, maxRooms: 1 }
			);
			({
				incomplete: result.incomplete,
				lastIsGoal: result.path.length > 0
					&& result.path[result.path.length - 1].x === 40
					&& result.path[result.path.length - 1].y === 40,
			})
		`) as { incomplete: boolean; lastIsGoal: boolean };

		expect(result.incomplete).toBe(true);
		expect(result.lastIsGoal).toBe(false);
	});
});
