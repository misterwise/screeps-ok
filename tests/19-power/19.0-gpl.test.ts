import { describe, test, expect, code,
	OK, ERR_NOT_ENOUGH_RESOURCES,
	POWER_LEVEL_MULTIPLY, POWER_LEVEL_POW,
} from '../../src/index.js';

type GplSnapshot = {
	level: number;
	progress: number;
	progressTotal: number;
};

function expectedGpl(power: number): GplSnapshot {
	const level = Math.floor((power / POWER_LEVEL_MULTIPLY) ** (1 / POWER_LEVEL_POW));
	const baseProgress = level ** POWER_LEVEL_POW * POWER_LEVEL_MULTIPLY;
	return {
		level,
		progress: power - baseProgress,
		progressTotal: (level + 1) ** POWER_LEVEL_POW * POWER_LEVEL_MULTIPLY - baseProgress,
	};
}

const readGpl = code`
	({
		level: Game.gpl.level,
		progress: Game.gpl.progress,
		progressTotal: Game.gpl.progressTotal,
	})
`;

describe('Game.gpl', () => {
	test('GPL-001 Game.gpl starts at level 0 with 1000 progressTotal when account power is 0', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.createShard({
			players: [{ name: 'p1', power: 0 }],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});
		await shard.tick();

		const gpl = await shard.runPlayer('p1', readGpl) as GplSnapshot;
		expect(gpl).toEqual({ level: 0, progress: 0, progressTotal: POWER_LEVEL_MULTIPLY });
	});

	for (const [caseId, power] of [
		['a', 999],
		['b', 1000],
		['c', 3999],
		['d', 4000],
		['e', 9000],
	] as const) {
		test(`GPL-002${caseId} Game.gpl follows vanilla account-power math at ${power} power`, async ({ shard }) => {
			shard.requires('powerCreeps');
			await shard.createShard({
				players: [{ name: 'p1', power }],
				rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
			});
			await shard.tick();

			const gpl = await shard.runPlayer('p1', readGpl) as GplSnapshot;
			expect(gpl).toEqual(expectedGpl(power));
		});
	}

	test('GPL-003 PowerCreep.create returns ERR_NOT_ENOUGH_RESOURCES at GPL level 0', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.createShard({
			players: [{ name: 'p1', power: 0 }],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			PowerCreep.create('NoLevels', POWER_CLASS.OPERATOR)
		`);
		expect(rc).toBe(ERR_NOT_ENOUGH_RESOURCES);
	});

	test('GPL-004 one GPL level allows one allocated power creep level', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.createShard({
			players: [{ name: 'p1', power: POWER_LEVEL_MULTIPLY }],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});
		await shard.tick();

		const firstRc = await shard.runPlayer('p1', code`
			PowerCreep.create('OnlyOne', POWER_CLASS.OPERATOR)
		`);
		expect(firstRc).toBe(OK);

		const secondRc = await shard.runPlayer('p1', code`
			PowerCreep.create('Second', POWER_CLASS.OPERATOR)
		`);
		expect(secondRc).toBe(ERR_NOT_ENOUGH_RESOURCES);
	});

	test('GPL-005 creating and upgrading power creeps does not change Game.gpl', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.createShard({
			players: [{ name: 'p1', power: 4 * POWER_LEVEL_MULTIPLY }],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});
		await shard.tick();

		const before = await shard.runPlayer('p1', readGpl) as GplSnapshot;

		const createRc = await shard.runPlayer('p1', code`
			PowerCreep.create('Allocator', POWER_CLASS.OPERATOR)
		`);
		expect(createRc).toBe(OK);

		const afterCreate = await shard.runPlayer('p1', readGpl) as GplSnapshot;
		expect(afterCreate).toEqual(before);

		const upgradeRc = await shard.runPlayer('p1', code`
			Game.powerCreeps['Allocator'].upgrade(PWR_GENERATE_OPS)
		`);
		expect(upgradeRc).toBe(OK);

		const afterUpgrade = await shard.runPlayer('p1', code`
			const pc = Game.powerCreeps['Allocator'];
			({
				gpl: {
					level: Game.gpl.level,
					progress: Game.gpl.progress,
					progressTotal: Game.gpl.progressTotal,
				},
				powerCreepLevel: pc.level,
			})
		`) as { gpl: GplSnapshot; powerCreepLevel: number };
		expect(afterUpgrade.gpl).toEqual(before);
		expect(afterUpgrade.powerCreepLevel).toBe(1);
	});
});
