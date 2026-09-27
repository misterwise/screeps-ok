/**
 * 29.6 PowerCreep Shard Home — single-shard observable
 *
 * A power creep's `shard` before and after it spawns, observable on one
 * shard.
 *
 * `SHARD-PCREEP-001` is gated on `powerCreepAccountApi`: reaching the
 * unspawned state needs `PowerCreep.create`, which xxscreeps exposes only
 * through its backend.
 */
import { describe, test, expect, code, OK } from '../../src/index.js';

describe('PowerCreep shard home', () => {
	test('SHARD-PCREEP-001 unspawned PowerCreep exposes pc.shard === undefined', async ({ shard }) => {
		shard.requires('powerCreeps');
		shard.requires('powerCreepAccountApi');
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

	test('SHARD-PCREEP-002 a spawned PowerCreep reports Game.shard.name as its shard', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.ownedRoom('p1', 'W1N1', 8);
		const pcId = await shard.placePowerCreep('W1N1', { pos: [25, 25], owner: 'p1', powers: {} });
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			({ shard: String(Game.getObjectById(${pcId}).shard), name: Game.shard.name })
		`) as { shard: string; name: string };
		expect(result.shard).toBe(result.name);
	});
});
