import { describe, test, expect, code,
	OK, ERR_NOT_FOUND,
	MOVE, ATTACK, TOUGH, CARRY,
	BODYPART_HITS, ATTACK_POWER,
} from '../../src/index.js';

describe('Intent overwrite and cancel', () => {
	test('INTENT-CREEP-002 repeated same-tick calls keep only the last intent', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		// Two hostile targets at different positions.
		const target1Id = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2', body: [TOUGH, TOUGH, TOUGH, MOVE],
		});
		const target2Id = await shard.placeCreep('W1N1', {
			pos: [26, 25], owner: 'p2', body: [TOUGH, TOUGH, TOUGH, MOVE],
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [ATTACK, MOVE],
		});
		await shard.tick();

		// Call attack twice — second target should be the one that takes damage.
		const result = await shard.runPlayer('p1', code`
			const attacker = Game.getObjectById(${attackerId});
			const rc1 = attacker.attack(Game.getObjectById(${target1Id}));
			const rc2 = attacker.attack(Game.getObjectById(${target2Id}));
			({ rc1, rc2 })
		`) as { rc1: number; rc2: number };
		expect(result.rc1).toBe(OK);
		expect(result.rc2).toBe(OK);

		await shard.tick();

		// Target1 should be undamaged; target2 should have taken damage.
		const t1 = await shard.expectObject(target1Id, 'creep');
		const t2 = await shard.expectObject(target2Id, 'creep');
		expect(t1.hits).toBe(4 * BODYPART_HITS);
		expect(t2.hits).toBe(4 * BODYPART_HITS - ATTACK_POWER);
	});

	test('INTENT-CREEP-003 cancelOrder removes a queued intent', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2', body: [TOUGH, TOUGH, MOVE],
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [ATTACK, MOVE],
		});
		await shard.tick();

		// Queue an attack then cancel it.
		const result = await shard.runPlayer('p1', code`
			const attacker = Game.getObjectById(${attackerId});
			const attackRc = attacker.attack(Game.getObjectById(${targetId}));
			const cancelRc = attacker.cancelOrder('attack');
			({ attackRc, cancelRc })
		`) as { attackRc: number; cancelRc: number };
		expect(result.attackRc).toBe(OK);
		expect(result.cancelRc).toBe(OK);

		await shard.tick();

		// Target should be undamaged — the attack was canceled.
		const target = await shard.expectObject(targetId, 'creep');
		expect(target.hits).toBe(3 * BODYPART_HITS);
	});

	test('INTENT-CREEP-003 cancelOrder returns ERR_NOT_FOUND when no intent queued', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [ATTACK, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).cancelOrder('attack')
		`);
		expect(rc).toBe(ERR_NOT_FOUND);
	});
});
