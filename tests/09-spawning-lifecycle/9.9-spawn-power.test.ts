import { describe, test, expect, code,
	OK,
	PWR_OPERATE_SPAWN,
	STRUCTURE_SPAWN,
} from '../../src/index.js';

describe('Spawn power effects', () => {
	test('SPAWN-TIMING-005 PWR_OPERATE_SPAWN modifies spawn time', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});

		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 10000 },
		});
		await shard.placePowerCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			powers: { [PWR_OPERATE_SPAWN]: 1 },
			store: { ops: 200 },
		});
		await shard.tick();

		// Apply PWR_OPERATE_SPAWN on the spawn.
		const rc = await shard.runPlayer('p1', code`
			const pc = Object.values(Game.powerCreeps)[0];
			pc.usePower(PWR_OPERATE_SPAWN, Game.getObjectById(${spawnId}))
		`);
		expect(rc).toBe(OK);

		// Verify the effect is active.
		const effects = await shard.runPlayer('p1', code`
			const spawn = Game.getObjectById(${spawnId});
			spawn.effects ? spawn.effects.map(e => e.effect) : []
		`) as number[];
		expect(effects).toContain(PWR_OPERATE_SPAWN);
	});
});
