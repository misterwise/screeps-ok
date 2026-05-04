import { describe, test, expect, code, body,
	OK, ERR_NOT_IN_RANGE, ERR_NOT_ENOUGH_RESOURCES, ERR_NO_BODYPART,
	WORK, CARRY, MOVE, STRUCTURE_ROAD, REPAIR_POWER, REPAIR_COST, ROAD_HITS } from '../../src/index.js';
import { repairValidationCases } from '../../src/matrices/repair-validation.js';
import { spawnBusyCreep } from '../intent-validation-helpers.js';

describe('creep.repair()', () => {
	test('REPAIR-001 repairs REPAIR_POWER HP per WORK part per tick', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
			store: { energy: 50 },
		});
		const roadId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_ROAD,
			hits: 100, // damaged (max 5000)
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).repair(Game.getObjectById(${roadId}))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const road = await shard.expectObject(roadId, 'structure');
		expect(road.hits).toBe(100 + REPAIR_POWER);
	});

	test('REPAIR-002 repairing spends 1 energy per REPAIR_POWER hits repaired', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
			store: { energy: 50 },
		});
		const roadId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_ROAD,
			hits: 100,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).repair(Game.getObjectById(${roadId}))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		// Repair costs 1 energy per REPAIR_POWER hits repaired (1 WORK = 1 energy/tick)
		expect(creep.store.energy).toBe(49);
	});

	test('REPAIR-003 returns ERR_NOT_IN_RANGE when too far', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [10, 10], owner: 'p1',
			body: [WORK, CARRY, MOVE],
			store: { energy: 50 },
		});
		const roadId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_ROAD, hits: 100,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).repair(Game.getObjectById(${roadId}))
		`);
		expect(rc).toBe(ERR_NOT_IN_RANGE);
	});

	test('REPAIR-004 returns ERR_NOT_ENOUGH_RESOURCES without energy', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		const roadId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_ROAD, hits: 100,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).repair(Game.getObjectById(${roadId}))
		`);
		expect(rc).toBe(ERR_NOT_ENOUGH_RESOURCES);
	});

	test('REPAIR-005 repair() succeeds at Chebyshev range 3 and fails at range 4', async ({ shard }) => {
		// Engine creeps.js:719 — repair uses inRangeTo(target, 3) like build.
		await shard.ownedRoom('p1');
		const nearCreep = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE], store: { energy: 50 },
		});
		const farCreep = await shard.placeCreep('W1N1', {
			pos: [10, 10], owner: 'p1',
			body: [WORK, CARRY, MOVE], store: { energy: 50 },
		});
		const nearRoad = await shard.placeStructure('W1N1', {
			pos: [28, 28], structureType: STRUCTURE_ROAD, hits: 100,
		});
		const farRoad = await shard.placeStructure('W1N1', {
			pos: [14, 14], structureType: STRUCTURE_ROAD, hits: 100,
		});

		const result = await shard.runPlayer('p1', code`({
			rangeThree: Game.getObjectById(${nearCreep}).repair(Game.getObjectById(${nearRoad})),
			rangeFour: Game.getObjectById(${farCreep}).repair(Game.getObjectById(${farRoad})),
		})`) as { rangeThree: number; rangeFour: number };
		expect(result.rangeThree).toBe(OK);
		expect(result.rangeFour).toBe(ERR_NOT_IN_RANGE);
	});

	test('REPAIR-006 repair() does not exceed the structure\'s hitsMax', async ({ shard }) => {
		// Engine repair.js: amount = min(power, hitsMax - hits). A road just
		// 50 below max with a 5-WORK creep cannot be over-repaired.
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: body(5, WORK, CARRY, MOVE),
			store: { energy: 50 },
		});
		const roadId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_ROAD,
			hits: ROAD_HITS - 50, // 50 below max
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).repair(Game.getObjectById(${roadId}))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const road = await shard.expectObject(roadId, 'structure');
		expect(road.hits).toBe(ROAD_HITS); // capped at max, not max + 450
	});

	test('REPAIR-007 returns ERR_NO_BODYPART when the creep has no WORK parts', async ({ shard }) => {
		// Engine creeps.js:709 — body part check precedes the energy check.
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { energy: 50 },
		});
		const roadId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_ROAD, hits: 100,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).repair(Game.getObjectById(${roadId}))
		`);
		expect(rc).toBe(ERR_NO_BODYPART);
	});

	test('REPAIR-009 partial repair when energy is below full repair cost', async ({ shard }) => {
		// Engine repair.js:23-27 — repairEffect = min(repairPower, energy/REPAIR_COST, damage).
		// 3 WORK = 300 repairPower needs 3 energy; stored 2 energy → energy/REPAIR_COST = 200.
		// Effect = 200 hits restored, 2 energy spent.
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: body(3, WORK, CARRY, MOVE),
			store: { energy: 2 },
		});
		const roadId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_ROAD, hits: 500,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).repair(Game.getObjectById(${roadId}))
		`);
		expect(rc).toBe(OK);

		const road = await shard.expectObject(roadId, 'structure');
		const creep = await shard.expectObject(creepId, 'creep');
		const partialHits = Math.floor(2 / REPAIR_COST);
		expect(road.hits).toBe(500 + partialHits);
		expect(creep.store.energy ?? 0).toBe(0);
		// Sanity: full repair would restore 3 × REPAIR_POWER.
		expect(road.hits).toBeLessThan(500 + 3 * REPAIR_POWER);
	});

	test('REPAIR-008 a creep can repair another player\'s structure', async ({ shard }) => {
		// Engine repair.js never checks structure ownership. p1's creep can
		// repair a road that exists on a tile, regardless of who owns the
		// surrounding room. (Catalog uses "any player's" loosely; vanilla
		// has no alliance system, so this is the literal rule.)
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 2, owner: 'p2' },
				{ name: 'W2N1', rcl: 2, owner: 'p1' },
			],
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
			store: { energy: 50 },
		});
		// Road is unowned (no owner field) but located in p2's room.
		const roadId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_ROAD, hits: 100,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).repair(Game.getObjectById(${roadId}))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const road = await shard.expectObject(roadId, 'structure');
		expect(road.hits).toBe(100 + REPAIR_POWER);
	});

	for (const row of repairValidationCases) {
		test(`REPAIR-010:${row.label} repair() validation returns the canonical code`, async ({ shard }) => {
			const blockers = new Set(row.blockers);
			const owner = blockers.has('not-owner') ? 'p2' : 'p1';
			if (owner === 'p2') {
				await shard.createShard({
					players: ['p1', 'p2'],
					rooms: [{ name: 'W1N1', rcl: 2, owner: blockers.has('busy') ? 'p2' : 'p1' }],
				});
				if (!blockers.has('busy')) {
					await shard.placeCreep('W1N1', { pos: [20, 20], owner: 'p1', body: [MOVE] });
				}
			} else {
				await shard.ownedRoom('p1');
			}

			const creepId = blockers.has('busy')
				? await spawnBusyCreep(shard, {
					owner,
					observerOwner: owner === 'p2' ? 'p1' : undefined,
					body: blockers.has('no-bodypart') ? [CARRY, MOVE] : [WORK, CARRY, MOVE],
				})
				: await shard.placeCreep('W1N1', {
					pos: [25, 25],
					owner,
					body: blockers.has('no-bodypart') ? [CARRY, MOVE] : [WORK, CARRY, MOVE],
					store: blockers.has('not-enough') ? {} : { energy: 50 },
				});
			const targetId = blockers.has('invalid-target')
				? await shard.placeCreep('W1N1', {
					pos: blockers.has('range') ? [30, 30] : [25, 26],
					owner: 'p1',
					body: [MOVE],
				})
				: await shard.placeStructure('W1N1', {
					pos: blockers.has('range') ? [30, 30] : [25, 26],
					structureType: STRUCTURE_ROAD,
					hits: 100,
				});

			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${creepId}).repair(Game.getObjectById(${targetId}))
			`);
			expect(rc).toBe(row.expectedRc);
		});
	}
});
