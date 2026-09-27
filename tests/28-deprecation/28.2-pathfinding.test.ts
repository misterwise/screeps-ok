import { describe, test, expect, code, STRUCTURE_WALL } from '../../src/index.js';
import type { ShardFixture } from '../../src/fixture.js';

// PathFinder / findPath deprecations are routed through the new-pathfinder
// path (the default). Each assertion checks: (1) the canonical message text
// (API/option name + recommended replacement), (2) the call's result is the
// one it gives without the option. `PathFinder.use(true)` MUST NOT emit the notice.

describe('PathFinder.use deprecation notice', () => {
	test('DEPRECATED-PATH-001 PathFinder.use(false) emits a notice; PathFinder.use(true) is silent', async ({ shard }) => {
		shard.requires('deprecationNotices');
		await shard.ownedRoom('p1');
		const notices = async () => (await shard.captureConsoleLogs('p1')).filter(line => line.includes('PathFinder.use')).length;

		await shard.runPlayer('p1', code`PathFinder.use(true); null`);
		expect(await notices()).toBe(0);
		await shard.runPlayer('p1', code`PathFinder.use(false); null`);
		expect(await notices()).toBe(1);
	});
});

// From (10,10): the diagonal to (20,20) crosses (15,15); a nearer target sits at (12,12).
const FROM = [10, 10];
const NEAR = [12, 12];
const neighbours = (x: number, y: number) =>
	[-1, 0, 1].flatMap(dx => [-1, 0, 1].filter(dy => dx || dy).map(dy => ({ x: x + dx, y: y + dy })));

// Each API with the option in its own tick; the result is the one the call gives without the option.
async function deprecatedOption(shard: ShardFixture, option: 'avoid' | 'ignore', api: string, positions: Array<{ x: number; y: number }>) {
	const result = await shard.runPlayer('p1', code`
		const room = Game.rooms.W1N1;
		const from = new RoomPosition(${FROM[0]}, ${FROM[1]}, 'W1N1');
		const to = new RoomPosition(20, 20, 'W1N1');
		const opts = { [${option}]: ${positions} };
		const calls = {
			findPath: () => room.findPath(from, to, opts).length,
			findPathTo: () => from.findPathTo(to, opts).length,
			findClosestByPath: () => {
				const found = from.findClosestByPath([new RoomPosition(${NEAR[0]}, ${NEAR[1]}, 'W1N1'), to], opts);
				return found && [found.x, found.y];
			},
		};
		calls[${api}]()
	`);
	const logs = await shard.captureConsoleLogs('p1');
	return { result, notices: logs.filter(line => line.includes(option) && line.includes('costCallback') && line.includes('PathFinder.use')).length };
}

describe('findPath / findClosestByPath opts.avoid deprecation', () => {
	// Honoured, avoid would lengthen the diagonal to 11 steps and fence off the nearer target.
	const avoidCases = [
		{ api: 'findPath', avoid: [{ x: 15, y: 15 }], result: 10 },
		{ api: 'findPathTo', avoid: [{ x: 15, y: 15 }], result: 10 },
		{ api: 'findClosestByPath', avoid: neighbours(NEAR[0], NEAR[1]), result: NEAR },
	];
	for (const row of avoidCases) {
		test(`DEPRECATED-PATH-002:${row.api} avoid emits a notice recommending costCallback and changes nothing`, async ({ shard }) => {
			shard.requires('deprecationNotices');
			await shard.ownedRoom('p1');
			expect(await deprecatedOption(shard, 'avoid', row.api, row.avoid)).toEqual({ result: row.result, notices: 1 });
		});
	}
});

describe('findPath / findClosestByPath opts.ignore deprecation', () => {
	// Walls ignore would let the path through: one on the diagonal, and a ring around the nearer target.
	const ignoreCases = [
		{ api: 'findPath', walls: [{ x: 15, y: 15 }], result: 11 },
		{ api: 'findPathTo', walls: [{ x: 15, y: 15 }], result: 11 },
		{ api: 'findClosestByPath', walls: neighbours(NEAR[0], NEAR[1]), result: [20, 20] },
	];
	for (const row of ignoreCases) {
		test(`DEPRECATED-PATH-003:${row.api} ignore emits a notice recommending costCallback and changes nothing`, async ({ shard }) => {
			shard.requires('deprecationNotices');
			await shard.ownedRoom('p1');
			for (const { x, y } of row.walls) {
				await shard.placeStructure('W1N1', { pos: [x, y], structureType: STRUCTURE_WALL });
			}
			expect(await deprecatedOption(shard, 'ignore', row.api, row.walls)).toEqual({ result: row.result, notices: 1 });
		});
	}
});
