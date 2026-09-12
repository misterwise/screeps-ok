import { describe, test, expect, code,
	OK, MOVE, WORK,
} from '../../src/index.js';

// The catalog claim is unqualified — "a regular creep" — so the row exercises both
// halves of a movement-priority scale: an unladen creep and a laden one must each
// win its tile. An engine that ranks power creeps between the two passes one half
// and fails the other.
const BODIES = [[MOVE], [WORK, MOVE]];
// "Power creeps lose movement ties" is a universal claim, so each body runs the tie
// PAIRS_PER_BODY times over independent tiles rather than once. An engine that ranks
// power creeps alongside creeps and then breaks the tie randomly would pass a single
// trial half the time.
const PAIRS_PER_BODY = 12;

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
		const columns = BODIES.flatMap((body, bodyIndex) =>
			Array.from({ length: PAIRS_PER_BODY }, (_, i) => ({
				body,
				x: 2 + (bodyIndex * PAIRS_PER_BODY + i) * 2,
			})));
		const creepIds: string[] = [];
		for (const { body, x } of columns) {
			creepIds.push(await shard.placeCreep('W1N1', {
				pos: [x, 26], owner: 'p1', body, name: `regular-${x}`,
			}));
			await shard.placePowerCreep('W1N1', {
				pos: [x, 24], owner: 'p1', name: `pc-${x}`, powers: {}, store: { ops: 10 },
			});
		}
		await shard.tick();

		const xs = columns.map(column => column.x);
		const rcs = await shard.runPlayer('p1', code`
			${xs}.map(x => [
				Game.creeps['regular-' + x].move(TOP),
				Game.powerCreeps['pc-' + x].move(BOTTOM),
			])
		`) as Array<[number, number]>;
		for (const [regRc, pcRc] of rcs) {
			expect(regRc).toBe(OK);
			expect(pcRc).toBe(OK);
		}

		// Every regular creep wins its tile.
		for (const [index, { x }] of columns.entries()) {
			const regular = await shard.expectObject(creepIds[index], 'creep');
			expect({ x: regular.pos.x, y: regular.pos.y }).toEqual({ x, y: 25 });
		}

		// Every power creep is still on its starting tile.
		const pcPositions = await shard.runPlayer('p1', code`
			${xs}.map(x => {
				const pc = Game.powerCreeps['pc-' + x];
				return pc ? { x: pc.pos.x, y: pc.pos.y } : null;
			})
		`) as Array<{ x: number; y: number } | null>;
		expect(pcPositions).toEqual(xs.map(x => ({ x, y: 24 })));
	});
});
