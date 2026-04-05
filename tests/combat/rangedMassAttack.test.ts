import { describe, test, expect, code, OK, MOVE, TOUGH, RANGED_ATTACK, body } from '../../src/index.js';
import { rangedMassAttackRangeCases } from '../support/matrices/ranged-mass-attack.js';

describe('creep.rangedMassAttack()', () => {
	for (const { range, expectedDamage } of rangedMassAttackRangeCases) {
		test(`COMBAT-RMA-002 [range=${range}] rangedMassAttack() deals the expected per-range damage`, async ({ shard }) => {
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
			});
			const attackerId = await shard.placeCreep('W1N1', {
				pos: [25, 25], owner: 'p1',
				body: [RANGED_ATTACK, MOVE],
			});
			const targetId = await shard.placeCreep('W1N1', {
				pos: [25, 25 + range], owner: 'p2',
				body: body(5, TOUGH, MOVE),
			});

			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${attackerId}).rangedMassAttack()
			`);
			expect(rc).toBe(OK);

			await shard.tick();

			const target = await shard.expectObject(targetId, 'creep');
			expect(target.hits).toBe(600 - expectedDamage);
		});
	}

	test('COMBAT-RMA-001 rangedMassAttack() damages every hostile creep within range 3 in a single call', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [RANGED_ATTACK, MOVE],
		});
		const t1 = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2', // range 1
			body: body(3, TOUGH, MOVE),
		});
		const t2 = await shard.placeCreep('W1N1', {
			pos: [26, 25], owner: 'p2', // range 1
			body: body(3, TOUGH, MOVE),
			name: 'target2',
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).rangedMassAttack()
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const target1 = await shard.expectObject(t1, 'creep');
		const target2 = await shard.expectObject(t2, 'creep');
		expect(target1.hits).toBe(400 - 10);
		expect(target2.hits).toBe(400 - 10);
	});
});
