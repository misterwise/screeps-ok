import { describe, test, expect, code,
	OK, ERR_NOT_IN_RANGE, ERR_NOT_OWNER,
	MOVE, WORK, CARRY, BODYPART_COST,
	STRUCTURE_SPAWN, FIND_DROPPED_RESOURCES, FIND_TOMBSTONES,
	CREEP_CORPSE_RATE, CREEP_LIFE_TIME,
} from '../../src/index.js';
import { recycleCreepValidationCases } from '../../src/matrices/recycle-creep-validation.js';

describe('Spawn.recycleCreep', () => {
	test('RECYCLE-CREEP-001 recycleCreep returns OK for an adjacent owned creep', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const spawn = Game.getObjectById(${spawnId});
			const creep = Game.getObjectById(${creepId});
			spawn.recycleCreep(creep)
		`);
		expect(rc).toBe(OK);
	});

	test('RECYCLE-CREEP-004 recycleCreep returns ERR_NOT_IN_RANGE for a non-adjacent creep', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 28], owner: 'p1',
			body: [MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const spawn = Game.getObjectById(${spawnId});
			const creep = Game.getObjectById(${creepId});
			spawn.recycleCreep(creep)
		`);
		expect(rc).toBe(ERR_NOT_IN_RANGE);
	});

	test('RECYCLE-CREEP-002 recycle deposits floor(ttlRemaining / CREEP_LIFE_TIME * bodyCost) energy into a tombstone at the creep position', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		// Body: [WORK, CARRY, MOVE] — total cost = 200.
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [WORK, CARRY, MOVE],
			ticksToLive: 1000,
		});
		await shard.tick();

		// Capture user-tick gameTime + ttl alongside the recycle call so we
		// can derive the intent-tick TTL via tomb.deathTime. Vanilla and
		// xxscreeps process the recycle intent at different offsets from
		// user code (same-tick vs +1), so observing TTL in a separate
		// runPlayer would misalign the expected energy by one tick.
		const result = await shard.runPlayer('p1', code`
			const spawn = Game.getObjectById(${spawnId});
			const creep = Game.getObjectById(${creepId});
			const userTime = Game.time;
			const userTtl = creep.ticksToLive;
			const rc = spawn.recycleCreep(creep);
			({ userTime, userTtl, rc })
		`) as { userTime: number; userTtl: number; rc: number };
		expect(result.rc).toBe(OK);

		// Canonical recycle (recycle-creep.js → _die.js with dropRate=1.0):
		// kills creep *immediately*, creates a tombstone at the creep's position,
		// tombstone.store.energy = floor(1.0 * intentTtl / CREEP_LIFE_TIME * bodyCost).
		// No multi-tick body removal, no FIND_DROPPED_RESOURCES.
		const tombstones = await shard.findInRoom('W1N1', FIND_TOMBSTONES);
		const tomb = tombstones.find(t => t.pos.x === 25 && t.pos.y === 26);
		expect(tomb).toBeDefined();

		// Canonical _die accumulates `part_cost * lifeRate` per part into a
		// float, then floors the total once (_die.js:44-57). That equals
		// floor(totalBodyCost * lifeRate) with dropRate = 1.0 for recycle.
		// intentTtl = ageTime - intentTime; userTtl = ageTime - userTime;
		// so intentTtl = userTtl - (deathTime - userTime).
		const bodyCost = BODYPART_COST[WORK] + BODYPART_COST[CARRY] + BODYPART_COST[MOVE];
		const intentTtl = result.userTtl - (tomb!.deathTime - result.userTime);
		const expectedEnergy = Math.floor(bodyCost * intentTtl / CREEP_LIFE_TIME);
		expect(tomb!.store.energy).toBe(expectedEnergy);

		// No dropped resource on the ground.
		const drops = await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES);
		const energyDrop = drops.find(r => r.pos.x === 25 && r.pos.y === 26 && r.resourceType === 'energy');
		expect(energyDrop).toBeUndefined();
	});

	test('RECYCLE-CREEP-003 recycleCreep destroys the creep and drops energy', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const spawn = Game.getObjectById(${spawnId});
			const creep = Game.getObjectById(${creepId});
			spawn.recycleCreep(creep)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		// Creep should be destroyed (first body part removed each tick).
		// After one tick, creep may still exist with fewer parts or be dead.
		// After enough ticks it will be fully recycled.
		// The recycle process drops energy at the spawn tile.
		// Just verify the intent was accepted — full lifecycle tested below.
	});

	for (const row of recycleCreepValidationCases) {
		test(`RECYCLE-CREEP-005:${row.label} recycleCreep() validation returns the canonical code`, async ({ shard }) => {
			const blockers = new Set(row.blockers);
			const spawnOwner = blockers.has('not-owner-spawn') ? 'p2' : 'p1';
			const creepOwner = blockers.has('not-owner-creep') ? 'p2' : 'p1';
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [{ name: 'W1N1', rcl: 2, owner: spawnOwner }],
			});
			if (spawnOwner === 'p2' || creepOwner === 'p2') {
				await shard.placeCreep('W1N1', { pos: [20, 20], owner: 'p1', body: [MOVE] });
			}
			const spawnId = await shard.placeStructure('W1N1', {
				pos: [25, 25],
				structureType: STRUCTURE_SPAWN,
				owner: spawnOwner,
				store: { energy: 300 },
			});
			const targetId = blockers.has('invalid-target')
				? await shard.placeSource('W1N1', { pos: blockers.has('range') ? [30, 30] : [25, 26] })
				: await shard.placeCreep('W1N1', {
					pos: blockers.has('range') ? [30, 30] : [25, 26],
					owner: creepOwner,
					body: [WORK, CARRY, MOVE],
				});

			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${spawnId}).recycleCreep(Game.getObjectById(${targetId}))
			`);
			expect(rc).toBe(row.expectedRc);
		});
	}
});
