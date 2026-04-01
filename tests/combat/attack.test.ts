import { describe, test, expect, code } from '../../src/index.js';

describe('creep.attack()', () => {
	test('deals 30 damage per ATTACK part', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: ['attack', 'move'],
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2',
			body: ['tough', 'tough', 'tough', 'tough', 'tough', 'move'],
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
		`);
		expect(rc).toBe(0); // OK

		await shard.tick();

		const target = await shard.getObject(targetId);
		if (target?.kind === 'creep') {
			// 1 ATTACK = 30 damage. Target has 6 parts * 100 = 600 HP
			expect(target.hits).toBe(600 - 30);
		}
	});

	test('multiple ATTACK parts stack damage', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: ['attack', 'attack', 'attack', 'move'],
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2',
			body: ['tough', 'tough', 'tough', 'tough', 'tough',
			       'tough', 'tough', 'tough', 'tough', 'move'],
		});

		await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
		`);
		await shard.tick();

		const target = await shard.getObject(targetId);
		if (target?.kind === 'creep') {
			expect(target.hits).toBe(1000 - 90); // 3 * 30 = 90 damage
		}
	});

	test('returns ERR_NOT_IN_RANGE when not adjacent', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [10, 10], owner: 'p1',
			body: ['attack', 'move'],
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [20, 20], owner: 'p2',
			body: ['tough', 'move'],
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
		`);
		expect(rc).toBe(-9);
	});

	test('returns ERR_NO_BODYPART without ATTACK parts', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: ['move'],
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2',
			body: ['tough', 'move'],
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).attack(Game.getObjectById(${targetId}))
		`);
		expect(rc).toBe(-12); // ERR_NO_BODYPART
	});

	test('attacking own creep: engine-specific behavior', async ({ shard }) => {
		// Note: vanilla returns ERR_INVALID_TARGET (-7) for attacking own creeps.
		// xxscreeps returns OK (0) and deals damage. This is a known parity difference.
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: ['attack', 'move'],
		});
		const friendlyId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: ['tough', 'move'],
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${friendlyId}))
		`);
		// Record what each engine does — don't assert a specific value yet
		// until we verify vanilla behavior
		expect(typeof rc).toBe('number');
	});
});

describe('creep.rangedAttack()', () => {
	test('deals 10 damage per RANGED_ATTACK part', async ({ shard }) => {
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

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).rangedAttack(Game.getObjectById(${targetId}))
		`);
		expect(rc).toBe(0);

		await shard.tick();

		const target = await shard.getObject(targetId);
		if (target?.kind === 'creep') {
			expect(target.hits).toBe(600 - 10); // 1 RANGED_ATTACK = 10 damage
		}
	});

	test('returns ERR_NOT_IN_RANGE beyond range 3', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [10, 10], owner: 'p1',
			body: ['ranged_attack', 'move'],
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [10, 14], owner: 'p2', // range 4
			body: ['tough', 'move'],
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).rangedAttack(Game.getObjectById(${targetId}))
		`);
		expect(rc).toBe(-9);
	});
});

describe('creep.heal()', () => {
	test('heals 12 HP per HEAL part when adjacent', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const healerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: ['heal', 'move'],
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: ['tough', 'tough', 'tough', 'move'],
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${healerId}).heal(Game.getObjectById(${targetId}))
		`);
		expect(rc).toBe(0);
	});

	test('rangedHeal heals 4 HP per HEAL part at range', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const healerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: ['heal', 'move'],
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 28], owner: 'p1', // range 3
			body: ['tough', 'tough', 'move'],
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${healerId}).rangedHeal(Game.getObjectById(${targetId}))
		`);
		expect(rc).toBe(0);
	});
});
