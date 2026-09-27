/**
 * 29.6 PowerCreep Shard Home — single-shard observable
 *
 * A power creep's `shard` before it spawns, after it dies, and while it
 * lives, observable on one shard.
 *
 * `SHARD-PCREEP-001:neverSpawned` is gated on `powerCreepAccountApi`:
 * reaching that state needs `PowerCreep.create`, which xxscreeps exposes
 * only through its backend.
 */
import { describe, test, expect, code, OK } from '../../src/index.js';

describe('PowerCreep shard home', () => {
	test('SHARD-PCREEP-001:neverSpawned a PowerCreep never spawned exposes pc.shard === undefined', async ({ shard }) => {
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
			({ spawned: pc.room !== undefined, shardUndefined: pc.shard === undefined })
		`);
		expect(probe).toEqual({ spawned: false, shardUndefined: true });
	});

	test('SHARD-PCREEP-001:afterDeath a PowerCreep that died exposes pc.shard === undefined', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.ownedRoom('p1', 'W1N1', 8);
		await shard.placePowerCreep('W1N1', { pos: [25, 25], owner: 'p1', name: 'Fallen', powers: {} });
		await shard.tick();

		expect(await shard.runPlayer('p1', code`Game.powerCreeps.Fallen.suicide()`)).toBe(OK);
		const probe = await shard.runPlayer('p1', code`
			const pc = Game.powerCreeps.Fallen;
			({ spawned: pc.room !== undefined, shardUndefined: pc.shard === undefined })
		`);
		expect(probe).toEqual({ spawned: false, shardUndefined: true });
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
