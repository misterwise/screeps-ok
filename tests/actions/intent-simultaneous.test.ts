import { describe, test, expect, code,
	OK,
	MOVE, ATTACK, RANGED_ATTACK, HEAL, TOUGH,
	HEAL_POWER, RANGED_ATTACK_POWER, BODYPART_HITS,
} from '../../src/index.js';

describe('Simultaneous creep actions', () => {
	test('INTENT-SIMULT-001 move, rangedMassAttack, and heal all execute in the same tick', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});

		// Creep with MOVE, RANGED_ATTACK, and HEAL — all three can run simultaneously.
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [MOVE, RANGED_ATTACK, HEAL],
		});
		// Hostile creep within range 3 for rangedMassAttack AoE.
		const hostileId = await shard.placeCreep('W1N1', {
			pos: [26, 25], owner: 'p2',
			body: [TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE],
		});
		// Damaged friendly creep adjacent for heal.
		const friendlyId = await shard.placeCreep('W1N1', {
			pos: [24, 25], owner: 'p1',
			body: [TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE],
		});
		// Damage the friendly creep first.
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [24, 26], owner: 'p2', body: [ATTACK, MOVE],
		});
		await shard.tick();

		// Damage the friendly creep.
		await shard.runPlayer('p2', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${friendlyId}))
		`);
		await shard.tick();

		// Snapshot state before the simultaneous-action tick.
		const hostileBefore = await shard.expectObject(hostileId, 'creep');
		const friendlyBefore = await shard.expectObject(friendlyId, 'creep');
		const creepBefore = await shard.expectObject(creepId, 'creep');

		expect(friendlyBefore.hits).toBeLessThan(friendlyBefore.hitsMax);

		// Issue all three intents: move, rangedMassAttack, heal.
		const result = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			const friendly = Game.getObjectById(${friendlyId});
			const moveRc = creep.move(TOP);
			const rmaRc = creep.rangedMassAttack();
			const healRc = creep.heal(friendly);
			({ moveRc, rmaRc, healRc })
		`) as { moveRc: number; rmaRc: number; healRc: number };

		expect(result.moveRc).toBe(OK);
		expect(result.rmaRc).toBe(OK);
		expect(result.healRc).toBe(OK);

		await shard.tick();

		// Verify all three took effect:

		// 1. Move: creep should have moved (position changed).
		const creepAfter = await shard.expectObject(creepId, 'creep');
		expect(creepAfter.pos.y).toBe(creepBefore.pos.y - 1); // TOP = y-1

		// 2. rangedMassAttack: hostile should have taken damage.
		// At range 1, rangedMassAttack deals RANGED_ATTACK_POWER.
		const hostileAfter = await shard.expectObject(hostileId, 'creep');
		expect(hostileAfter.hits).toBeLessThan(hostileBefore.hits);

		// 3. Heal: friendly should have been healed.
		const friendlyAfter = await shard.expectObject(friendlyId, 'creep');
		expect(friendlyAfter.hits).toBe(friendlyBefore.hits + HEAL_POWER);
	});

	test('INTENT-SIMULT-004 heal on a healthy creep returns OK and blocks lower-priority actions', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});

		// Creep with HEAL and ATTACK. heal() and attack() are in the same
		// pipeline — heal at higher priority blocks attack at lower priority.
		// Note: based on the intent-creep-priority matrix, heal blocks attack,
		// rangedAttack, build, repair, dismantle, harvest (all lower-priority
		// in the same pipeline).
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [HEAL, ATTACK, MOVE],
		});
		// Healthy friendly creep adjacent to heal.
		const friendlyId = await shard.placeCreep('W1N1', {
			pos: [25, 24], owner: 'p1',
			body: [TOUGH, TOUGH, MOVE, MOVE],
		});
		// Hostile creep adjacent for attack.
		const hostileId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2',
			body: [TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE],
		});
		await shard.tick();

		// Snapshot hostile before.
		const hostileBefore = await shard.expectObject(hostileId, 'creep');

		// Issue heal on the healthy friendly (returns OK even though target is
		// at full HP) and attack on the hostile. heal blocks attack.
		const result = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			const friendly = Game.getObjectById(${friendlyId});
			const hostile = Game.getObjectById(${hostileId});
			const healRc = creep.heal(friendly);
			const attackRc = creep.attack(hostile);
			({ healRc, attackRc })
		`) as { healRc: number; attackRc: number };

		// Both return OK at intent time.
		expect(result.healRc).toBe(OK);
		expect(result.attackRc).toBe(OK);

		await shard.tick();

		// Verify attack was blocked: hostile should be undamaged.
		const hostileAfter = await shard.expectObject(hostileId, 'creep');
		expect(hostileAfter.hits).toBe(hostileBefore.hits);
	});
});
