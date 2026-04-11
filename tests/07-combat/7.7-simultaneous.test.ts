import { describe, test, expect, code,
	OK,
	MOVE, ATTACK, TOUGH, HEAL, body,
	ATTACK_POWER, HEAL_POWER, BODYPART_HITS,
	FIND_TOMBSTONES,
} from '../../src/index.js';

// Simultaneous Damage & Healing — vanilla engine resolves damage and healing in
// the same tick. See @screeps/engine/src/processor/intents/creeps/tick.js:118-135:
//   1. _damageToApply is applied (subtracts from object.hits)
//   2. _healToApply is added
//   3. hits capped at hitsMax
//   4. death check (object.hits <= 0)
// Net result: newHits = clamp(oldHits - damage + heal, 0, hitsMax).
// A creep survives a tick if heal >= damage even when oldHits == damage.

describe('Simultaneous damage & healing resolution', () => {
	test('COMBAT-SIMULT-001 newHits = oldHits + healing - damage in the same tick', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		// Target has lots of TOUGH so it cannot be at full HP after a single attack
		// (heal would otherwise be capped to hitsMax and the arithmetic would be hidden).
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [...body(8, TOUGH), MOVE],
		});
		const healerId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [HEAL, MOVE],
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [24, 25], owner: 'p2',
			body: [ATTACK, MOVE],
		});
		await shard.tick();

		const before = await shard.expectObject(targetId, 'creep');
		const oldHits = before.hits;
		// Pre-damage so we are not at full HP and the heal is observable.
		const seedRc = await shard.runPlayer('p2', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
		`);
		expect(seedRc).toBe(OK);
		await shard.tick();

		const mid = await shard.expectObject(targetId, 'creep');
		expect(mid.hits).toBe(oldHits - ATTACK_POWER);

		// Now: same tick attack + heal.
		const results = await shard.runPlayers({
			p1: code`Game.getObjectById(${healerId}).heal(Game.getObjectById(${targetId}))`,
			p2: code`Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))`,
		});
		expect(results.p1).toBe(OK);
		expect(results.p2).toBe(OK);
		await shard.tick();

		const after = await shard.expectObject(targetId, 'creep');
		expect(after.hits).toBe(mid.hits + HEAL_POWER - ATTACK_POWER);
	});

	test('COMBAT-SIMULT-002 a creep survives if healing equals damage in the same tick', async ({ shard }) => {
		// Heal exactly equals damage → tick.js applies damage then heal, so hits
		// returns to its original value. Death check at the end of the tick finds
		// hits > 0 and the creep survives unchanged.
		// Math: 2 ATTACK parts deal 60 damage. 5 HEAL parts heal 60. Exact tie.
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [...body(8, TOUGH), MOVE],
		});
		const healerId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [...body(5, HEAL), MOVE], // 60 heal
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [24, 25], owner: 'p2',
			body: [...body(2, ATTACK), MOVE], // 60 dmg
		});
		await shard.tick();

		// Pre-damage the target so heal is not capped at hitsMax.
		await shard.runPlayer('p2', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
		`);
		await shard.tick();
		const mid = await shard.expectObject(targetId, 'creep');
		const startHits = mid.hits;
		expect(startHits).toBeGreaterThan(60);

		// Same-tick exact tie: 60 damage in, 60 heal in.
		const results = await shard.runPlayers({
			p1: code`Game.getObjectById(${healerId}).heal(Game.getObjectById(${targetId}))`,
			p2: code`Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))`,
		});
		expect(results.p1).toBe(OK);
		expect(results.p2).toBe(OK);
		await shard.tick();

		// Survives with hits unchanged.
		const after = await shard.expectObject(targetId, 'creep');
		expect(after).toBeDefined();
		expect(after.hits).toBe(startHits);
	});

	test('COMBAT-SIMULT-003 overkill damage does not carry over to the next tick', async ({ shard }) => {
		// If damage > hits + heal, the creep dies this tick. Overkill is discarded;
		// nothing persists to a next tick. The previous tick's resolved hits is the
		// final state for that creep.
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [TOUGH, MOVE], // 200 hits
		});
		// Massive damage on a small target.
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2',
			body: [...body(10, ATTACK), MOVE], // 300 dmg
		});
		await shard.tick();

		const before = await shard.expectObject(targetId, 'creep');
		expect(before.hits).toBe(2 * BODYPART_HITS);

		const rc = await shard.runPlayer('p2', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		// Target died this tick; tombstone created.
		const after = await shard.getObject(targetId);
		expect(after).toBeNull();

		// A tombstone is left at the target's position. Overkill does not
		// reanimate the creep next tick or affect adjacent creeps.
		const tombstones = await shard.findInRoom('W1N1', FIND_TOMBSTONES);
		const ts = tombstones.find(t => t.pos.x === 25 && t.pos.y === 25);
		expect(ts).toBeDefined();

		// Verify the attacker is unchanged after the kill (no overkill bleed).
		await shard.tick();
		const attacker = await shard.expectObject(attackerId, 'creep');
		expect(attacker.hits).toBe(attacker.hitsMax);
	});

	test('COMBAT-SIMULT-004 a creep dies only if hits reach 0 after simultaneous resolution', async ({ shard }) => {
		// Setup: damage > hits, healing brings net change above 0 → creep survives.
		// Verify the death check happens AFTER both damage and heal apply.
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		// Target: 1 TOUGH + 1 MOVE = 200 hits. Pre-damage to leave it at 30 hits.
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [TOUGH, TOUGH, MOVE], // 300 hits
		});
		// Attacker deals 30 damage per tick.
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2',
			body: [ATTACK, MOVE],
		});
		// Healer: 5 HEAL parts heal 60 hits per tick > 30 damage → creep survives.
		const healerId = await shard.placeCreep('W1N1', {
			pos: [24, 25], owner: 'p1',
			body: [...body(5, HEAL), MOVE],
		});
		await shard.tick();

		// Pre-damage to bring target hits to 30.
		// 9 hits of ATTACK_POWER = 270 damage. Starting from 300, ends at 30.
		for (let i = 0; i < 9; i++) {
			// Healer is friendly to target — but only attacker fires this loop.
			// Use a separate damager in p2 chain.
			await shard.runPlayer('p2', code`
				Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
			`);
			await shard.tick();
		}
		const mid = await shard.expectObject(targetId, 'creep');
		expect(mid.hits).toBe(30);

		// Same tick: 30 damage (kill) + 60 heal = +30 net → creep is at 60 after.
		const results = await shard.runPlayers({
			p1: code`Game.getObjectById(${healerId}).heal(Game.getObjectById(${targetId}))`,
			p2: code`Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))`,
		});
		expect(results.p1).toBe(OK);
		expect(results.p2).toBe(OK);
		await shard.tick();

		const after = await shard.expectObject(targetId, 'creep');
		expect(after).toBeDefined();
		// 30 - 30 + 60 = 60.
		expect(after.hits).toBe(60);
	});

	test('COMBAT-SIMULT-005 multiple sources of damage and healing are summed independently', async ({ shard }) => {
		// Two attackers + two healers in the same tick. _damageToApply and _healToApply
		// accumulate across all sources before the tick.js resolution step.
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [...body(8, TOUGH), MOVE],
		});
		const a1Id = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2', body: [ATTACK, MOVE], name: 'a1',
		});
		const a2Id = await shard.placeCreep('W1N1', {
			pos: [26, 25], owner: 'p2', body: [ATTACK, MOVE], name: 'a2',
		});
		const h1Id = await shard.placeCreep('W1N1', {
			pos: [24, 25], owner: 'p1', body: [HEAL, MOVE], name: 'h1',
		});
		const h2Id = await shard.placeCreep('W1N1', {
			pos: [25, 24], owner: 'p1', body: [HEAL, MOVE], name: 'h2',
		});
		await shard.tick();

		// Pre-damage so heal is not capped.
		await shard.runPlayer('p2', code`
			Game.getObjectById(${a1Id}).attack(Game.getObjectById(${targetId}))
		`);
		await shard.tick();
		const mid = await shard.expectObject(targetId, 'creep');
		const startHits = mid.hits;

		// Same tick: 2 attackers (60 damage) + 2 healers (24 heal).
		const results = await shard.runPlayers({
			p1: code`
				const r1 = Game.getObjectById(${h1Id}).heal(Game.getObjectById(${targetId}));
				const r2 = Game.getObjectById(${h2Id}).heal(Game.getObjectById(${targetId}));
				[r1, r2]
			`,
			p2: code`
				const r1 = Game.getObjectById(${a1Id}).attack(Game.getObjectById(${targetId}));
				const r2 = Game.getObjectById(${a2Id}).attack(Game.getObjectById(${targetId}));
				[r1, r2]
			`,
		});
		expect(results.p1).toEqual([OK, OK]);
		expect(results.p2).toEqual([OK, OK]);
		await shard.tick();

		const after = await shard.expectObject(targetId, 'creep');
		// Net: -60 + 24 = -36
		expect(after.hits).toBe(startHits - 2 * ATTACK_POWER + 2 * HEAL_POWER);
	});
});
