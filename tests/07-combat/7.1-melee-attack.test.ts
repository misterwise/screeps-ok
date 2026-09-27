import { describe, test, expect, code, OK, ERR_NOT_IN_RANGE, MOVE, ATTACK, TOUGH, RANGED_ATTACK, HEAL, body, ATTACK_POWER, RANGED_ATTACK_POWER, HEAL_POWER, RANGED_HEAL_POWER, BODYPART_HITS, STRUCTURE_EXTENSION, STRUCTURE_RAMPART, SAFE_MODE_DURATION,
	PWR_GENERATE_OPS, RAMPART_HITS_MAX, EXTENSION_HITS, STRUCTURE_WALL, WALL_HITS,
} from '../../src/index.js';
import type { ShardFixture } from '../../src/fixture.js';
import { staleArgumentCases } from '../../src/matrices/stale-argument.js';
import { expectStaleArgumentRejected } from '../intent-validation-helpers.js';

const staleAttackCase = staleArgumentCases.find(row => row.key === 'creepAttackCreep')!;
const staleHealCase = staleArgumentCases.find(row => row.key === 'creepHeal')!;
const staleRangedAttackCase = staleArgumentCases.find(row => row.key === 'creepRangedAttack')!;
const staleRangedHealCase = staleArgumentCases.find(row => row.key === 'creepRangedHeal')!;
import { combatHealValidationCases } from '../../src/matrices/combat-heal-validation.js';
import { combatMeleeValidationCases } from '../../src/matrices/combat-melee-validation.js';
import { combatRangedValidationCases } from '../../src/matrices/combat-ranged-validation.js';
import { combatRangedHealValidationCases } from '../../src/matrices/combat-rangedheal-validation.js';
import { spawnBusyCreep } from '../intent-validation-helpers.js';

describe('creep.attack()', () => {
	test('COMBAT-MELEE-001 each ATTACK part deals ATTACK_POWER damage', async ({ shard }) => {
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

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
		`);
		expect(rc).toBe(OK);
		const target = await shard.expectObject(targetId, 'creep');
		expect(target.hits).toBe(10 * BODYPART_HITS - 3 * ATTACK_POWER);
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

	for (const onRampart of ['creep', 'structure'] as const) {
		test(`COMBAT-MELEE-005:${onRampart} attack on a ${onRampart} under a rampart hits the rampart instead`, async ({ shard }) => {
			// Vanilla creeps/attack.js:33-36 swaps in any rampart on the target's tile.
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [
					{ name: 'W1N1', rcl: 3, owner: 'p1' },
					{ name: 'W2N1', rcl: 1, owner: 'p2' },
				],
			});
			const rampartHits = RAMPART_HITS_MAX[3];
			const rampartId = await shard.placeStructure('W1N1', {
				pos: [25, 26], structureType: STRUCTURE_RAMPART, owner: 'p1',
				hits: rampartHits,
			});
			const targetId = onRampart === 'creep'
				? await shard.placeCreep('W1N1', { pos: [25, 26], owner: 'p1', body: body(5, TOUGH, MOVE) })
				: await shard.placeStructure('W1N1', { pos: [25, 26], structureType: STRUCTURE_EXTENSION, owner: 'p1' });
			const attackerId = await shard.placeCreep('W1N1', {
				pos: [25, 25], owner: 'p2',
				body: [ATTACK, MOVE],
			});
			const rc = await shard.runPlayer('p2', code`
				Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
			`);
			expect(rc).toBe(OK);
			const rampart = await shard.expectStructure(rampartId, STRUCTURE_RAMPART);
			expect(rampart.hits).toBe(rampartHits - ATTACK_POWER);
			expect(onRampart === 'creep'
				? (await shard.expectObject(targetId, 'creep')).hits
				: (await shard.expectStructure(targetId, STRUCTURE_EXTENSION)).hits,
			).toBe(onRampart === 'creep' ? 6 * BODYPART_HITS : EXTENSION_HITS);
		});
	}

	for (const attackerOnRampart of [false, true]) {
		test(`COMBAT-MELEE-006:${attackerOnRampart ? 'attackerOnRampart' : 'counterDamage'} the target's ATTACK parts hit back ${attackerOnRampart ? 'unless a rampart stands on the attacker\'s tile' : 'after a melee attack'}`, async ({ shard }) => {
			// Vanilla _damage.js:17-19 skips the hit-back when any rampart is on the
			// attacker's tile; here it is the target owner's, as a public one would be.
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [{ name: 'W1N1', rcl: 3, owner: 'p1' }],
			});
			if (attackerOnRampart) {
				await shard.placeStructure('W1N1', {
					pos: [25, 25], structureType: STRUCTURE_RAMPART, owner: 'p2', hits: RAMPART_HITS_MAX[3],
				});
			}
			const attackerId = await shard.placeCreep('W1N1', {
				pos: [25, 25], owner: 'p1',
				body: [ATTACK, MOVE, ...body(3, TOUGH), MOVE],
			});
			const targetId = await shard.placeCreep('W1N1', {
				pos: [25, 26], owner: 'p2',
				body: [ATTACK, MOVE, ...body(3, TOUGH), MOVE],
			});

			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
			`);
			expect(rc).toBe(OK);
			expect((await shard.expectObject(targetId, 'creep')).hits).toBe(6 * BODYPART_HITS - ATTACK_POWER);
			expect((await shard.expectObject(attackerId, 'creep')).hits)
				.toBe(6 * BODYPART_HITS - (attackerOnRampart ? 0 : ATTACK_POWER));
		});
	}

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

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
		`);
		expect(rc).toBe(OK);
		const attacker = await shard.expectObject(attackerId, 'creep');
		expect(attacker.hits).toBe(12 * BODYPART_HITS - 3 * ATTACK_POWER);
	});

	for (const target of ['creep', 'powerCreep', 'structure'] as const) {
		test(`COMBAT-MELEE-007:${target} attack accepts a ${target} target`, async ({ shard }) => {
			const ids = await placeTarget(shard, target, [ATTACK, MOVE], [25, 26]);
			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${ids.actor}).attack(Game.getObjectById(${ids.target}))
			`);
			expect(rc).toBe(OK);
		});
	}

	for (const row of combatMeleeValidationCases) {
		test(`COMBAT-MELEE-009:${row.label} attack() validation returns the canonical code`, async ({ shard }) => {
			const blockers = shard.validationBlockers(row);
			const owner = blockers.has('not-owner') ? 'p2' : 'p1';
			// Safe mode is p2's, in p2's room; p1 keeps a creep there to see.
			const safeMode = blockers.has('safe-mode');
			const roomOwner = safeMode || owner === 'p2' && blockers.has('busy') ? 'p2' : 'p1';
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [{ name: 'W1N1', rcl: 1, owner: roomOwner, ...(safeMode ? { safeMode: SAFE_MODE_DURATION } : {}) }],
			});
			if (safeMode && owner === 'p2') {
				await shard.placeCreep('W1N1', { pos: [20, 20], owner: 'p1', body: [MOVE] });
			}

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

	test(`${staleAttackCase.catalogId}:${staleAttackCase.label} creep.attack() rejects a stale cached Creep target`, async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [ATTACK, MOVE],
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2', body: [TOUGH, MOVE],
		});
		await shard.tick();

		// p1 caches the hostile target wrapper. p2 suicides the target in the
		// same tick — runPlayers preserves same-tick observation, so p1 sees the
		// live target while it captures the wrapper.
		await shard.runPlayers({
			p1: code`
				globalThis.__screepsOkStaleArgAttackTarget = Game.getObjectById(${targetId});
				null
			`,
			p2: code`Game.getObjectById(${targetId}).suicide()`,
		});
		expect(await shard.getObject(targetId)).toBeNull();

		await expectStaleArgumentRejected(shard, 'p1', staleAttackCase, code`
			Game.getObjectById(${attackerId}).attack(globalThis.__screepsOkStaleArgAttackTarget)
		`);
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
		const target = await shard.expectObject(targetId, 'creep');
		expect(target.hits).toBe(6 * BODYPART_HITS - RANGED_ATTACK_POWER);
	});

	test('COMBAT-RANGED-003 rangedAttack accepts targets at range 1 through 3, ERR_NOT_IN_RANGE at range 4', async ({ shard }) => {
		// Vanilla game/creeps.js:645: `!this.pos.inRangeTo(target, 3)`.
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [RANGED_ATTACK, MOVE],
		});
		const targetIds = [];
		for (let range = 1; range <= 4; range++) {
			targetIds.push(await shard.placeCreep('W1N1', {
				pos: [25, 25 + range], owner: 'p2', body: [TOUGH, MOVE], name: `r${range}`,
			}));
		}

		const rcs = await shard.runPlayer('p1', code`
			const attacker = Game.getObjectById(${attackerId});
			${targetIds}.map(id => attacker.rangedAttack(Game.getObjectById(id)))
		`);
		expect(rcs).toEqual([OK, OK, OK, ERR_NOT_IN_RANGE]);
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
		const rampartHits = RAMPART_HITS_MAX[3];
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
		const rampart = await shard.expectStructure(rampartId, STRUCTURE_RAMPART);
		expect(rampart.hits).toBe(rampartHits - RANGED_ATTACK_POWER);
		const target = await shard.expectObject(targetId, 'creep');
		expect(target.hits).toBe(6 * BODYPART_HITS);
	});

	for (const target of ['creep', 'powerCreep', 'structure'] as const) {
		test(`COMBAT-RANGED-005:${target} rangedAttack accepts a ${target} target`, async ({ shard }) => {
			const ids = await placeTarget(shard, target, [RANGED_ATTACK, MOVE], [25, 28]);
			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${ids.actor}).rangedAttack(Game.getObjectById(${ids.target}))
			`);
			expect(rc).toBe(OK);
		});
	}

	for (const row of combatRangedValidationCases) {
		test(`COMBAT-RANGED-007:${row.label} rangedAttack() validation returns the canonical code`, async ({ shard }) => {
			const blockers = shard.validationBlockers(row);
			const owner = blockers.has('not-owner') ? 'p2' : 'p1';
			// Safe mode is p2's, in p2's room; p1 keeps a creep there to see.
			const safeMode = blockers.has('safe-mode');
			const roomOwner = safeMode || owner === 'p2' && blockers.has('busy') ? 'p2' : 'p1';
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [{ name: 'W1N1', rcl: 1, owner: roomOwner, ...(safeMode ? { safeMode: SAFE_MODE_DURATION } : {}) }],
			});
			if (safeMode && owner === 'p2') {
				await shard.placeCreep('W1N1', { pos: [20, 20], owner: 'p1', body: [MOVE] });
			}

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

	test(`${staleRangedAttackCase.catalogId}:${staleRangedAttackCase.label} creep.rangedAttack() rejects a stale cached Creep target`, async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [RANGED_ATTACK, MOVE],
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 27], owner: 'p2', body: [TOUGH, MOVE],
		});
		await shard.tick();

		await shard.runPlayers({
			p1: code`
				globalThis.__screepsOkStaleArgRangedAttackTarget = Game.getObjectById(${targetId});
				null
			`,
			p2: code`Game.getObjectById(${targetId}).suicide()`,
		});
		expect(await shard.getObject(targetId)).toBeNull();

		await expectStaleArgumentRejected(shard, 'p1', staleRangedAttackCase, code`
			Game.getObjectById(${attackerId}).rangedAttack(globalThis.__screepsOkStaleArgRangedAttackTarget)
		`);
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

		const attackRc = await shard.runPlayer('p2', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
		`);
		expect(attackRc).toBe(OK);
		const injured = await shard.expectObject(targetId, 'creep');
		expect(injured.hits).toBe(4 * BODYPART_HITS - ATTACK_POWER);

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${healerId}).heal(Game.getObjectById(${targetId}))
		`);
		expect(rc).toBe(OK);

		const target = await shard.expectObject(targetId, 'creep');
		expect(target.hits).toBe(4 * BODYPART_HITS - ATTACK_POWER + HEAL_POWER);
	});

	test('COMBAT-HEAL-002 heal range is exactly 1: OK adjacent, ERR_NOT_IN_RANGE at range 2', async ({ shard }) => {
		// Vanilla game/creeps.js:694: `!target.pos.isNearTo(this.pos)`.
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const healerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [HEAL, MOVE],
		});
		const adjacentId = await shard.placeCreep('W1N1', {
			pos: [26, 26], owner: 'p1', body: [TOUGH, MOVE], name: 'adjacent',
		});
		const farId = await shard.placeCreep('W1N1', {
			pos: [25, 27], owner: 'p1', body: [TOUGH, MOVE], name: 'far',
		});

		const rcs = await shard.runPlayer('p1', code`
			const healer = Game.getObjectById(${healerId});
			[healer.heal(Game.getObjectById(${adjacentId})), healer.heal(Game.getObjectById(${farId}))]
		`);
		expect(rcs).toEqual([OK, ERR_NOT_IN_RANGE]);
	});

	for (const target of ['creep', 'powerCreep'] as const) {
		test(`COMBAT-HEAL-003:${target} heal accepts an own or hostile ${target} target`, async ({ shard }) => {
			// Vanilla game/creeps.js:689-693 checks the target's type only.
			if (target === 'powerCreep') shard.requires('powerCreeps');
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
			const place = (owner: string, pos: [number, number], name: string) => target === 'creep'
				? shard.placeCreep('W1N1', { pos, owner, body: body(3, TOUGH, MOVE), name })
				: shard.placePowerCreep('W1N1', { pos, owner, name, powers: { [PWR_GENERATE_OPS]: 1 } });
			const ownId = await place('p1', [25, 26], 'Own');
			const hostileId = await place('p2', [24, 25], 'Hostile');

			const rcs = await shard.runPlayer('p1', code`
				const healer = Game.getObjectById(${healerId});
				[healer.heal(Game.getObjectById(${ownId})), healer.heal(Game.getObjectById(${hostileId}))]
			`);
			expect(rcs).toEqual([OK, OK]);
		});
	}

	for (const row of combatHealValidationCases) {
		test(`COMBAT-HEAL-007:${row.label} heal() validation returns the canonical code`, async ({ shard }) => {
			const blockers = shard.validationBlockers(row);
			const owner = blockers.has('not-owner') ? 'p2' : 'p1';
			// Safe mode is p2's, in p2's room; p1 keeps a creep there to see.
			const safeMode = blockers.has('safe-mode');
			const roomOwner = safeMode || owner === 'p2' && blockers.has('busy') ? 'p2' : 'p1';
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [{ name: 'W1N1', rcl: 1, owner: roomOwner, ...(safeMode ? { safeMode: SAFE_MODE_DURATION } : {}) }],
			});
			if (safeMode && owner === 'p2') {
				await shard.placeCreep('W1N1', { pos: [20, 20], owner: 'p1', body: [MOVE] });
			}

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

		const attackRc = await shard.runPlayer('p2', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
		`);
		expect(attackRc).toBe(OK);
		const injured = await shard.expectObject(targetId, 'creep');
		expect(injured.hits).toBe(3 * BODYPART_HITS - ATTACK_POWER);

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${healerId}).rangedHeal(Game.getObjectById(${targetId}))
		`);
		expect(rc).toBe(OK);

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
		expect(rc).toEqual([OK, OK]);

		// rangedHeal applied: friendly is healed.
		const friendlyAfter = await shard.expectObject(friendlyId, 'creep');
		expect(friendlyAfter.hits).toBe(friendlyHitsAfterAttack + RANGED_HEAL_POWER);

		// rangedAttack suppressed by priority: enemy is unchanged.
		const enemyAfter = await shard.expectObject(enemyId, 'creep');
		expect(enemyAfter.hits).toBe(enemyHitsBefore);
	});

	for (const row of combatRangedHealValidationCases) {
		test(`COMBAT-RANGEDHEAL-006:${row.label} rangedHeal() validation returns the canonical code`, async ({ shard }) => {
			const blockers = shard.validationBlockers(row);
			const owner = blockers.has('not-owner') ? 'p2' : 'p1';
			// Safe mode is p2's, in p2's room; p1 keeps a creep there to see.
			const safeMode = blockers.has('safe-mode');
			const roomOwner = safeMode || owner === 'p2' && blockers.has('busy') ? 'p2' : 'p1';
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [{ name: 'W1N1', rcl: 1, owner: roomOwner, ...(safeMode ? { safeMode: SAFE_MODE_DURATION } : {}) }],
			});
			if (safeMode && owner === 'p2') {
				await shard.placeCreep('W1N1', { pos: [20, 20], owner: 'p1', body: [MOVE] });
			}

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

	test(`${staleHealCase.catalogId}:${staleHealCase.label} creep.heal() rejects a stale cached Creep target`, async ({ shard }) => {
		await shard.ownedRoom('p1');
		const healerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [HEAL, MOVE],
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1', body: [TOUGH, MOVE], name: 'HealTarget',
		});
		await shard.tick();

		const rc1 = await shard.runPlayer('p1', code`
			globalThis.__screepsOkStaleArgHealTarget = Game.getObjectById(${targetId});
			globalThis.__screepsOkStaleArgHealTarget.suicide()
		`);
		expect(rc1).toBe(OK);
		expect(await shard.getObject(targetId)).toBeNull();

		await expectStaleArgumentRejected(shard, 'p1', staleHealCase, code`
			Game.getObjectById(${healerId}).heal(globalThis.__screepsOkStaleArgHealTarget)
		`);
	});

	test(`${staleRangedHealCase.catalogId}:${staleRangedHealCase.label} creep.rangedHeal() rejects a stale cached Creep target`, async ({ shard }) => {
		await shard.ownedRoom('p1');
		const healerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [HEAL, MOVE],
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 27], owner: 'p1', body: [TOUGH, MOVE], name: 'RangedHealTarget',
		});
		await shard.tick();

		const rc1 = await shard.runPlayer('p1', code`
			globalThis.__screepsOkStaleArgRangedHealTarget = Game.getObjectById(${targetId});
			globalThis.__screepsOkStaleArgRangedHealTarget.suicide()
		`);
		expect(rc1).toBe(OK);
		expect(await shard.getObject(targetId)).toBeNull();

		await expectStaleArgumentRejected(shard, 'p1', staleRangedHealCase, code`
			Game.getObjectById(${healerId}).rangedHeal(globalThis.__screepsOkStaleArgRangedHealTarget)
		`);
	});
});

// A p1 actor at (25, 25) and a target of the given class at `targetPos`: a p2
// creep or power creep, or an unowned wall.
async function placeTarget(
	shard: ShardFixture, target: 'creep' | 'powerCreep' | 'structure', actorBody: string[], targetPos: [number, number],
): Promise<{ actor: string; target: string }> {
	if (target === 'powerCreep') shard.requires('powerCreeps');
	await shard.createShard({
		players: ['p1', 'p2'],
		rooms: [
			{ name: 'W1N1', rcl: 1, owner: 'p1' },
			{ name: 'W2N1', rcl: 1, owner: 'p2' },
		],
	});
	const actor = await shard.placeCreep('W1N1', { pos: [25, 25], owner: 'p1', body: actorBody });
	const targetId = target === 'creep'
		? await shard.placeCreep('W1N1', { pos: targetPos, owner: 'p2', body: [TOUGH, MOVE] })
		: target === 'powerCreep'
			? await shard.placePowerCreep('W1N1', { pos: targetPos, owner: 'p2', powers: { [PWR_GENERATE_OPS]: 1 } })
			: await shard.placeStructure('W1N1', { pos: targetPos, structureType: STRUCTURE_WALL, hits: WALL_HITS });
	return { actor, target: targetId };
}
