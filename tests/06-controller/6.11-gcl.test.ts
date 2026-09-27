import { describe, test, expect, code,
	GCL_MULTIPLY, GCL_POW, gclPoints,
} from '../../src/index.js';

type GclSnapshot = {
	level: number;
	progress: number;
	progressTotal: number;
};

// game/game.js:130-131,158-162, in its operation order so the doubles match.
function expectedGcl(points: number): GclSnapshot {
	const level = Math.floor((points / GCL_MULTIPLY) ** (1 / GCL_POW)) + 1;
	const base = (level - 1) ** GCL_POW * GCL_MULTIPLY;
	return { level, progress: points - base, progressTotal: level ** GCL_POW * GCL_MULTIPLY - base };
}

describe('Game.gcl', () => {
	for (const [row, gcl] of [
		['belowLevelTwo', { level: 1, progress: GCL_MULTIPLY - 1 }],
		['levelTwo', { level: 2, progress: 0 }],
		['levelThree', { level: 3, progress: 0 }],
	] as const) {
		test(`GCL-001:${row} Game.gcl follows vanilla GCL math at level ${gcl.level}, progress ${gcl.progress}`, async ({ shard }) => {
			await shard.createShard({
				players: [{ name: 'p1', gcl }],
				rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
			});
			await shard.tick();

			const read = await shard.runPlayer('p1', code`
				({ level: Game.gcl.level, progress: Game.gcl.progress, progressTotal: Game.gcl.progressTotal })
			`) as GclSnapshot;
			expect(read).toEqual(expectedGcl(gclPoints(gcl)));
		});
	}
});
