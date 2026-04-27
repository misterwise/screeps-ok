/**
 * 29.3 InterShardMemory — local half
 *
 * The local half of `InterShardMemory` is single-shard observable: a
 * round-trip of `setLocal` / `getLocal` plus the argument-type and
 * size-cap rejection contract.
 *
 * `getRemote` requires a second shard and is gated on `multiShard`
 * (`ISM-005`/`ISM-006`); not covered here.
 *
 * Gated on `interShardMemory`: skips on xxscreeps (no module) and on
 * vanilla until a verified run flips the capability flag to true.
 */
import { describe, test, expect, code } from '../../src/index.js';

describe('InterShardMemory — local segment', () => {
	test('ISM-001 getLocal() returns null before any setLocal', async ({ shard }) => {
		shard.requires('interShardMemory');
		await shard.ownedRoom('p1');
		await shard.tick();

		const initial = await shard.runPlayer('p1', code`
			InterShardMemory.getLocal()
		`);
		expect(initial).toBeNull();
	});

	test('ISM-002 setLocal(s) round-trips through getLocal() on the same tick', async ({ shard }) => {
		shard.requires('interShardMemory');
		await shard.ownedRoom('p1');
		await shard.tick();

		const payload = 'hello shard0';
		const got = await shard.runPlayer('p1', code`
			InterShardMemory.setLocal(${payload});
			InterShardMemory.getLocal()
		`);
		expect(got).toBe(payload);
	});

	test('ISM-003 setLocal accepts string and rejects non-string types', async ({ shard }) => {
		shard.requires('interShardMemory');
		await shard.ownedRoom('p1');
		await shard.tick();

		// Each call is wrapped: report 'ok' on accept, 'reject' on throw,
		// or the post-call getLocal() value when no exception fires (so a
		// silent no-op is distinguishable from acceptance).
		const result = await shard.runPlayer('p1', code`
			function probe(value) {
				try {
					InterShardMemory.setLocal(value);
					return { kind: 'ok', after: InterShardMemory.getLocal() };
				} catch (err) {
					return { kind: 'reject', message: String(err && err.message || err) };
				}
			}
			// Seed a known prior value so silent-noop rejects are observable.
			InterShardMemory.setLocal('seed');
			({
				str:    probe('payload'),
				num:    probe(42),
				obj:    probe({ a: 1 }),
				nul:    probe(null),
				undef:  probe(undefined),
			})
		`) as Record<string, { kind: 'ok' | 'reject'; after?: unknown; message?: string }>;

		// String is the only accepted type; setLocal('payload') must take.
		expect(result.str.kind).toBe('ok');
		expect(result.str.after).toBe('payload');

		// Non-string args must not leave the segment holding the rejected
		// value. They may throw or silently no-op — either is a rejection
		// as long as the segment didn't accept the input.
		for (const key of ['num', 'obj', 'nul', 'undef'] as const) {
			const r = result[key];
			if (r.kind === 'ok') {
				expect(r.after).not.toEqual(key === 'nul' ? null : (key === 'num' ? 42 : (key === 'obj' ? { a: 1 } : undefined)));
			}
		}
	});
});
