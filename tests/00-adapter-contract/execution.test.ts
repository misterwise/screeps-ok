import {
	describe, test, expect, code, MOVE, CARRY, DENSITY_LOW, DENSITY_MODERATE, DENSITY_HIGH,
	MINERAL_DENSITY, MINERAL_DENSITY_PROBABILITY, RESOURCE_HYDROGEN, RESOURCE_OXYGEN,
} from '../../src/index.js';
import type { ShardFixture } from '../../src/fixture.js';
import { RunPlayerError } from '../../src/errors.js';

// A LOW mineral redraws its density on every regeneration (minerals/tick.js:19-30), one Math.random each.
async function regeneratingLowMineral(shard: ShardFixture, pos: [number, number], ticksToRegeneration: number) {
	return shard.placeMineral('W1N1', {
		pos, mineralType: pos[0] < 25 ? RESOURCE_HYDROGEN : RESOURCE_OXYGEN,
		density: DENSITY_LOW, mineralAmount: 0, ticksToRegeneration,
	});
}

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
				Game.getObjectById(${creepId}).move(TOP)
			`);
			await shard.tick();

			const creep = await shard.expectObject(creepId, 'creep');
			expect({ x: creep.pos.x, y: creep.pos.y }).toEqual({ x: 25, y: 24 });
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
			// tick() advances exactly one tick regardless of what runPlayer consumed.
			expect(timeAfterTick).toBe(timeAfterRun + 1);
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
			expect(timeAfterTick).toBe(timeAfterRun + 3);
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

		test('runPlayers normalizes each result as runPlayer does', async ({ shard }) => {
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [
					{ name: 'W1N1', rcl: 1, owner: 'p1' },
					{ name: 'W2N1', rcl: 1, owner: 'p2' },
				],
			});
			expect(await shard.runPlayers({ p1: code`undefined`, p2: code`({ time: typeof Game.time })` }))
				.toEqual({ p1: null, p2: { time: 'number' } });
			await expect(shard.runPlayers({ p1: code`1`, p2: code`Game.rooms.W2N1` }))
				.rejects.toMatchObject({ errorKind: 'serialization' });
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

		test('an aborted signal stops tick before another tick starts', async ({ shard }) => {
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1' }],
			});
			const before = await shard.getGameTime();
			const reason = new Error('stop');
			await expect(shard.tick(3, { signal: AbortSignal.abort(reason) })).rejects.toBe(reason);
			expect(await shard.getGameTime()).toBe(before);
		});
	});

	describe('tick options.random', () => {
		test('rejects out-of-range and non-finite values without advancing time', async ({ shard }) => {
			shard.requires('randomInjection');
			await shard.ownedRoom('p1');
			const before = await shard.getGameTime();
			await expect(shard.tick(1, { random: [1.0] })).rejects.toThrow(/random\[0\]/);
			for (const bad of [NaN, Infinity, -0.1]) {
				await expect(shard.tick(1, { random: [0.5, bad] })).rejects.toThrow(/random\[1\]/);
			}
			const after = await shard.getGameTime();
			expect(after).toBe(before);
		});

		test('consumes one sequence across every tick of the call', async ({ shard }) => {
			shard.requires('randomInjection');
			await shard.ownedRoom('p1');
			const first = await regeneratingLowMineral(shard, [20, 20], 1);
			const second = await regeneratingLowMineral(shard, [30, 30], 2);
			// One draw per tick: the first picks MODERATE, the second HIGH; a sequence reset per tick would pick MODERATE twice.
			const moderate = (MINERAL_DENSITY_PROBABILITY[DENSITY_LOW] + MINERAL_DENSITY_PROBABILITY[DENSITY_MODERATE]) / 2;
			const high = (MINERAL_DENSITY_PROBABILITY[DENSITY_MODERATE] + MINERAL_DENSITY_PROBABILITY[DENSITY_HIGH]) / 2;
			await shard.tick(2, { random: [moderate, high] });
			expect([
				(await shard.expectObject(first, 'mineral')).density,
				(await shard.expectObject(second, 'mineral')).density,
			]).toEqual([DENSITY_MODERATE, DENSITY_HIGH]);
		});

		test('restores Math.random after the call, and after a call that throws', async ({ shard }) => {
			shard.requires('randomInjection');
			await shard.ownedRoom('p1');
			await shard.tick(1, { random: [] });
			// A sequence left in place would be exhausted by the regeneration's draw.
			const first = await regeneratingLowMineral(shard, [20, 20], 1);
			await shard.tick(2);
			expect((await shard.expectObject(first, 'mineral')).mineralAmount).toBe(MINERAL_DENSITY[DENSITY_LOW]);

			await regeneratingLowMineral(shard, [30, 30], 1);
			await expect(shard.tick(1, { random: [] })).rejects.toThrow(/exhausted/);
			// The aborted tick's world is not the contract; a fresh one shows Math.random is back.
			await shard.ownedRoom('p1');
			const second = await regeneratingLowMineral(shard, [30, 30], 1);
			await shard.tick(2);
			expect((await shard.expectObject(second, 'mineral')).mineralAmount).toBe(MINERAL_DENSITY[DENSITY_LOW]);
		});

		test('throws when sequence exhausted by processor random calls', async ({ shard }) => {
			shard.requires('randomInjection');
			await shard.ownedRoom('p1');
			// A regenerating MODERATE mineral consumes 2 random values on the
			// regen tick (gate, then density selection). Providing a single
			// gate-passing value forces exhaustion mid-tick.
			await shard.placeMineral('W1N1', {
				pos: [25, 25], mineralType: 'H', density: DENSITY_MODERATE,
				mineralAmount: 0, ticksToRegeneration: 3,
			});
			await expect(shard.tick(5, { random: [0.04] })).rejects.toThrow(/exhausted/);
		});

		test('does not throw when sequence has more values than consumed', async ({ shard }) => {
			shard.requires('randomInjection');
			await shard.ownedRoom('p1');
			// Empty owned room consumes no random values during a single tick.
			await expect(shard.tick(1, { random: [0.5, 0.5, 0.5] })).resolves.toBeUndefined();
		});
	});
});
