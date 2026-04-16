import { describe, test, expect, code, MOVE } from '../../src/index.js';
import { RunPlayerError } from '../../src/errors.js';
import type { PlayerCode } from '../../src/code.js';

describe('adapter contract: error model', () => {
	describe('syntax errors', () => {
		test('syntax error throws RunPlayerError with errorKind "syntax"', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const err = await shard.expectRunPlayerError('p1', code`if (`, 'syntax');
			expect(err).toBeInstanceOf(RunPlayerError);
		});

		test('syntax error engineMessage is non-empty', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const err = await shard.expectRunPlayerError('p1', code`function() {`, 'syntax');
			expect(err.engineMessage.length).toBeGreaterThan(0);
		});
	});

	describe('runtime errors', () => {
		test('ReferenceError throws RunPlayerError with errorKind "runtime"', async ({ shard }) => {
			await shard.ownedRoom('p1');
			await shard.expectRunPlayerError('p1', code`nonexistentVariable_abc123`, 'runtime');
		});

		test('TypeError throws RunPlayerError with errorKind "runtime"', async ({ shard }) => {
			await shard.ownedRoom('p1');
			await shard.expectRunPlayerError('p1', code`null.foo`, 'runtime');
		});

		test('explicit throw produces RunPlayerError with errorKind "runtime"', async ({ shard }) => {
			await shard.ownedRoom('p1');
			await shard.expectRunPlayerError(
				'p1', code`throw new Error("deliberate test error")`, 'runtime',
			);
		});

		test('runtime error engineMessage is non-empty', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const err = await shard.expectRunPlayerError('p1', code`null.foo`, 'runtime');
			expect(err.engineMessage.length).toBeGreaterThan(0);
		});

		// Non-Error throws are valid JavaScript and must classify as 'runtime',
		// not bomb as adapter infrastructure errors. Naive `e.message` /
		// `e.constructor.name` access on null/undefined throws inside the
		// wrapper's catch block, which would escape the wrapper and surface as
		// "code was not executed".
		test('throw null produces RunPlayerError with errorKind "runtime"', async ({ shard }) => {
			await shard.ownedRoom('p1');
			await shard.expectRunPlayerError('p1', code`throw null`, 'runtime');
		});

		test('throw undefined produces RunPlayerError with errorKind "runtime"', async ({ shard }) => {
			await shard.ownedRoom('p1');
			await shard.expectRunPlayerError('p1', code`throw undefined`, 'runtime');
		});

		test('throw string produces RunPlayerError with errorKind "runtime"', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const err = await shard.expectRunPlayerError('p1', code`throw 'oops'`, 'runtime');
			expect(err.engineMessage.length).toBeGreaterThan(0);
		});

		test('throw number produces RunPlayerError with errorKind "runtime"', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const err = await shard.expectRunPlayerError('p1', code`throw 42`, 'runtime');
			expect(err.engineMessage.length).toBeGreaterThan(0);
		});
	});

	describe('serialization errors', () => {
		test('returning a creep object throws RunPlayerError with errorKind "serialization"', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const id = await shard.placeCreep('W1N1', {
				pos: [25, 25],
				owner: 'p1',
				body: [MOVE],
			});
			await shard.expectRunPlayerError(
				'p1', code`Game.getObjectById(${id})`, 'serialization',
			);
		});

		test('returning a room object throws RunPlayerError with errorKind "serialization"', async ({ shard }) => {
			await shard.ownedRoom('p1');
			await shard.expectRunPlayerError(
				'p1', code`Game.rooms['W1N1']`, 'serialization',
			);
		});

		// JSON-unsafe values that aren't class instances. The plain-object
		// constructor check alone misses these — a defensive JSON.stringify
		// probe is required to catch lossy serialization.
		test('returning a circular plain object throws RunPlayerError with errorKind "serialization"', async ({ shard }) => {
			await shard.ownedRoom('p1');
			await shard.expectRunPlayerError(
				'p1', code`const o = {}; o.self = o; o`, 'serialization',
			);
		});

		test('returning a function throws RunPlayerError with errorKind "serialization"', async ({ shard }) => {
			await shard.ownedRoom('p1');
			await shard.expectRunPlayerError(
				'p1', code`() => 1`, 'serialization',
			);
		});
	});

	describe('undefined normalization', () => {
		test('explicit undefined return is normalized to null', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const result = await shard.runPlayer('p1', code`undefined`);
			expect(result).toBeNull();
		});

		test('void expression return is normalized to null', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const result = await shard.runPlayer('p1', code`void 0`);
			expect(result).toBeNull();
		});

		test('implicit undefined from statement is normalized to null', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const result = await shard.runPlayer('p1', code`let x = 1`);
			expect(result).toBeNull();
		});
	});

	describe('error kind discrimination', () => {
		test('syntax error is not misclassified as runtime', async ({ shard }) => {
			await shard.ownedRoom('p1');
			// This must throw with errorKind 'syntax', not 'runtime'.
			// Adapters that wrap all errors as 'runtime' will fail here.
			let caught: RunPlayerError | null = null;
			try {
				await shard.runPlayer('p1', code`if (`);
			} catch (err) {
				if (err instanceof RunPlayerError) caught = err;
				else throw err;
			}
			expect(caught).not.toBeNull();
			expect(caught!.errorKind).toBe('syntax');
			expect(caught!.errorKind).not.toBe('runtime');
		});

		// Spec §Error Model: "Adapters should preserve the engine's user-facing
		// message in RunPlayerError.engineMessage where possible." Adapter-added
		// context (handle prefix, framing strings) belongs in the wrapping
		// Error message, not in engineMessage.
		test('runPlayers preserves engineMessage without handle prefix', async ({ shard }) => {
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
			});
			let caught: RunPlayerError | null = null;
			try {
				await shard.runPlayers({
					p1: code`1 + 1` as PlayerCode,
					p2: code`null.foo` as PlayerCode,
				});
			} catch (err) {
				if (err instanceof RunPlayerError) caught = err;
				else throw err;
			}
			expect(caught).not.toBeNull();
			// The engine's TypeError message must come through clean — no
			// "p2:" prefix the adapter would add to disambiguate handles.
			expect(caught!.engineMessage).not.toMatch(/^p2:/);
			expect(caught!.engineMessage).not.toMatch(/^p1:/);
			expect(caught!.engineMessage.length).toBeGreaterThan(0);
		});

		test('game object return does not silently produce empty object', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const id = await shard.placeCreep('W1N1', {
				pos: [25, 25],
				owner: 'p1',
				body: [MOVE],
			});
			// If the adapter silently serializes game objects, this would
			// return {} instead of throwing. The spec requires a throw.
			let threw = false;
			try {
				await shard.runPlayer('p1', code`Game.getObjectById(${id})`);
			} catch (err) {
				if (err instanceof RunPlayerError && err.errorKind === 'serialization') {
					threw = true;
				} else {
					throw err;
				}
			}
			expect(threw).toBe(true);
		});
	});
});
