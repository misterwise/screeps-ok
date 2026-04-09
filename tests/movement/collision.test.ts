import { describe, test, expect, code, OK, MOVE } from '../../src/index.js';

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
});
