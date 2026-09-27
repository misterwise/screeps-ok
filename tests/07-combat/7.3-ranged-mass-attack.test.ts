import { describe, test, expect, code, OK, MOVE, TOUGH, RANGED_ATTACK, RANGED_ATTACK_POWER, RANGED_ATTACK_DISTANCE_RATE, STRUCTURE_RAMPART, STRUCTURE_ROAD, STRUCTURE_SPAWN, BODYPART_HITS, SAFE_MODE_DURATION, body,
	PWR_GENERATE_OPS, RAMPART_HITS_MAX, ROAD_HITS, SPAWN_HITS,
} from '../../src/index.js';

const rmaDamage = (range: number) => Math.round(RANGED_ATTACK_POWER * RANGED_ATTACK_DISTANCE_RATE[range]);
import { combatRmaValidationCases } from '../../src/matrices/combat-rma-validation.js';
import { rangedMassAttackRangeCases } from '../../src/matrices/ranged-mass-attack.js';
import { spawnBusyCreep } from '../intent-validation-helpers.js';

describe('creep.rangedMassAttack()', () => {
	for (const { range, expectedDamage } of rangedMassAttackRangeCases) {
		test(`COMBAT-RMA-002:range${range} rangedMassAttack() deals the expected per-range damage`, async ({ shard }) => {
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
			const target = await shard.expectObject(targetId, 'creep');
			expect(target.hits).toBe(6 * BODYPART_HITS - expectedDamage);
		});
	}

	test('COMBAT-RMA-001 rangedMassAttack() damages every hostile creep, power creep and structure within range 3 in one call', async ({ shard }) => {
		shard.requires('powerCreeps');
		// p2 attacks in p1's room: p1's creep at range 1, power creep at range 2,
		// spawn at range 3, and a creep at range 4 that stays whole.
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p2',
			body: [RANGED_ATTACK, MOVE],
		});
		const creepId = await shard.placeCreep('W1N1', { pos: [25, 26], owner: 'p1', body: body(3, TOUGH, MOVE), name: 'near' });
		const powerCreepId = await shard.placePowerCreep('W1N1', { pos: [27, 25], owner: 'p1', powers: { [PWR_GENERATE_OPS]: 1 } });
		const spawnId = await shard.placeStructure('W1N1', { pos: [25, 22], structureType: STRUCTURE_SPAWN, owner: 'p1' });
		const farId = await shard.placeCreep('W1N1', { pos: [29, 25], owner: 'p1', body: body(3, TOUGH, MOVE), name: 'far' });

		const rc = await shard.runPlayer('p2', code`
			Game.getObjectById(${attackerId}).rangedMassAttack()
		`);
		expect(rc).toBe(OK);
		expect({
			creep: (await shard.expectObject(creepId, 'creep')).hits,
			spawn: (await shard.expectStructure(spawnId, STRUCTURE_SPAWN)).hits,
			far: (await shard.expectObject(farId, 'creep')).hits,
		}).toEqual({
			creep: 4 * BODYPART_HITS - rmaDamage(1),
			spawn: SPAWN_HITS - rmaDamage(3),
			far: 4 * BODYPART_HITS,
		});
		// Power creeps have no snapshot; the next tick reads what this one left.
		const powerCreep = await shard.runPlayer('p1', code`
			const powerCreep = Game.getObjectById(${powerCreepId});
			[powerCreep.hits, powerCreep.hitsMax]
		`) as [number, number];
		expect(powerCreep[0]).toBe(powerCreep[1] - rmaDamage(2));
	});

	test('COMBAT-RMA-003 rangedMassAttack() does not damage own creeps or unowned structures', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [RANGED_ATTACK, MOVE],
		});
		// Friendly creep at range 1
		const friendlyId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: body(3, TOUGH, MOVE),
		});
		// Unowned road at range 1
		const roadId = await shard.placeStructure('W1N1', {
			pos: [26, 25], structureType: STRUCTURE_ROAD,
		});
		// Hostile creep at range 2 to confirm the attack actually fires
		const hostileId = await shard.placeCreep('W1N1', {
			pos: [25, 27], owner: 'p2',
			body: body(3, TOUGH, MOVE),
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).rangedMassAttack()
		`);
		expect(rc).toBe(OK);

		const friendly = await shard.expectObject(friendlyId, 'creep');
		expect(friendly.hits).toBe(4 * BODYPART_HITS);

		const road = await shard.expectStructure(roadId, STRUCTURE_ROAD);
		expect(road.hits).toBe(ROAD_HITS);

		// Hostile took damage, proving the attack resolved
		const hostile = await shard.expectObject(hostileId, 'creep');
		expect(hostile.hits).toBe(4 * BODYPART_HITS - rmaDamage(2));
	});

	test('COMBAT-RMA-004 rangedMassAttack damage to a creep under a hostile rampart redirects to the rampart', async ({ shard }) => {
		// Engine rangedMassAttack.js:38-40 — a non-rampart target on a rampart
		// tile is filtered out; the rampart itself (owned by a different user)
		// remains in the targets list and takes the range-banded damage.
		// xxscreeps lacks this redirect (known `rampart-no-protection` gap).
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
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: body(5, TOUGH, MOVE),
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p2',
			body: [RANGED_ATTACK, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p2', code`
			Game.getObjectById(${attackerId}).rangedMassAttack()
		`);
		expect(rc).toBe(OK);

		const rampart = await shard.expectStructure(rampartId, STRUCTURE_RAMPART);
		expect(rampart.hits).toBe(rampartHits - rmaDamage(1));
		const target = await shard.expectObject(targetId, 'creep');
		expect(target.hits).toBe(6 * BODYPART_HITS);
	});

	for (const row of combatRmaValidationCases) {
		test(`COMBAT-RMA-005:${row.label} rangedMassAttack() validation returns the canonical code`, async ({ shard }) => {
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

			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${attackerId}).rangedMassAttack()
			`);
			expect(rc).toBe(row.expectedRc);
		});
	}
});
