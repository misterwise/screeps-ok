import { describe, test, expect, code,
	OK, MOVE, BOTTOM,
	PWR_OPERATE_SPAWN,
	STRUCTURE_SPAWN,
} from '../../src/index.js';

describe('Spawn power effects', () => {
	test('SPAWN-TIMING-005 custom directions are ignored for a 1-tick spawn under PWR_OPERATE_SPAWN', async ({ shard }) => {
		shard.requires('powerCreeps');
		shard.requires('powerEffects');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1', powerEnabled: true }],
		});

		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		// Level 5 scales a one-part creep's CREEP_SPAWN_TIME of 3 down to a single tick.
		await shard.placePowerCreep('W1N1', {
			pos: [22, 25], owner: 'p1',
			powers: { [PWR_OPERATE_SPAWN]: 5 },
			store: { ops: 200 },
		});
		await shard.tick();

		const useRc = await shard.runPlayer('p1', code`
			Object.values(Game.powerCreeps)[0].usePower(PWR_OPERATE_SPAWN, Game.getObjectById(${spawnId}))
		`);
		expect(useRc).toBe(OK);

		const spawnRc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep([MOVE], 'Quick', { directions: [${BOTTOM}] })
		`);
		expect(spawnRc).toBe(OK);
		await shard.tick(2);

		// BOTTOM was free; the creep leaves by the default order, TOP first.
		const pos = await shard.runPlayer('p1', code`
			const creep = Game.creeps['Quick'];
			creep && !creep.spawning ? [creep.pos.x, creep.pos.y] : null
		`);
		expect(pos).toEqual([25, 24]);
	});
});
