import { describe, test, expect, code, MOVE } from '../../src/index.js';
import { RunPlayerError } from '../../src/errors.js';

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
