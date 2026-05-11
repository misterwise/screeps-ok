/**
 * 29.6 PowerCreep Shard Home — single-shard observable
 *
 * `SHARD-PCREEP-001` asserts the `shard` field on an unspawned PowerCreep
 * before it lands at a power spawn. Vanilla single-shard semantics for
 * this read are observable without a multi-shard harness.
 *
 * The sibling `SHARD-PCREEP-002` (spawned PowerCreep tracking its shard
 * name and updating after portal traversal) is gated on `multiShard` and
 * not covered here.
 *
 * Gated on `powerCreeps`: skips on xxscreeps (no PowerCreep class).
 */
import { describe, test, expect, code, OK } from '../../src/index.js';

describe('PowerCreep shard home', () => {
	test('SHARD-PCREEP-001 unspawned PowerCreep exposes pc.shard === undefined', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});
		await shard.tick();

		const createRc = await shard.runPlayer('p1', code`
			PowerCreep.create('UnspawnedShard', POWER_CLASS.OPERATOR)
		`);
		expect(createRc).toBe(OK);

		const probe = await shard.runPlayer('p1', code`
			const pc = Game.powerCreeps['UnspawnedShard'];
			pc ? ({ exists: true, typeofShard: typeof pc.shard }) : ({ exists: false })
		`) as { exists: boolean; typeofShard?: string };

		expect(probe.exists).toBe(true);
		expect(probe.typeofShard).toBe('undefined');
	});
});
