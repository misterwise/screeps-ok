import { describe, test, expect, code, MOVE } from '../../src/index.js';
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
