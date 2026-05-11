import { describe, test, expect, code,
	OK, WORK, CARRY, MOVE, STRUCTURE_SPAWN,
} from '../../src/index.js';

describe('StructureSpawn.renewCreep deprecation notice', () => {
	test('DEPRECATED-SPAWN-001 renewCreep on a boosted creep emits a notice recommending unboostCreep', async ({ shard }) => {
		shard.requires('deprecationNotices');
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [WORK, CARRY, MOVE],
			ticksToLive: 100,
			boosts: { 0: 'UH' },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).renewCreep(Game.getObjectById(${creepId}))
		`);
		expect(rc).toBe(OK);

		const logs = await shard.captureConsoleLogs('p1');
		const matches = logs.filter(line =>
			line.includes('StructureSpawn.renewCreep')
			&& line.includes('boosted')
			&& line.includes('StructureLab.unboostCreep'),
		);
		expect(matches).toHaveLength(1);
	});
});
