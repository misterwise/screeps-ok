import { describe, test, expect, code } from '../../src/index.js';

describe('creep.rangedMassAttack()', () => {
	test('deals 10 damage at range 1', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: ['ranged_attack', 'move'],
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2', // range 1
			body: ['tough', 'tough', 'tough', 'tough', 'tough', 'move'],
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).rangedMassAttack()
		`);
		expect(rc).toBe(0);
		await shard.tick();

		const target = await shard.getObject(targetId);
		if (target?.kind === 'creep') {
			expect(target.hits).toBe(600 - 10); // 10 damage at range 1
		}
	});

	test('deals 4 damage at range 2', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: ['ranged_attack', 'move'],
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 27], owner: 'p2', // range 2
			body: ['tough', 'tough', 'tough', 'tough', 'tough', 'move'],
		});

		await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).rangedMassAttack()
		`);
		await shard.tick();

		const target = await shard.getObject(targetId);
		if (target?.kind === 'creep') {
			expect(target.hits).toBe(600 - 4); // 4 damage at range 2
		}
	});

	test('deals 1 damage at range 3', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: ['ranged_attack', 'move'],
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 28], owner: 'p2', // range 3
			body: ['tough', 'tough', 'tough', 'tough', 'tough', 'move'],
		});

		await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).rangedMassAttack()
		`);
		await shard.tick();

		const target = await shard.getObject(targetId);
		if (target?.kind === 'creep') {
			expect(target.hits).toBe(600 - 1); // 1 damage at range 3
		}
	});

	test('hits multiple targets', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: ['ranged_attack', 'move'],
		});
		const t1 = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2', // range 1
			body: ['tough', 'tough', 'tough', 'move'],
		});
		const t2 = await shard.placeCreep('W1N1', {
			pos: [26, 25], owner: 'p2', // range 1
			body: ['tough', 'tough', 'tough', 'move'],
			name: 'target2',
		});

		await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).rangedMassAttack()
		`);
		await shard.tick();

		const target1 = await shard.getObject(t1);
		const target2 = await shard.getObject(t2);
		if (target1?.kind === 'creep') expect(target1.hits).toBe(400 - 10);
		if (target2?.kind === 'creep') expect(target2.hits).toBe(400 - 10);
	});
});
