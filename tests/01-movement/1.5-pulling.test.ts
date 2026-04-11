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

	test('MOVE-PULL-005 the puller accumulates fatigue for both itself and the pulled creep', async ({ shard }) => {
		await shard.ownedRoom('p1');
		// Puller has only MOVE parts (zero own weight), so any post-move fatigue
		// must come from the pulled creep's weight being added to the puller.
		const pullerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [MOVE], name: 'puller',
		});
		// Pulled has 2 weighted parts (2 WORK) and NO MOVE parts. Pulled MOVE
		// parts would otherwise also reduce the puller's fatigue (vanilla
		// _add-fatigue tunnels reductions up the pull chain).
		const pulledId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [WORK, WORK], name: 'pulled',
		});
		await shard.tick();

		// Pull + same-tick coordinated move so the pull resolves.
		await shard.runPlayer('p1', code`
			const puller = Game.creeps['puller'];
			const pulled = Game.creeps['pulled'];
			puller.pull(pulled);
			puller.move(TOP);
			pulled.move(puller);
		`);

		const puller = await shard.expectObject(pullerId, 'creep');
		const pulled = await shard.expectObject(pulledId, 'creep');
		// Both creeps moved one tile north.
		expect(puller.pos.y).toBe(24);
		expect(pulled.pos.y).toBe(25);
		// Puller takes the combined fatigue. Pulled (2 weighted parts) +
		// puller (0 weighted parts) = 2 weighted parts → 4 plain fatigue.
		// Puller has 1 MOVE → reduces by 2 → residual 2 on the puller.
		expect(puller.fatigue).toBe(2);
		// The pulled creep does not accumulate its own move fatigue.
		expect(pulled.fatigue).toBe(0);
	});

	test('MOVE-PULL-006 pull can chain through multiple creeps in a train', async ({ shard }) => {
		await shard.ownedRoom('p1');
		// Three creeps in a vertical train: A (head) at [25,23], B at [25,24],
		// C (tail) at [25,25]. A pulls B, B pulls C, A moves TOP, B moves toward
		// A, C moves toward B. After the tick all three should have shifted
		// one tile north.
		const aId = await shard.placeCreep('W1N1', {
			pos: [25, 23], owner: 'p1',
			body: [MOVE, MOVE, MOVE], name: 'a',
		});
		const bId = await shard.placeCreep('W1N1', {
			pos: [25, 24], owner: 'p1',
			body: [MOVE, MOVE], name: 'b',
		});
		const cId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [MOVE, MOVE], name: 'c',
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			const a = Game.creeps['a'];
			const b = Game.creeps['b'];
			const c = Game.creeps['c'];
			a.pull(b);
			b.pull(c);
			a.move(TOP);
			b.move(a);
			c.move(b);
		`);

		const a = await shard.expectObject(aId, 'creep');
		const b = await shard.expectObject(bId, 'creep');
		const c = await shard.expectObject(cId, 'creep');
		expect(a.pos.x).toBe(25); expect(a.pos.y).toBe(22);
		expect(b.pos.x).toBe(25); expect(b.pos.y).toBe(23);
		expect(c.pos.x).toBe(25); expect(c.pos.y).toBe(24);
	});
});
