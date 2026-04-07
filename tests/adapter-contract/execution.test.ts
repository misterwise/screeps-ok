import { describe, test, expect, code, MOVE, CARRY } from '../../src/index.js';
import { RunPlayerError } from '../../src/errors.js';

describe('adapter contract: execution', () => {
	describe('runPlayer', () => {
		test('returns a number (action return code)', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const result = await shard.runPlayer('p1', code`1 + 2`);
			expect(result).toBe(3);
		});

		test('returns a string', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const result = await shard.runPlayer('p1', code`"hello"`);
			expect(result).toBe('hello');
		});

		test('returns a boolean', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const result = await shard.runPlayer('p1', code`true`);
			expect(result).toBe(true);
		});

		test('returns null', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const result = await shard.runPlayer('p1', code`null`);
			expect(result).toBeNull();
		});

		test('returns an object literal', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const result = await shard.runPlayer('p1', code`({ a: 1, b: "two" })`);
			expect(result).toEqual({ a: 1, b: 'two' });
		});

		test('has access to Game object', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const result = await shard.runPlayer('p1', code`typeof Game`);
			expect(result).toBe('object');
		});

		test('has access to Game.time', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const result = await shard.runPlayer('p1', code`Game.time`);
			expect(typeof result).toBe('number');
			expect(result as number).toBeGreaterThan(0);
		});

		test('can find objects by ID via code tag interpolation', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const id = await shard.placeCreep('W1N1', {
				pos: [25, 25],
				owner: 'p1',
				body: [MOVE],
			});
			const result = await shard.runPlayer('p1', code`
				const c = Game.getObjectById(${id});
				!!c
			`);
			expect(result).toBe(true);
		});

		test('collects intents that are processed on tick', async ({ shard }) => {
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
			});
			const creepId = await shard.placeCreep('W1N1', {
				pos: [25, 25],
				owner: 'p1',
				body: [MOVE],
			});

			await shard.runPlayer('p1', code`
				Game.getObjectById(${creepId}).move(1)
			`);
			await shard.tick();

			const creep = await shard.expectObject(creepId, 'creep');
			// Creep should have moved (exact position depends on direction constant)
			expect(creep.pos.x !== 25 || creep.pos.y !== 25).toBe(true);
		});
	});

	describe('runPlayer + tick timing', () => {
		test('runPlayer advances game time by exactly 1', async ({ shard }) => {
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
			});
			await shard.tick();

			const timeBefore = await shard.getGameTime();
			await shard.runPlayer('p1', code`1 + 1`);
			const timeAfter = await shard.getGameTime();
			expect(timeAfter).toBe(timeBefore + 1);
		});

		test('runPlayer processes submitted intents within its tick', async ({ shard }) => {
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
			});
			const creepId = await shard.placeCreep('W1N1', {
				pos: [25, 25], owner: 'p1', body: [MOVE],
			});
			await shard.tick();

			await shard.runPlayer('p1', code`
				Game.getObjectById(${creepId}).move(TOP)
			`);
			// No tick() needed — runPlayer already advanced 1 tick and
			// processed the intent. Observe via getObject (no extra tick).
			const creep = await shard.expectObject(creepId, 'creep');
			expect(creep.pos.y).toBe(24);
		});

		test('tick() after runPlayer advances game time', async ({ shard }) => {
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
			});
			await shard.tick();

			// Observe time via getGameTime (adapter-level, not runPlayer)
			// to isolate tick()'s advancement from runPlayer's side effects.
			await shard.runPlayer('p1', code`1 + 1`);
			const timeAfterRun = await shard.getGameTime();
			await shard.tick();
			const timeAfterTick = await shard.getGameTime();
			// tick() must advance time regardless of what runPlayer consumed.
			expect(timeAfterTick).toBeGreaterThan(timeAfterRun);
		});

		test('tick(N) after runPlayer advances game time by N', async ({ shard }) => {
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
			});
			await shard.tick();

			await shard.runPlayer('p1', code`1 + 1`);
			const timeAfterRun = await shard.getGameTime();
			await shard.tick(3);
			const timeAfterTick = await shard.getGameTime();
			expect(timeAfterTick).toBeGreaterThanOrEqual(timeAfterRun + 3);
		});
	});

	describe('runPlayer side effects', () => {
		test('uninvolved objects are not modified by runPlayer', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const bystander = await shard.placeCreep('W1N1', {
				pos: [10, 10], owner: 'p1',
				body: [CARRY, MOVE],
				store: { energy: 50 },
			});
			const actor = await shard.placeCreep('W1N1', {
				pos: [25, 25], owner: 'p1',
				body: [MOVE],
			});
			await shard.tick();

			const before = await shard.expectObject(bystander, 'creep');
			await shard.runPlayer('p1', code`
				Game.getObjectById(${actor}).move(TOP)
			`);
			const after = await shard.expectObject(bystander, 'creep');

			expect(after.store.energy).toBe(before.store.energy);
			expect(after.pos.x).toBe(before.pos.x);
			expect(after.pos.y).toBe(before.pos.y);
		});

	});

	describe('runPlayers', () => {
		test('all players observe the same game time', async ({ shard }) => {
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [
					{ name: 'W1N1', rcl: 1, owner: 'p1' },
					{ name: 'W2N1', rcl: 1, owner: 'p2' },
				],
			});
			await shard.tick();

			// Both players read Game.time in the same tick.
			// If runPlayers executes sequentially with ticks between,
			// p2 would see Game.time + 1 compared to p1.
			const results = await shard.runPlayers({
				p1: code`Game.time`,
				p2: code`Game.time`,
			});
			expect(results.p1).toBe(results.p2);
		});

		test('runPlayers advances game time by exactly 1', async ({ shard }) => {
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [
					{ name: 'W1N1', rcl: 1, owner: 'p1' },
					{ name: 'W2N1', rcl: 1, owner: 'p2' },
				],
			});
			await shard.tick();

			const timeBefore = await shard.getGameTime();
			await shard.runPlayers({
				p1: code`1 + 1`,
				p2: code`2 + 2`,
			});
			const timeAfter = await shard.getGameTime();
			expect(timeAfter).toBe(timeBefore + 1);
		});
	});

	describe('tick', () => {
		test('advances game time by 1', async ({ shard }) => {
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1' }],
			});
			const before = await shard.getGameTime();
			await shard.tick();
			const after = await shard.getGameTime();
			expect(after).toBe(before + 1);
		});

		test('tick(N) advances game time by N', async ({ shard }) => {
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1' }],
			});
			const before = await shard.getGameTime();
			await shard.tick(5);
			const after = await shard.getGameTime();
			expect(after).toBe(before + 5);
		});
	});
});
