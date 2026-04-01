import { describe, test, expect, code } from '../../src/index.js';

describe('creep.pull()', () => {
	test('pulls adjacent creep when puller moves away', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const pullerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: ['move', 'move'],
			name: 'puller',
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: ['work', 'work', 'work'], // no MOVE — can't move alone
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
		`) as any;
		expect(rc.pull).toBe(0);
		expect(rc.move).toBe(0);

		await shard.tick();

		const puller = await shard.getObject(pullerId);
		const target = await shard.getObject(targetId);
		if (puller?.kind === 'creep' && target?.kind === 'creep') {
			expect(puller.pos.y).toBe(24); // puller moved TOP
			expect(target.pos.y).toBe(25); // heavy moved to puller's old position
		}
	});

	test('returns ERR_NOT_IN_RANGE when not adjacent', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const pullerId = await shard.placeCreep('W1N1', {
			pos: [10, 10], owner: 'p1',
			body: ['move'],
			name: 'puller',
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [20, 20], owner: 'p1',
			body: ['work'],
			name: 'heavy',
		});

		const rc = await shard.runPlayer('p1', code`
			Game.creeps['puller'].pull(Game.creeps['heavy'])
		`);
		expect(rc).toBe(-9);
	});
});
