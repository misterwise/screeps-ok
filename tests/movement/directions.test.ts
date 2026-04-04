import {
	describe, test, expect, code,
	MOVE, OK,
	TOP, TOP_RIGHT, RIGHT, BOTTOM, LEFT,
} from '../../src/index.js';
import { requireCapability } from '../support/policy.js';

describe('movement: directions', () => {
	const cases = [
		{ label: 'TOP', direction: TOP, expected: { x: 25, y: 24 } },
		{ label: 'BOTTOM', direction: BOTTOM, expected: { x: 25, y: 26 } },
		{ label: 'LEFT', direction: LEFT, expected: { x: 24, y: 25 } },
		{ label: 'RIGHT', direction: RIGHT, expected: { x: 26, y: 25 } },
		{ label: 'TOP_RIGHT', direction: TOP_RIGHT, expected: { x: 26, y: 24 } },
	] as const;

	for (const { label, direction, expected } of cases) {
		test(`move(${label}) returns OK and moves to the expected adjacent tile`, async ({ shard }) => {
			await shard.ownedRoom('p1');
			const id = await shard.placeCreep('W1N1', {
				pos: [25, 25], owner: 'p1', body: [MOVE],
			});

			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${id}).move(${direction})
			`);
			expect(rc).toBe(OK);

			await shard.tick();
			const c = await shard.expectObject(id, 'creep');
			expect(c.pos.x).toBe(expected.x);
			expect(c.pos.y).toBe(expected.y);
		});
	}

	test('move into wall returns OK but the creep does not move', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'terrain', 'custom terrain setup is required for wall-movement assertions');
		const terrain = new Array(2500).fill(0);
		terrain[24 * 50 + 25] = 1;
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1', terrain }],
		});
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE],
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${id}).move(TOP)
		`);
		expect(rc).toBe(OK);

		await shard.tick();
		const c = await shard.expectObject(id, 'creep');
		expect(c.pos.x).toBe(25);
		expect(c.pos.y).toBe(25);
	});
});
