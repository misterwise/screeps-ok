import { describe, test, expect, code, OK, ERR_NOT_IN_RANGE, MOVE, WORK } from '../../src/index.js';

describe('creep.pull()', () => {
	test('MOVE-PULL-001 pull() on an adjacent friendly creep returns OK', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [MOVE, MOVE],
			name: 'puller',
		});
		await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [WORK, WORK, WORK],
			name: 'heavy',
		});

		const rc = await shard.runPlayer('p1', code`
			Game.creeps['puller'].pull(Game.creeps['heavy'])
		`);
		expect(rc).toBe(OK);
	});

	test('MOVE-PULL-002 the pulled creep must call move() toward the puller in the same tick for the pull to complete', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const pullerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [MOVE, MOVE],
			name: 'puller',
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [WORK, WORK, WORK],
			name: 'heavy',
		});

		const rc = await shard.runPlayer('p1', code`
			const puller = Game.creeps['puller'];
			const heavy = Game.creeps['heavy'];
			({
				pull: puller.pull(heavy),
				move: puller.move(TOP),
			})
		`) as { pull: number; move: number };
		expect(rc.pull).toBe(OK);
		expect(rc.move).toBe(OK);

		await shard.tick();

		const puller = await shard.expectObject(pullerId, 'creep');
		const target = await shard.expectObject(targetId, 'creep');
		expect(puller.pos.y).toBe(24);
		expect(target.pos.y).toBe(26);
	});

	test("MOVE-PULL-003 when a pull completes, the pulled creep moves into the puller's previous tile", async ({ shard }) => {
		await shard.ownedRoom('p1');
		const pullerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [MOVE, MOVE],
			name: 'puller',
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [WORK, WORK, WORK],
			name: 'heavy',
		});

		const rc = await shard.runPlayer('p1', code`
			const puller = Game.creeps['puller'];
			const heavy = Game.creeps['heavy'];
			({
				pull: puller.pull(heavy),
				move: puller.move(TOP),
				targetMove: heavy.move(puller),
			})
		`) as { pull: number; move: number; targetMove: number };
		expect(rc.pull).toBe(OK);
		expect(rc.move).toBe(OK);

		await shard.tick();

		const puller = await shard.expectObject(pullerId, 'creep');
		const target = await shard.expectObject(targetId, 'creep');
		expect(puller.pos.y).toBe(24);
		expect(target.pos.y).toBe(25);
	});

	test('MOVE-PULL-004 pull() returns ERR_NOT_IN_RANGE when the target is not adjacent', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const pullerId = await shard.placeCreep('W1N1', {
			pos: [10, 10], owner: 'p1',
			body: [MOVE],
			name: 'puller',
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [20, 20], owner: 'p1',
			body: [WORK],
			name: 'heavy',
		});

		const rc = await shard.runPlayer('p1', code`
			Game.creeps['puller'].pull(Game.creeps['heavy'])
		`);
		expect(rc).toBe(ERR_NOT_IN_RANGE);
	});
});
