import { describe, test, expect, code, OK, MOVE, TOUGH, RANGED_ATTACK, RANGED_ATTACK_POWER, STRUCTURE_RAMPART, STRUCTURE_ROAD, BODYPART_HITS, body } from '../../src/index.js';
import { rangedMassAttackRangeCases } from '../../src/matrices/ranged-mass-attack.js';

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
			pos: [26, 25], structureType: STRUCTURE_ROAD, hits: 5000,
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
		await shard.tick();

		const friendly = await shard.expectObject(friendlyId, 'creep');
		expect(friendly.hits).toBe(400);

		const road = await shard.expectStructure(roadId, STRUCTURE_ROAD);
		expect(road.hits).toBe(5000);

		// Hostile took damage, proving the attack resolved
		const hostile = await shard.expectObject(hostileId, 'creep');
		expect(hostile.hits).toBe(400 - 4);
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
			body: [RANGED_ATTACK, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p2', code`
			Game.getObjectById(${attackerId}).rangedMassAttack()
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const rampart = await shard.expectStructure(rampartId, STRUCTURE_RAMPART);
		expect(rampart.hits).toBe(rampartHits - RANGED_ATTACK_POWER); // range 1 → 10
		const target = await shard.expectObject(targetId, 'creep');
		expect(target.hits).toBe(6 * BODYPART_HITS);
	});
});
