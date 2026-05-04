import { describe, test, expect, code, OK, ERR_NOT_IN_RANGE, ERR_NO_BODYPART, ERR_INVALID_TARGET, MOVE, ATTACK, TOUGH, RANGED_ATTACK, HEAL, CARRY, body, ATTACK_POWER, RANGED_ATTACK_POWER, HEAL_POWER, RANGED_HEAL_POWER, BODYPART_HITS, STRUCTURE_RAMPART, STRUCTURE_SPAWN } from '../../src/index.js';
import { combatHealValidationCases } from '../../src/matrices/combat-heal-validation.js';
import { combatMeleeValidationCases } from '../../src/matrices/combat-melee-validation.js';
import { combatRangedValidationCases } from '../../src/matrices/combat-ranged-validation.js';
import { combatRangedHealValidationCases } from '../../src/matrices/combat-rangedheal-validation.js';
import { spawnBusyCreep } from '../intent-validation-helpers.js';

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

	test('COMBAT-MELEE-004 attack range is exactly 1 — OK at adjacent, ERR_NOT_IN_RANGE at range 2', async ({ shard }) => {
		// Engine: @screeps/engine/src/game/creeps.js:618 — `!target.pos.isNearTo(this.pos)`
		// returns ERR_NOT_IN_RANGE; isNearTo means |dx|<=1 && |dy|<=1.
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [ATTACK, MOVE],
		});
		// Target at the maximum diagonal distance still considered adjacent.
		const adjacentDiagId = await shard.placeCreep('W1N1', {
			pos: [26, 26], owner: 'p2',
			body: [TOUGH, MOVE],
			name: 'adj',
		});
		const range2Id = await shard.placeCreep('W1N1', {
			pos: [25, 27], owner: 'p2',
			body: [TOUGH, MOVE],
			name: 'far',
		});

		const okRc = await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${adjacentDiagId}))
		`);
		expect(okRc).toBe(OK);

		const farRc = await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${range2Id}))
		`);
		expect(farRc).toBe(ERR_NOT_IN_RANGE);
	});

	test('COMBAT-MELEE-005 attack on a creep under a rampart hits the rampart instead', async ({ shard }) => {
		// Engine: @screeps/engine/src/processor/intents/creeps/attack.js:33-36
		// `var rampart = _.find(roomObjects, {type: 'rampart', x: target.x, y: target.y}); if(rampart) target = rampart;`
		// xxscreeps adapter does not redirect — see parity gap `rampart-no-protection`.
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 3, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const rampartHits = 1_000_000;
		const rampartId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_RAMPART, owner: 'p1',
			hits: rampartHits,
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: body(5, TOUGH, MOVE),
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p2',
			body: [ATTACK, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p2', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		// Rampart absorbs the hit; creep takes no damage.
		const rampart = await shard.expectStructure(rampartId, STRUCTURE_RAMPART);
		expect(rampart.hits).toBe(rampartHits - ATTACK_POWER);

		const target = await shard.expectObject(targetId, 'creep');
		expect(target.hits).toBe(6 * BODYPART_HITS);
	});

	test('COMBAT-MELEE-006 target ATTACK parts deal counter-damage back to a melee attacker', async ({ shard }) => {
		// Engine: @screeps/engine/src/processor/intents/_damage.js:17-19
		// For melee, attackBackPower = target's body ATTACK effectiveness, applied to the source.
		// Counter-damage is suppressed if the attacker is on a rampart tile.
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		// Body: 1 ATTACK + 1 MOVE + 3 TOUGH + 1 MOVE = 6 parts (body() repeats only the
		// part immediately following the count).
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [ATTACK, MOVE, ...body(3, TOUGH), MOVE],
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2',
			body: [ATTACK, MOVE, ...body(3, TOUGH), MOVE],
		});

		const beforeAttacker = await shard.expectObject(attackerId, 'creep');
		const attackerHitsBefore = beforeAttacker.hits;
		const beforeTarget = await shard.expectObject(targetId, 'creep');
		const targetHitsBefore = beforeTarget.hits;

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		// Both lose ATTACK_POWER (target took 30 from attacker; attacker took 30 counter).
		const target = await shard.expectObject(targetId, 'creep');
		expect(target.hits).toBe(targetHitsBefore - ATTACK_POWER);

		const attacker = await shard.expectObject(attackerId, 'creep');
		expect(attacker.hits).toBe(attackerHitsBefore - ATTACK_POWER);
	});

	test('COMBAT-MELEE-008 counter-damage scales at ATTACK_POWER per target ATTACK part', async ({ shard }) => {
		// Engine _damage.js:17-19: counter-damage = target's body ATTACK effectiveness at
		// ATTACK_POWER per part, same rate as a regular melee attack. 3 ATTACK parts on
		// the target → 3 × ATTACK_POWER counter to the attacker.
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: body(10, TOUGH, ATTACK, MOVE),
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2',
			body: [...body(3, ATTACK), MOVE],
		});

		const attackerBefore = await shard.expectObject(attackerId, 'creep');
		const attackerHitsBefore = attackerBefore.hits;

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const attacker = await shard.expectObject(attackerId, 'creep');
		expect(attackerHitsBefore - attacker.hits).toBe(3 * ATTACK_POWER);
	});

	test('COMBAT-MELEE-007 attack accepts creeps and structures (non-attackable target → ERR_INVALID_TARGET)', async ({ shard }) => {
		// Engine: @screeps/engine/src/game/creeps.js:607-611 — target must be Creep,
		// PowerCreep, StructureSpawn, or Structure. Sources are not attackable → ERR_INVALID_TARGET.
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 3, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p2',
			body: [ATTACK, MOVE],
		});
		// Friendly target structure (spawn) — opposite player so it is hostile to attacker.
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_SPAWN, owner: 'p1',
		});
		// Friendly target creep
		const creepTargetId = await shard.placeCreep('W1N1', {
			pos: [26, 25], owner: 'p1',
			body: [TOUGH, MOVE],
		});
		// Non-attackable Source for the negative case.
		const sourceId = await shard.placeSource('W1N1', { pos: [24, 25], energy: 3000 });
		await shard.tick();

		const okStruct = await shard.runPlayer('p2', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${spawnId}))
		`);
		expect(okStruct).toBe(OK);

		const okCreep = await shard.runPlayer('p2', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${creepTargetId}))
		`);
		expect(okCreep).toBe(OK);

		// Source is not Creep/PowerCreep/Structure → ERR_INVALID_TARGET.
		const invalidRc = await shard.runPlayer('p2', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${sourceId}))
		`);
		expect(invalidRc).toBe(ERR_INVALID_TARGET);
	});

	for (const row of combatMeleeValidationCases) {
		test(`COMBAT-MELEE-009:${row.label} attack() validation returns the canonical code`, async ({ shard }) => {
			const blockers = new Set(row.blockers);
			const owner = blockers.has('not-owner') ? 'p2' : 'p1';
			const roomOwner = owner === 'p2' && blockers.has('busy') ? 'p2' : 'p1';
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [{ name: 'W1N1', rcl: 1, owner: roomOwner }],
			});

			const attackerId = blockers.has('busy')
				? await spawnBusyCreep(shard, {
					owner,
					observerOwner: owner === 'p2' ? 'p1' : undefined,
					body: blockers.has('no-bodypart') ? [MOVE] : [ATTACK, MOVE],
				})
				: await shard.placeCreep('W1N1', {
					pos: [25, 25],
					owner,
					body: blockers.has('no-bodypart') ? [MOVE] : [ATTACK, MOVE],
				});
			const targetId = blockers.has('invalid-target')
				? await shard.placeSource('W1N1', { pos: blockers.has('range') ? [30, 30] : [25, 26] })
				: await shard.placeCreep('W1N1', {
					pos: blockers.has('range') ? [30, 30] : [25, 26],
					owner: owner === 'p1' ? 'p2' : 'p1',
					body: [TOUGH, MOVE],
				});

			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
			`);
			expect(rc).toBe(row.expectedRc);
		});
	}

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

	test('COMBAT-RANGED-003 rangedAttack accepts targets at range 1 through 3', async ({ shard }) => {
		// Engine: @screeps/engine/src/game/creeps.js:645 — `!this.pos.inRangeTo(target, 3)`.
		// Range 1, 2, and 3 all return OK; range 4+ returns ERR_NOT_IN_RANGE (covered by 002).
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [RANGED_ATTACK, MOVE],
		});
		const t1 = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2', body: [TOUGH, MOVE], name: 'r1',
		});
		const t2 = await shard.placeCreep('W1N1', {
			pos: [25, 27], owner: 'p2', body: [TOUGH, MOVE], name: 'r2',
		});
		const t3 = await shard.placeCreep('W1N1', {
			pos: [25, 28], owner: 'p2', body: [TOUGH, MOVE], name: 'r3',
		});

		const rc1 = await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).rangedAttack(Game.getObjectById(${t1}))
		`);
		expect(rc1).toBe(OK);

		const rc2 = await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).rangedAttack(Game.getObjectById(${t2}))
		`);
		expect(rc2).toBe(OK);

		const rc3 = await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).rangedAttack(Game.getObjectById(${t3}))
		`);
		expect(rc3).toBe(OK);
	});

	test('COMBAT-RANGED-004 returns ERR_NO_BODYPART without RANGED_ATTACK parts', async ({ shard }) => {
		// Engine: @screeps/engine/src/game/creeps.js:634 — `_hasActiveBodypart(this.body, C.RANGED_ATTACK)`.
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [ATTACK, MOVE],
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 27], owner: 'p2',
			body: [TOUGH, MOVE],
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).rangedAttack(Game.getObjectById(${targetId}))
		`);
		expect(rc).toBe(ERR_NO_BODYPART);
	});

	test('COMBAT-RANGED-006 rangedAttack on a creep under a rampart hits the rampart instead', async ({ shard }) => {
		// Engine rangedAttack.js:33-36 redirects target = rampart when the target
		// tile has a rampart, mirroring melee. xxscreeps lacks this redirect (known
		// parity gap `rampart-no-protection`).
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 3, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const rampartHits = 1_000_000;
		const rampartId = await shard.placeStructure('W1N1', {
			pos: [25, 28], structureType: STRUCTURE_RAMPART, owner: 'p1',
			hits: rampartHits,
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 28], owner: 'p1',
			body: body(5, TOUGH, MOVE),
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p2',
			body: [RANGED_ATTACK, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p2', code`
			Game.getObjectById(${attackerId}).rangedAttack(Game.getObjectById(${targetId}))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const rampart = await shard.expectStructure(rampartId, STRUCTURE_RAMPART);
		expect(rampart.hits).toBe(rampartHits - RANGED_ATTACK_POWER);
		const target = await shard.expectObject(targetId, 'creep');
		expect(target.hits).toBe(6 * BODYPART_HITS);
	});

	test('COMBAT-RANGED-005 rangedAttack accepts creeps and structures (non-attackable → ERR_INVALID_TARGET)', async ({ shard }) => {
		// Engine: @screeps/engine/src/game/creeps.js:640-644 — target must be Creep,
		// PowerCreep, StructureSpawn, or Structure. Source returns ERR_INVALID_TARGET.
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 3, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p2',
			body: [RANGED_ATTACK, MOVE],
		});
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 27], structureType: STRUCTURE_SPAWN, owner: 'p1',
		});
		const creepTargetId = await shard.placeCreep('W1N1', {
			pos: [27, 25], owner: 'p1',
			body: [TOUGH, MOVE],
		});
		const sourceId = await shard.placeSource('W1N1', { pos: [25, 22], energy: 3000 });
		await shard.tick();

		const okStruct = await shard.runPlayer('p2', code`
			Game.getObjectById(${attackerId}).rangedAttack(Game.getObjectById(${spawnId}))
		`);
		expect(okStruct).toBe(OK);

		const okCreep = await shard.runPlayer('p2', code`
			Game.getObjectById(${attackerId}).rangedAttack(Game.getObjectById(${creepTargetId}))
		`);
		expect(okCreep).toBe(OK);

		const invalidRc = await shard.runPlayer('p2', code`
			Game.getObjectById(${attackerId}).rangedAttack(Game.getObjectById(${sourceId}))
		`);
		expect(invalidRc).toBe(ERR_INVALID_TARGET);
	});

	for (const row of combatRangedValidationCases) {
		test(`COMBAT-RANGED-007:${row.label} rangedAttack() validation returns the canonical code`, async ({ shard }) => {
			const blockers = new Set(row.blockers);
			const owner = blockers.has('not-owner') ? 'p2' : 'p1';
			const roomOwner = owner === 'p2' && blockers.has('busy') ? 'p2' : 'p1';
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [{ name: 'W1N1', rcl: 1, owner: roomOwner }],
			});

			const attackerId = blockers.has('busy')
				? await spawnBusyCreep(shard, {
					owner,
					observerOwner: owner === 'p2' ? 'p1' : undefined,
					body: blockers.has('no-bodypart') ? [MOVE] : [RANGED_ATTACK, MOVE],
				})
				: await shard.placeCreep('W1N1', {
					pos: [25, 25],
					owner,
					body: blockers.has('no-bodypart') ? [MOVE] : [RANGED_ATTACK, MOVE],
				});
			const targetId = blockers.has('invalid-target')
				? await shard.placeSource('W1N1', { pos: blockers.has('range') ? [30, 30] : [25, 27] })
				: await shard.placeCreep('W1N1', {
					pos: blockers.has('range') ? [30, 30] : [25, 27],
					owner: owner === 'p1' ? 'p2' : 'p1',
					body: [TOUGH, MOVE],
				});

			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${attackerId}).rangedAttack(Game.getObjectById(${targetId}))
			`);
			expect(rc).toBe(row.expectedRc);
		});
	}
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

	test('COMBAT-HEAL-002 heal range is exactly 1 — ERR_NOT_IN_RANGE at range 2', async ({ shard }) => {
		// Engine: @screeps/engine/src/game/creeps.js:694 — `!target.pos.isNearTo(this.pos)` → ERR_NOT_IN_RANGE.
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const healerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [HEAL, MOVE],
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 27], owner: 'p1', // range 2
			body: [TOUGH, MOVE],
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${healerId}).heal(Game.getObjectById(${targetId}))
		`);
		expect(rc).toBe(ERR_NOT_IN_RANGE);
	});

	test('COMBAT-HEAL-003 heal accepts any creep target regardless of ownership', async ({ shard }) => {
		// Engine: @screeps/engine/src/game/creeps.js:689-693 — target check is type-only
		// (Creep or PowerCreep). There is NO ownership restriction; healing a hostile creep
		// returns OK and the heal is applied. The catalog wording is corrected to reflect this.
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
		// Friendly target
		const friendlyId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: body(3, TOUGH, MOVE),
		});
		// Hostile target — engine still allows the call.
		const hostileId = await shard.placeCreep('W1N1', {
			pos: [24, 25], owner: 'p2',
			body: body(3, TOUGH, MOVE),
		});
		await shard.tick();

		const friendRc = await shard.runPlayer('p1', code`
			Game.getObjectById(${healerId}).heal(Game.getObjectById(${friendlyId}))
		`);
		expect(friendRc).toBe(OK);

		const hostileRc = await shard.runPlayer('p1', code`
			Game.getObjectById(${healerId}).heal(Game.getObjectById(${hostileId}))
		`);
		expect(hostileRc).toBe(OK);
	});

	test('COMBAT-HEAL-005 heal returns ERR_NOT_IN_RANGE beyond range 1', async ({ shard }) => {
		// Engine game/creeps.js:694-696 — heal uses `isNearTo` (Chebyshev 1).
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const healerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [HEAL, MOVE],
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 27], owner: 'p1', // range 2
			body: [TOUGH, MOVE],
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${healerId}).heal(Game.getObjectById(${targetId}))
		`);
		expect(rc).toBe(ERR_NOT_IN_RANGE);
	});

	test('COMBAT-HEAL-006 heal returns ERR_NO_BODYPART without HEAL parts', async ({ shard }) => {
		// Engine game/creeps.js:686-688 — body check runs before range check.
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const healerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [MOVE, CARRY],
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [TOUGH, MOVE],
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${healerId}).heal(Game.getObjectById(${targetId}))
		`);
		expect(rc).toBe(ERR_NO_BODYPART);
	});

	for (const row of combatHealValidationCases) {
		test(`COMBAT-HEAL-007:${row.label} heal() validation returns the canonical code`, async ({ shard }) => {
			const blockers = new Set(row.blockers);
			const owner = blockers.has('not-owner') ? 'p2' : 'p1';
			const roomOwner = owner === 'p2' && blockers.has('busy') ? 'p2' : 'p1';
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [{ name: 'W1N1', rcl: 1, owner: roomOwner }],
			});

			const healerId = blockers.has('busy')
				? await spawnBusyCreep(shard, {
					owner,
					observerOwner: owner === 'p2' ? 'p1' : undefined,
					body: blockers.has('no-bodypart') ? [MOVE] : [HEAL, MOVE],
				})
				: await shard.placeCreep('W1N1', {
					pos: [25, 25],
					owner,
					body: blockers.has('no-bodypart') ? [MOVE] : [HEAL, MOVE],
				});
			const targetId = blockers.has('invalid-target')
				? await shard.placeSource('W1N1', { pos: blockers.has('range') ? [30, 30] : [25, 26] })
				: await shard.placeCreep('W1N1', {
					pos: blockers.has('range') ? [30, 30] : [25, 26],
					owner,
					body: [TOUGH, MOVE],
				});

			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${healerId}).heal(Game.getObjectById(${targetId}))
			`);
			expect(rc).toBe(row.expectedRc);
		});
	}

	test('COMBAT-HEAL-004 heal on a creep at full HP returns OK with no effect', async ({ shard }) => {
		// Engine: @screeps/engine/src/processor/intents/creeps/tick.js:130-132 — hits is
		// capped to hitsMax after applying healing. So healing a full-HP creep is a no-op.
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const healerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [HEAL, MOVE],
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: body(3, TOUGH, MOVE),
		});
		await shard.tick();

		const before = await shard.expectObject(targetId, 'creep');
		const startHits = before.hits;
		expect(startHits).toBe(before.hitsMax);

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${healerId}).heal(Game.getObjectById(${targetId}))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const after = await shard.expectObject(targetId, 'creep');
		expect(after.hits).toBe(startHits);
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

	test('COMBAT-RANGEDHEAL-002 rangedHeal accepts targets at range 1 through 3, ERR_NOT_IN_RANGE at range 4', async ({ shard }) => {
		// Engine: @screeps/engine/src/game/creeps.js:725 — `!this.pos.inRangeTo(target, 3)`.
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const healerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [HEAL, MOVE],
		});
		const t1 = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1', body: [TOUGH, MOVE], name: 'r1',
		});
		const t3 = await shard.placeCreep('W1N1', {
			pos: [25, 28], owner: 'p1', body: [TOUGH, MOVE], name: 'r3',
		});
		const t4 = await shard.placeCreep('W1N1', {
			pos: [25, 29], owner: 'p1', body: [TOUGH, MOVE], name: 'r4',
		});

		const rc1 = await shard.runPlayer('p1', code`
			Game.getObjectById(${healerId}).rangedHeal(Game.getObjectById(${t1}))
		`);
		expect(rc1).toBe(OK);

		const rc3 = await shard.runPlayer('p1', code`
			Game.getObjectById(${healerId}).rangedHeal(Game.getObjectById(${t3}))
		`);
		expect(rc3).toBe(OK);

		const rc4 = await shard.runPlayer('p1', code`
			Game.getObjectById(${healerId}).rangedHeal(Game.getObjectById(${t4}))
		`);
		expect(rc4).toBe(ERR_NOT_IN_RANGE);
	});

	test('COMBAT-RANGEDHEAL-003 rangedHeal takes priority over rangedAttack when both queue in the same tick', async ({ shard }) => {
		// Engine: @screeps/engine/dist/processor/intents/creeps/intents.js — the priorities
		// table lists `rangedAttack: ['rangedMassAttack', 'build', 'repair', 'rangedHeal']`.
		// When rangedHeal exists in the same tick, rangedAttack is suppressed and does not
		// run. Both runtime calls return OK; only rangedHeal applies its effect.
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const dualId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [RANGED_ATTACK, HEAL, MOVE, TOUGH, TOUGH, MOVE],
		});
		// Friendly to heal — pre-damaged via an attacker.
		const friendlyId = await shard.placeCreep('W1N1', {
			pos: [25, 27], owner: 'p1',
			body: [...body(3, TOUGH), MOVE],
		});
		const enemyId = await shard.placeCreep('W1N1', {
			pos: [27, 25], owner: 'p2',
			body: [...body(3, TOUGH), MOVE],
		});
		const damagerId = await shard.placeCreep('W1N1', {
			pos: [25, 28], owner: 'p2',
			body: [ATTACK, MOVE],
		});
		await shard.tick();

		// Damage the friendly so the heal will be observable.
		const dmgRc = await shard.runPlayer('p2', code`
			Game.getObjectById(${damagerId}).attack(Game.getObjectById(${friendlyId}))
		`);
		expect(dmgRc).toBe(OK);
		await shard.tick();

		const friendlyMid = await shard.expectObject(friendlyId, 'creep');
		const friendlyHitsAfterAttack = friendlyMid.hits;
		const enemyMid = await shard.expectObject(enemyId, 'creep');
		const enemyHitsBefore = enemyMid.hits;

		// Now p1's dual creep submits both intents in the same tick.
		const rc = await shard.runPlayer('p1', code`
			const c = Game.getObjectById(${dualId});
			const h = c.rangedHeal(Game.getObjectById(${friendlyId}));
			const a = c.rangedAttack(Game.getObjectById(${enemyId}));
			[h, a]
		`) as [number, number];
		expect(rc[0]).toBe(OK);
		expect(rc[1]).toBe(OK);
		await shard.tick();

		// rangedHeal applied: friendly is healed.
		const friendlyAfter = await shard.expectObject(friendlyId, 'creep');
		expect(friendlyAfter.hits).toBe(friendlyHitsAfterAttack + RANGED_HEAL_POWER);

		// rangedAttack suppressed by priority: enemy is unchanged.
		const enemyAfter = await shard.expectObject(enemyId, 'creep');
		expect(enemyAfter.hits).toBe(enemyHitsBefore);
	});

	test('COMBAT-RANGEDHEAL-004 rangedHeal returns ERR_NOT_IN_RANGE beyond range 3', async ({ shard }) => {
		// Engine game/creeps.js:725-727 — rangedHeal uses `inRangeTo(target, 3)`.
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const healerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [HEAL, MOVE],
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 29], owner: 'p1', // range 4
			body: [TOUGH, MOVE],
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${healerId}).rangedHeal(Game.getObjectById(${targetId}))
		`);
		expect(rc).toBe(ERR_NOT_IN_RANGE);
	});

	test('COMBAT-RANGEDHEAL-005 rangedHeal returns ERR_NO_BODYPART without HEAL parts', async ({ shard }) => {
		// Engine game/creeps.js:714-716 — body check runs before range check.
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const healerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [MOVE, CARRY],
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 27], owner: 'p1',
			body: [TOUGH, MOVE],
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${healerId}).rangedHeal(Game.getObjectById(${targetId}))
		`);
		expect(rc).toBe(ERR_NO_BODYPART);
	});

	for (const row of combatRangedHealValidationCases) {
		test(`COMBAT-RANGEDHEAL-006:${row.label} rangedHeal() validation returns the canonical code`, async ({ shard }) => {
			const blockers = new Set(row.blockers);
			const owner = blockers.has('not-owner') ? 'p2' : 'p1';
			const roomOwner = owner === 'p2' && blockers.has('busy') ? 'p2' : 'p1';
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [{ name: 'W1N1', rcl: 1, owner: roomOwner }],
			});

			const healerId = blockers.has('busy')
				? await spawnBusyCreep(shard, {
					owner,
					observerOwner: owner === 'p2' ? 'p1' : undefined,
					body: blockers.has('no-bodypart') ? [MOVE] : [HEAL, MOVE],
				})
				: await shard.placeCreep('W1N1', {
					pos: [25, 25],
					owner,
					body: blockers.has('no-bodypart') ? [MOVE] : [HEAL, MOVE],
				});
			const targetId = blockers.has('invalid-target')
				? await shard.placeSource('W1N1', { pos: blockers.has('range') ? [30, 30] : [25, 28] })
				: await shard.placeCreep('W1N1', {
					pos: blockers.has('range') ? [30, 30] : [25, 28],
					owner,
					body: [TOUGH, MOVE],
				});

			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${healerId}).rangedHeal(Game.getObjectById(${targetId}))
			`);
			expect(rc).toBe(row.expectedRc);
		});
	}
});
