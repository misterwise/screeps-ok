import { describe, test, expect, code, OK, MOVE, RIGHT, BOTTOM, TOP_LEFT } from '../../src/index.js';

describe('creep movement collision', () => {
	test('MOVE-COLLISION-001 creep cannot move onto a tile occupied by a stationary creep', async ({ shard }) => {
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

		// mover should not have moved — blocker is stationary on [25,24].
		const mover = await shard.expectObject(moverId, 'creep');
		expect(mover.pos.x).toBe(25);
		expect(mover.pos.y).toBe(25);

		// blocker stays put.
		const blocker = await shard.expectObject(blockerId, 'creep');
		expect(blocker.pos.x).toBe(25);
		expect(blocker.pos.y).toBe(24);
	});

	test('MOVE-COLLISION-002 two creeps moving to the same empty tile — only one succeeds', async ({ shard }) => {
		await shard.ownedRoom('p1');
		// Both creeps are equidistant from the target tile [25,24].
		const aId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE], name: 'a',
		});
		const bId = await shard.placeCreep('W1N1', {
			pos: [25, 23], owner: 'p1', body: [MOVE], name: 'b',
		});

		// Both move toward [25,24]: a moves TOP, b moves BOTTOM.
		await shard.runPlayer('p1', code`
			Game.creeps['a'].move(TOP);
			Game.creeps['b'].move(BOTTOM);
		`);

		const a = await shard.expectObject(aId, 'creep');
		const b = await shard.expectObject(bId, 'creep');

		// Exactly one creep should be at [25,24], the other stays.
		const aArrived = a.pos.x === 25 && a.pos.y === 24;
		const bArrived = b.pos.x === 25 && b.pos.y === 24;
		expect(aArrived !== bArrived).toBe(true);
	});

	test('MOVE-COLLISION-003 two same-owner creeps can swap tiles by moving toward each other', async ({ shard }) => {
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

	test('MOVE-COLLISION-003b two hostile creeps can also swap tiles by moving toward each other', async ({ shard }) => {
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

	test('MOVE-COLLISION-005 hostile creep blocks movement onto its tile', async ({ shard }) => {
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

		// mover blocked by stationary hostile creep.
		const mover = await shard.expectObject(moverId, 'creep');
		expect(mover.pos.x).toBe(25);
		expect(mover.pos.y).toBe(25);
	});

	test('MOVE-COLLISION-006 circular chain (A→B→C→A) rotates or all stay', async ({ shard }) => {
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

		const rotated = (
			a.pos.x === 25 && a.pos.y === 24 &&
			b.pos.x === 25 && b.pos.y === 25 &&
			c.pos.x === 24 && c.pos.y === 24
		);
		const allStayed = (
			a.pos.x === 24 && a.pos.y === 24 &&
			b.pos.x === 25 && b.pos.y === 24 &&
			c.pos.x === 25 && c.pos.y === 25
		);
		expect(rotated || allStayed).toBe(true);
	});
});
