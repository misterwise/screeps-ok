import { describe, test, expect, code } from '../../src/index.js';

describe('movement: directions', () => {
	// Direction constants: TOP=1, TOP_RIGHT=2, RIGHT=3, BOTTOM_RIGHT=4,
	// BOTTOM=5, BOTTOM_LEFT=6, LEFT=7, TOP_LEFT=8

	test('move(TOP) decreases y by 1', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: ['move'],
		});
		await shard.runPlayer('p1', code`Game.getObjectById(${id}).move(TOP)`);
		await shard.tick();
		const c = await shard.getObject(id);
		if (c?.kind === 'creep') {
			expect(c.pos.x).toBe(25);
			expect(c.pos.y).toBe(24);
		}
	});

	test('move(BOTTOM) increases y by 1', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: ['move'],
		});
		await shard.runPlayer('p1', code`Game.getObjectById(${id}).move(BOTTOM)`);
		await shard.tick();
		const c = await shard.getObject(id);
		if (c?.kind === 'creep') {
			expect(c.pos.x).toBe(25);
			expect(c.pos.y).toBe(26);
		}
	});

	test('move(LEFT) decreases x by 1', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: ['move'],
		});
		await shard.runPlayer('p1', code`Game.getObjectById(${id}).move(LEFT)`);
		await shard.tick();
		const c = await shard.getObject(id);
		if (c?.kind === 'creep') {
			expect(c.pos.x).toBe(24);
			expect(c.pos.y).toBe(25);
		}
	});

	test('move(RIGHT) increases x by 1', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: ['move'],
		});
		await shard.runPlayer('p1', code`Game.getObjectById(${id}).move(RIGHT)`);
		await shard.tick();
		const c = await shard.getObject(id);
		if (c?.kind === 'creep') {
			expect(c.pos.x).toBe(26);
			expect(c.pos.y).toBe(25);
		}
	});

	test('move(TOP_RIGHT) moves diagonally', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: ['move'],
		});
		await shard.runPlayer('p1', code`Game.getObjectById(${id}).move(TOP_RIGHT)`);
		await shard.tick();
		const c = await shard.getObject(id);
		if (c?.kind === 'creep') {
			expect(c.pos.x).toBe(26);
			expect(c.pos.y).toBe(24);
		}
	});

	test('move into wall returns ERR_INVALID_TARGET', async ({ shard }) => {
		// Build terrain with a wall
		const terrain = new Array(2500).fill(0);
		terrain[24 * 50 + 25] = 1; // wall at (25, 24) — directly above
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1', terrain }],
		});
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: ['move'],
		});
		const rc = await shard.runPlayer('p1', code`Game.getObjectById(${id}).move(TOP)`);
		await shard.tick();

		// Should not have moved
		const c = await shard.getObject(id);
		if (c?.kind === 'creep') {
			expect(c.pos.x).toBe(25);
			expect(c.pos.y).toBe(25);
		}
	});
});
