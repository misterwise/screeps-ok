import { describe, test, expect, code,
	OK,
	MOVE, ATTACK, RANGED_ATTACK, TOUGH, HEAL, body,
	ATTACK_POWER, RANGED_ATTACK_POWER, HEAL_POWER, BODYPART_HITS,
} from '../../src/index.js';
import type { ShardFixture } from '../../src/fixture.js';

// Vanilla resolves a creep's damage and healing together at the end of the
// tick (processor/intents/creeps/tick.js:118-135): damage, then heal, then the
// hitsMax cap, then the death check, with both accumulators cleared.

async function twoPlayers(shard: ShardFixture) {
	await shard.createShard({
		players: ['p1', 'p2'],
		rooms: [
			{ name: 'W1N1', rcl: 1, owner: 'p1' },
			{ name: 'W2N1', rcl: 1, owner: 'p2' },
		],
	});
}

// A p1 target at 30 hits with a 1-ATTACK p2 attacker and a 5-HEAL p1 healer
// beside it: one tick of both is lethal damage healed back.
async function nearlyDeadTarget(shard: ShardFixture) {
	await twoPlayers(shard);
	const targetId = await shard.placeCreep('W1N1', { pos: [25, 25], owner: 'p1', body: [TOUGH, TOUGH, MOVE] });
	const seederId = await shard.placeCreep('W1N1', { pos: [26, 25], owner: 'p2', body: body(9, ATTACK, MOVE) });
	const attackerId = await shard.placeCreep('W1N1', { pos: [25, 26], owner: 'p2', body: [ATTACK, MOVE] });
	const healerId = await shard.placeCreep('W1N1', { pos: [24, 25], owner: 'p1', body: body(5, HEAL, MOVE) });

	const seedRc = await shard.runPlayer('p2', code`
		Game.getObjectById(${seederId}).attack(Game.getObjectById(${targetId}))
	`);
	expect(seedRc).toBe(OK);
	const hits = 3 * BODYPART_HITS - 9 * ATTACK_POWER;
	expect((await shard.expectObject(targetId, 'creep')).hits).toBe(hits);

	const results = await shard.runPlayers({
		p1: code`Game.getObjectById(${healerId}).heal(Game.getObjectById(${targetId}))`,
		p2: code`Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))`,
	});
	expect(results).toEqual({ p1: OK, p2: OK });
	return { targetId, net: hits + 5 * HEAL_POWER - ATTACK_POWER };
}

describe('Simultaneous damage & healing resolution', () => {
	test('COMBAT-SIMULT-001:net newHits = oldHits + healing - damage in the same tick', async ({ shard }) => {
		await twoPlayers(shard);
		const targetId = await shard.placeCreep('W1N1', { pos: [25, 25], owner: 'p1', body: body(8, TOUGH, MOVE) });
		const healerId = await shard.placeCreep('W1N1', { pos: [25, 26], owner: 'p1', body: [HEAL, MOVE] });
		const attackerId = await shard.placeCreep('W1N1', { pos: [24, 25], owner: 'p2', body: [ATTACK, MOVE] });

		// A wound first, so the heal isn't capped at hitsMax.
		const seedRc = await shard.runPlayer('p2', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
		`);
		expect(seedRc).toBe(OK);
		const wounded = 9 * BODYPART_HITS - ATTACK_POWER;
		expect((await shard.expectObject(targetId, 'creep')).hits).toBe(wounded);

		const results = await shard.runPlayers({
			p1: code`Game.getObjectById(${healerId}).heal(Game.getObjectById(${targetId}))`,
			p2: code`Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))`,
		});
		expect(results).toEqual({ p1: OK, p2: OK });
		expect((await shard.expectObject(targetId, 'creep')).hits).toBe(wounded + HEAL_POWER - ATTACK_POWER);
	});

	test('COMBAT-SIMULT-001:healMatchesDamage a creep whose healing matches the damage keeps its hits', async ({ shard }) => {
		await twoPlayers(shard);
		const targetId = await shard.placeCreep('W1N1', { pos: [25, 25], owner: 'p1', body: body(8, TOUGH, MOVE) });
		// Five HEAL parts restore what two ATTACK parts deal.
		const healerId = await shard.placeCreep('W1N1', { pos: [25, 26], owner: 'p1', body: body(5, HEAL, MOVE) });
		const attackerId = await shard.placeCreep('W1N1', { pos: [24, 25], owner: 'p2', body: body(2, ATTACK, MOVE) });
		expect(5 * HEAL_POWER).toBe(2 * ATTACK_POWER);

		const seedRc = await shard.runPlayer('p2', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
		`);
		expect(seedRc).toBe(OK);
		const wounded = 9 * BODYPART_HITS - 2 * ATTACK_POWER;
		expect((await shard.expectObject(targetId, 'creep')).hits).toBe(wounded);

		const results = await shard.runPlayers({
			p1: code`Game.getObjectById(${healerId}).heal(Game.getObjectById(${targetId}))`,
			p2: code`Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))`,
		});
		expect(results).toEqual({ p1: OK, p2: OK });
		expect((await shard.expectObject(targetId, 'creep')).hits).toBe(wounded);
	});

	test('COMBAT-SIMULT-001:lethalHealedBack a lethal hit healed back in the same tick leaves the creep at the net', async ({ shard }) => {
		const { targetId, net } = await nearlyDeadTarget(shard);
		expect((await shard.expectObject(targetId, 'creep')).hits).toBe(net);
	});

	test('COMBAT-SIMULT-001:lethal same-tick heal does not save a creep when damage exceeds hits + heal', async ({ shard }) => {
		// The HEAL part still has hits when the intents queue, so both return OK;
		// the death is decided when the tick resolves.
		await twoPlayers(shard);
		// Damage lands front to back, so the HEAL part keeps the last hits.
		const targetId = await shard.placeCreep('W1N1', { pos: [25, 25], owner: 'p1', body: [MOVE, HEAL] });
		const seederId = await shard.placeCreep('W1N1', { pos: [24, 25], owner: 'p2', body: body(6, ATTACK, MOVE) });
		const rangerId = await shard.placeCreep('W1N1', { pos: [22, 25], owner: 'p2', body: [RANGED_ATTACK, MOVE] });
		const attackerId = await shard.placeCreep('W1N1', { pos: [26, 25], owner: 'p2', body: [ATTACK, MOVE] });

		const seedRcs = await shard.runPlayer('p2', code`[
			Game.getObjectById(${seederId}).attack(Game.getObjectById(${targetId})),
			Game.getObjectById(${rangerId}).rangedAttack(Game.getObjectById(${targetId})),
		]`);
		expect(seedRcs).toEqual([OK, OK]);
		const hits = 2 * BODYPART_HITS - 6 * ATTACK_POWER - RANGED_ATTACK_POWER;
		expect((await shard.expectObject(targetId, 'creep')).hits).toBe(hits);
		expect(hits + HEAL_POWER - ATTACK_POWER).toBeLessThan(0);

		const results = await shard.runPlayers({
			p1: code`Game.getObjectById(${targetId}).heal(Game.getObjectById(${targetId}))`,
			p2: code`Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))`,
		});
		expect(results).toEqual({ p1: OK, p2: OK });
		expect(await shard.getObject(targetId)).toBeNull();
	});

	test('COMBAT-SIMULT-001:summedSources damage and healing sum over every source', async ({ shard }) => {
		await twoPlayers(shard);
		const targetId = await shard.placeCreep('W1N1', { pos: [25, 25], owner: 'p1', body: body(8, TOUGH, MOVE) });
		const a1Id = await shard.placeCreep('W1N1', { pos: [25, 26], owner: 'p2', body: [ATTACK, MOVE], name: 'a1' });
		const a2Id = await shard.placeCreep('W1N1', { pos: [26, 25], owner: 'p2', body: [ATTACK, MOVE], name: 'a2' });
		const h1Id = await shard.placeCreep('W1N1', { pos: [24, 25], owner: 'p1', body: [HEAL, MOVE], name: 'h1' });
		const h2Id = await shard.placeCreep('W1N1', { pos: [25, 24], owner: 'p1', body: [HEAL, MOVE], name: 'h2' });

		const seedRc = await shard.runPlayer('p2', code`
			Game.getObjectById(${a1Id}).attack(Game.getObjectById(${targetId}))
		`);
		expect(seedRc).toBe(OK);
		const wounded = 9 * BODYPART_HITS - ATTACK_POWER;
		expect((await shard.expectObject(targetId, 'creep')).hits).toBe(wounded);

		const results = await shard.runPlayers({
			p1: code`[
				Game.getObjectById(${h1Id}).heal(Game.getObjectById(${targetId})),
				Game.getObjectById(${h2Id}).heal(Game.getObjectById(${targetId})),
			]`,
			p2: code`[
				Game.getObjectById(${a1Id}).attack(Game.getObjectById(${targetId})),
				Game.getObjectById(${a2Id}).attack(Game.getObjectById(${targetId})),
			]`,
		});
		expect(results).toEqual({ p1: [OK, OK], p2: [OK, OK] });
		expect((await shard.expectObject(targetId, 'creep')).hits).toBe(wounded - 2 * ATTACK_POWER + 2 * HEAL_POWER);
	});

	test('COMBAT-SIMULT-003 a heal-saved creep\'s hits stay put on the next idle tick', async ({ shard }) => {
		const { targetId, net } = await nearlyDeadTarget(shard);
		expect((await shard.expectObject(targetId, 'creep')).hits).toBe(net);

		await shard.tick();
		expect((await shard.expectObject(targetId, 'creep')).hits).toBe(net);
	});
});
