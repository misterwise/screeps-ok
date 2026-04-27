/**
 * 29.1 Shard Identity
 *
 * Asserts the value semantics of `Game.shard.{name,type,ptr}` on the
 * player's tick. Property-surface (exact key set) is owned by
 * `SHAPE-GAME-004` in section 26.4 and tested in
 * `tests/26-object-shapes/26.0-discovery.test.ts`.
 */
import { describe, test, expect, code } from '../../src/index.js';

describe('Shard identity', () => {
	test('SHARD-IDENT-001 Game.shard.name is a non-empty string', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.tick();

		const name = await shard.runPlayer('p1', code`
			Game.shard && Game.shard.name
		`);
		expect(typeof name).toBe('string');
		expect((name as string).length).toBeGreaterThan(0);
	});

	test('SHARD-IDENT-002 Game.shard.type is one of {normal, ptr, season}', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.tick();

		const type = await shard.runPlayer('p1', code`
			Game.shard && Game.shard.type
		`);
		expect(['normal', 'ptr', 'season']).toContain(type);
	});

	test('SHARD-IDENT-003 Game.shard.ptr === (Game.shard.type === "ptr")', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			Game.shard
				? ({ ptr: Game.shard.ptr, type: Game.shard.type })
				: null
		`) as { ptr: unknown; type: unknown } | null;
		expect(result).not.toBeNull();
		expect(typeof result!.ptr).toBe('boolean');
		expect(result!.ptr).toBe(result!.type === 'ptr');
	});
});
