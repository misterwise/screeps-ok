import { describe, test, expect, code } from '../../src/index.js';

// PathFinder.search must actually be A* (F = G + weight * H). An implementation
// that orders the frontier by G alone is a Dijkstra flood: inside a single room it
// still terminates (2500 tiles is well under the default maxOps of 10000), so every
// in-room pathfinding test passes — but a CROSS-ROOM search expands equally in all
// directions and exhausts maxOps before it ever reaches the goal, returning
// `incomplete: true` for a plainly reachable target.
//
// That is invisible to in-room tests and catastrophic for a real bot: `incomplete`
// is how a bot decides a room is unreachable, so remote mining, expansion and
// hauling all quietly switch off. Measured on an open 3-room corridor, ordering by
// G alone cost 1371 ops for a one-room hop and blew the whole 10000-op budget
// (incomplete, 51 of 69 steps) for a two-room hop; with the heuristic the same two
// searches cost 20 and 70 ops and both complete. Previously uncovered.
describe('PF-CROSSROOM-001: PathFinder.search is directed, not a flood', () => {
	test('a goal two rooms away completes well inside the default op budget', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1' },
				{ name: 'W3N1' },
			],
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const r = PathFinder.search(
				new RoomPosition(10, 25, 'W1N1'),
				{ pos: new RoomPosition(40, 25, 'W3N1'), range: 1 }
			);
			({
				incomplete: r.incomplete,
				ops: r.ops,
				len: r.path.length,
				endRoom: r.path.length ? r.path[r.path.length - 1].roomName : null,
			})
		`) as { incomplete: boolean; ops: number; len: number; endRoom: string | null };

		expect(result.incomplete).toBe(false);
		expect(result.endRoom).toBe('W3N1');
		expect(result.len).toBeGreaterThan(0);
		// A directed search costs a small multiple of the path length. A flood costs
		// the whole default budget and never arrives.
		expect(result.ops).toBeLessThan(result.len * 20);
	});

	test('PF-CROSSROOM-002 a one-room hop over open terrain is not explored breadth-first', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }, { name: 'W2N1' }],
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const r = PathFinder.search(
				new RoomPosition(10, 25, 'W1N1'),
				{ pos: new RoomPosition(40, 25, 'W2N1'), range: 1 }
			);
			({ incomplete: r.incomplete, ops: r.ops, len: r.path.length })
		`) as { incomplete: boolean; ops: number; len: number };

		expect(result.incomplete).toBe(false);
		// Breadth-first expansion over an open corridor visits O(len^2) tiles; a
		// directed one visits O(len).
		expect(result.ops).toBeLessThan(result.len * 20);
	});

	test('PF-CROSSROOM-003 roomCallback is not consulted for rooms behind the origin', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1' },
				{ name: 'W0N1' },
			],
		});
		await shard.tick();

		const seen = await shard.runPlayer('p1', code`
			const seen = [];
			PathFinder.search(
				new RoomPosition(10, 25, 'W1N1'),
				{ pos: new RoomPosition(40, 25, 'W2N1'), range: 1 },
				{ roomCallback: function (rn) { if (seen.indexOf(rn) < 0) seen.push(rn); return undefined; } }
			);
			seen.sort()
		`) as string[];

		expect(seen).toContain('W2N1');
		expect(seen).not.toContain('W0N1');
	});
});
