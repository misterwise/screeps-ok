import { describe, test, expect, code,
	OK, MOVE,
} from '../../src/index.js';

// "Power creeps lose movement ties" is a universal claim, so the row asserts it
// over PAIRS independent ties rather than one. An engine that ranks power creeps
// alongside creeps and then breaks the tie randomly would pass a single trial
// half the time; across 16 it effectively never does.
const PAIRS = 16;

describe('Power creep movement collision', () => {
	test('MOVE-POWER-001 a power creep loses a movement collision tie to a regular creep', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});

		// One tie per column: a regular creep at y=26 moving TOP and a power creep
		// at y=24 moving BOTTOM both target the empty tile at y=25, at equal range.
		// On a tie the regular creep must take the tile and the power creep must
		// stay put.
		const columns = Array.from({ length: PAIRS }, (_, i) => 2 + i * 3);
		const creepIds: string[] = [];
		for (const x of columns) {
			creepIds.push(await shard.placeCreep('W1N1', {
				pos: [x, 26], owner: 'p1', body: [MOVE], name: `regular-${x}`,
			}));
			await shard.placePowerCreep('W1N1', {
				pos: [x, 24], owner: 'p1', name: `pc-${x}`, powers: {}, store: { ops: 10 },
			});
		}
		await shard.tick();

		const rcs = await shard.runPlayer('p1', code`
			${columns}.map(x => [
				Game.creeps['regular-' + x].move(TOP),
				Game.powerCreeps['pc-' + x].move(BOTTOM),
			])
		`) as Array<[number, number]>;
		for (const [regRc, pcRc] of rcs) {
			expect(regRc).toBe(OK);
			expect(pcRc).toBe(OK);
		}

		// Every regular creep wins its tile.
		for (const [index, x] of columns.entries()) {
			const regular = await shard.expectObject(creepIds[index], 'creep');
			expect({ x: regular.pos.x, y: regular.pos.y }).toEqual({ x, y: 25 });
		}

		// Every power creep is still on its starting tile.
		const pcPositions = await shard.runPlayer('p1', code`
			${columns}.map(x => {
				const pc = Game.powerCreeps['pc-' + x];
				return pc ? { x: pc.pos.x, y: pc.pos.y } : null;
			})
		`) as Array<{ x: number; y: number } | null>;
		expect(pcPositions).toEqual(columns.map(x => ({ x, y: 24 })));
	});
});
