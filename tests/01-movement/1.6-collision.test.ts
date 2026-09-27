import { describe, test, expect, code, OK, MOVE, RIGHT, BOTTOM, TOP_LEFT, ERR_NO_PATH, FIND_CREEPS } from '../../src/index.js';
import type { ShardFixture } from '../../src/fixture.js';

describe('creep movement collision', () => {
	// a at (25,25) and b at (25,23) both move onto the empty (25,24); vanilla's
	// rate sort picks the winner (movement.js:139), so neither test names it.
	async function contestTile(shard: ShardFixture) {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', { pos: [25, 25], owner: 'p1', body: [MOVE], name: 'a' });
		await shard.placeCreep('W1N1', { pos: [25, 23], owner: 'p1', body: [MOVE], name: 'b' });
		const rcs = await shard.runPlayer('p1', code`[Game.creeps['a'].move(TOP), Game.creeps['b'].move(BOTTOM)]`);
		const positions: Record<string, [number, number]> = {};
		for (const c of await shard.findInRoom('W1N1', FIND_CREEPS)) {
			if (c.kind === 'creep') positions[c.name] = [c.pos.x, c.pos.y];
		}
		return { rcs, positions };
	}

	test('MOVE-COLLISION-001 exactly one of two creeps moving onto the same empty tile occupies it', async ({ shard }) => {
		const { positions } = await contestTile(shard);
		expect(Object.values(positions).filter(([x, y]) => x === 25 && y === 24)).toHaveLength(1);
	});

	test('MOVE-COLLISION-002 the creep that loses the tile stays on its own and got OK from move()', async ({ shard }) => {
		const { rcs, positions } = await contestTile(shard);
		expect(rcs).toEqual([OK, OK]);
		const start: Record<string, [number, number]> = { a: [25, 25], b: [25, 23] };
		const loser = Object.keys(start).find(name => positions[name][1] !== 24)!;
		expect(positions[loser]).toEqual(start[loser]);
	});

	test('MOVE-COLLISION-003:sameOwner two same-owner creeps can swap tiles by moving toward each other', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const aId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE], name: 'a',
		});
		const bId = await shard.placeCreep('W1N1', {
			pos: [25, 24], owner: 'p1', body: [MOVE], name: 'b',
		});

		// a moves TOP (toward b), b moves BOTTOM (toward a).
		await shard.runPlayer('p1', code`
			Game.creeps['a'].move(TOP);
			Game.creeps['b'].move(BOTTOM);
		`);

		// Same-owner swap succeeds — creeps exchange positions.
		const a = await shard.expectObject(aId, 'creep');
		const b = await shard.expectObject(bId, 'creep');
		expect(a.pos.x).toBe(25);
		expect(a.pos.y).toBe(24);
		expect(b.pos.x).toBe(25);
		expect(b.pos.y).toBe(25);
	});

	test('MOVE-COLLISION-003:hostile two hostile creeps can also swap tiles by moving toward each other', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const aId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE], name: 'a',
		});
		const bId = await shard.placeCreep('W1N1', {
			pos: [25, 24], owner: 'p2', body: [MOVE], name: 'b',
		});

		// a moves TOP (toward b), b moves BOTTOM (toward a).
		await shard.runPlayers({
			p1: code`Game.creeps['a'].move(TOP)`,
			p2: code`Game.creeps['b'].move(BOTTOM)`,
		});

		// Hostile swap also succeeds — creeps exchange positions.
		const a = await shard.expectObject(aId, 'creep');
		const b = await shard.expectObject(bId, 'creep');
		expect(a.pos.x).toBe(25);
		expect(a.pos.y).toBe(24);
		expect(b.pos.x).toBe(25);
		expect(b.pos.y).toBe(25);
	});

	test('MOVE-COLLISION-004 creep can move onto a tile vacated by another creep moving away', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const followerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE], name: 'follower',
		});
		const leaderId = await shard.placeCreep('W1N1', {
			pos: [25, 24], owner: 'p1', body: [MOVE], name: 'leader',
		});

		// leader moves TOP (vacating [25,24]), follower moves TOP into the vacated tile.
		await shard.runPlayer('p1', code`
			Game.creeps['leader'].move(TOP);
			Game.creeps['follower'].move(TOP);
		`);

		const follower = await shard.expectObject(followerId, 'creep');
		const leader = await shard.expectObject(leaderId, 'creep');
		expect(leader.pos.x).toBe(25);
		expect(leader.pos.y).toBe(23);
		expect(follower.pos.x).toBe(25);
		expect(follower.pos.y).toBe(24);
	});

	test('MOVE-COLLISION-005:own the player\'s own stationary creep blocks movement onto its tile', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const moverId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE], name: 'mover',
		});
		const blockerId = await shard.placeCreep('W1N1', {
			pos: [25, 24], owner: 'p1', body: [MOVE], name: 'blocker',
		});

		// mover tries to move TOP into blocker's tile.
		const rc = await shard.runPlayer('p1', code`
			Game.creeps['mover'].move(TOP)
		`);
		expect(rc).toBe(OK);

		expect((await shard.expectObject(moverId, 'creep')).pos).toEqual({ x: 25, y: 25, roomName: 'W1N1' });
		expect((await shard.expectObject(blockerId, 'creep')).pos).toEqual({ x: 25, y: 24, roomName: 'W1N1' });
	});

	test('MOVE-COLLISION-005:hostile a hostile stationary creep blocks movement onto its tile', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const moverId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE], name: 'mover',
		});
		const hostileId = await shard.placeCreep('W1N1', {
			pos: [25, 24], owner: 'p2', body: [MOVE], name: 'hostile',
		});

		const rc = await shard.runPlayer('p1', code`
			Game.creeps['mover'].move(TOP)
		`);
		expect(rc).toBe(OK);

		expect((await shard.expectObject(moverId, 'creep')).pos).toEqual({ x: 25, y: 25, roomName: 'W1N1' });
		expect((await shard.expectObject(hostileId, 'creep')).pos).toEqual({ x: 25, y: 24, roomName: 'W1N1' });
	});

	test('MOVE-COLLISION-006 circular chain (A→B→C→A) rotates', async ({ shard }) => {
		await shard.ownedRoom('p1');
		// Triangle: A→B→C→A
		//   A at [24,24] moves RIGHT  → wants [25,24] (B's tile)
		//   B at [25,24] moves BOTTOM → wants [25,25] (C's tile)
		//   C at [25,25] moves TOP_LEFT → wants [24,24] (A's tile)
		const aId = await shard.placeCreep('W1N1', {
			pos: [24, 24], owner: 'p1', body: [MOVE], name: 'a',
		});
		const bId = await shard.placeCreep('W1N1', {
			pos: [25, 24], owner: 'p1', body: [MOVE], name: 'b',
		});
		const cId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE], name: 'c',
		});

		await shard.runPlayer('p1', code`
			Game.creeps['a'].move(${RIGHT});
			Game.creeps['b'].move(${BOTTOM});
			Game.creeps['c'].move(${TOP_LEFT});
		`);

		const a = await shard.expectObject(aId, 'creep');
		const b = await shard.expectObject(bId, 'creep');
		const c = await shard.expectObject(cId, 'creep');

		expect([a.pos.x, a.pos.y]).toEqual([25, 24]);
		expect([b.pos.x, b.pos.y]).toEqual([25, 25]);
		expect([c.pos.x, c.pos.y]).toEqual([24, 24]);
	});

	test('MOVE-COLLISION-007 moveTo with ignoreCreeps:false returns ERR_NO_PATH when every viable route is blocked by stationary creeps', async ({ shard }) => {
		await shard.ownedRoom('p1');
		// Mover starts away from the target. The target tile (10, 10) is a
		// stationary creep, and every 8-neighbour of (10, 10) is also a
		// stationary creep — no walkable tile within range 1 of the goal.
		const moverId = await shard.placeCreep('W1N1', {
			pos: [5, 5], owner: 'p1', body: [MOVE], name: 'mover',
		});
		await shard.placeCreep('W1N1', {
			pos: [10, 10], owner: 'p1', body: [MOVE], name: 'sentry',
		});
		const surroundOffsets: Array<[number, number]> = [
			[-1, -1], [0, -1], [1, -1],
			[-1, 0], [1, 0],
			[-1, 1], [0, 1], [1, 1],
		];
		for (const [dx, dy] of surroundOffsets) {
			await shard.placeCreep('W1N1', {
				pos: [10 + dx, 10 + dy], owner: 'p1', body: [MOVE],
				name: `block_${dx}_${dy}`,
			});
		}
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.creeps['mover'].moveTo(Game.creeps['sentry'], {
				ignoreCreeps: false,
				maxRooms: 1,
			})
		`);
		expect(rc).toBe(ERR_NO_PATH);

		const mover = await shard.expectObject(moverId, 'creep');
		expect(mover.pos.x).toBe(5);
		expect(mover.pos.y).toBe(5);
	});
});
