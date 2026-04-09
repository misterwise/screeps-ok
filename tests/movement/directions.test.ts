import { describe, test, expect, code, MOVE, WORK, OK, ERR_NO_BODYPART } from '../../src/index.js';
import { moveDirectionCases } from '../support/matrices/move-directions.js';
import { requireCapability } from '../support/policy.js';

describe('creep.move()', () => {
	for (const { label, direction, dx, dy } of moveDirectionCases) {
		test(`MOVE-BASIC-001 [${label}] move(direction) moves one tile toward the direction constant`, async ({ shard }) => {
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
			expect(c.pos.x).toBe(25 + dx);
			expect(c.pos.y).toBe(25 + dy);
		});
	}

	test('MOVE-BASIC-002 move() into a wall tile returns OK but the creep does not move', async ({ shard, skip }) => {
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

	test('MOVE-BASIC-004 move() returns ERR_NO_BODYPART when the creep has no active MOVE parts', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [WORK],
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${id}).move(TOP)
		`);
		expect(rc).toBe(ERR_NO_BODYPART);

		await shard.tick();
		const c = await shard.expectObject(id, 'creep');
		expect(c.pos.x).toBe(25);
		expect(c.pos.y).toBe(25);
	});
});
