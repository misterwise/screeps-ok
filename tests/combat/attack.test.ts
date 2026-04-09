import { describe, test, expect, code, OK, ERR_NOT_IN_RANGE, ERR_NO_BODYPART, MOVE, ATTACK, TOUGH, RANGED_ATTACK, HEAL, body, ATTACK_POWER, RANGED_ATTACK_POWER, HEAL_POWER, RANGED_HEAL_POWER, BODYPART_HITS } from '../../src/index.js';

describe('creep.attack()', () => {
	test('COMBAT-MELEE-001 deals ATTACK_POWER damage per ATTACK part', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [ATTACK, MOVE],
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2',
			body: body(5, TOUGH, MOVE),
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
		`);
		expect(rc).toBe(OK);

		await shard.tick();

		const target = await shard.expectObject(targetId, 'creep');
		expect(target.hits).toBe(6 * BODYPART_HITS - ATTACK_POWER);
	});

	test('COMBAT-MELEE-001 multiple ATTACK parts stack damage', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: body(3, ATTACK, MOVE),
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2',
			body: body(9, TOUGH, MOVE),
		});

		await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
		`);
		await shard.tick();

		const target = await shard.expectObject(targetId, 'creep');
		expect(target.hits).toBe(10 * BODYPART_HITS - 3 * ATTACK_POWER);
	});

	test('COMBAT-MELEE-002 returns ERR_NOT_IN_RANGE when not adjacent', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [10, 10], owner: 'p1',
			body: [ATTACK, MOVE],
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [20, 20], owner: 'p2',
			body: [TOUGH, MOVE],
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
		`);
		expect(rc).toBe(ERR_NOT_IN_RANGE);
	});

	test('COMBAT-MELEE-003 returns ERR_NO_BODYPART without ATTACK parts', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [MOVE],
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2',
			body: [TOUGH, MOVE],
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).attack(Game.getObjectById(${targetId}))
		`);
		expect(rc).toBe(ERR_NO_BODYPART);
	});

});

describe('creep.rangedAttack()', () => {
	test('COMBAT-RANGED-001 deals RANGED_ATTACK_POWER damage per RANGED_ATTACK part', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [RANGED_ATTACK, MOVE],
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 28], owner: 'p2', // range 3
			body: body(5, TOUGH, MOVE),
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).rangedAttack(Game.getObjectById(${targetId}))
		`);
		expect(rc).toBe(OK);

		await shard.tick();

		const target = await shard.expectObject(targetId, 'creep');
		expect(target.hits).toBe(6 * BODYPART_HITS - RANGED_ATTACK_POWER);
	});

	test('COMBAT-RANGED-002 returns ERR_NOT_IN_RANGE beyond range 3', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [10, 10], owner: 'p1',
			body: [RANGED_ATTACK, MOVE],
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [10, 14], owner: 'p2', // range 4
			body: [TOUGH, MOVE],
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).rangedAttack(Game.getObjectById(${targetId}))
		`);
		expect(rc).toBe(ERR_NOT_IN_RANGE);
	});
});

describe('creep.heal()', () => {
	test('COMBAT-HEAL-001 heals HEAL_POWER HP per HEAL part when adjacent', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const healerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [HEAL, MOVE],
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: body(3, TOUGH, MOVE),
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 27], owner: 'p2',
			body: [ATTACK, MOVE],
		});

		await shard.tick();

		const attackRc = await shard.runPlayer('p2', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
		`);
		expect(attackRc).toBe(OK);
		await shard.tick();

		const injured = await shard.expectObject(targetId, 'creep');
		expect(injured.hits).toBe(4 * BODYPART_HITS - ATTACK_POWER);

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${healerId}).heal(Game.getObjectById(${targetId}))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const target = await shard.expectObject(targetId, 'creep');
		expect(target.hits).toBe(4 * BODYPART_HITS - ATTACK_POWER + HEAL_POWER);
	});

	test('COMBAT-RANGEDHEAL-001 rangedHeal heals RANGED_HEAL_POWER HP per HEAL part at range', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const healerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [HEAL, MOVE],
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 28], owner: 'p1', // range 3
			body: [TOUGH, TOUGH, MOVE],
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 29], owner: 'p2',
			body: [ATTACK, MOVE],
		});

		await shard.tick();

		const attackRc = await shard.runPlayer('p2', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
		`);
		expect(attackRc).toBe(OK);
		await shard.tick();

		const injured = await shard.expectObject(targetId, 'creep');
		expect(injured.hits).toBe(3 * BODYPART_HITS - ATTACK_POWER);

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${healerId}).rangedHeal(Game.getObjectById(${targetId}))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const target = await shard.expectObject(targetId, 'creep');
		expect(target.hits).toBe(3 * BODYPART_HITS - ATTACK_POWER + RANGED_HEAL_POWER);
	});
});
