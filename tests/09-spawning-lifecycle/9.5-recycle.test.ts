import { describe, test, expect, code,
	OK,
	MOVE, WORK, CARRY, ATTACK, BODYPART_COST,
	STRUCTURE_SPAWN, FIND_DROPPED_RESOURCES, FIND_TOMBSTONES,
	CREEP_LIFE_TIME, SPAWN_ENERGY_CAPACITY, LAB_BOOST_ENERGY, LAB_BOOST_MINERAL, RESOURCE_UTRIUM_HYDRIDE,
} from '../../src/index.js';
import { recycleCreepValidationCases } from '../../src/matrices/recycle-creep-validation.js';
import { staleReceiverCases } from '../../src/matrices/stale-receiver.js';
import { staleArgumentCases } from '../../src/matrices/stale-argument.js';
import { expectStaleArgumentRejected, spawnBusyCreep } from '../intent-validation-helpers.js';

const staleSpawnRecycleCreepCase = staleReceiverCases.find(row => row.key === 'spawnRecycleCreep')!;
const staleArgSpawnRecycleCreepCase = staleArgumentCases.find(row => row.key === 'spawnRecycleCreep')!;

describe('Spawn.recycleCreep', () => {
	test('RECYCLE-CREEP-001 recycleCreep destroys an adjacent owned creep in the tick it is called', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: SPAWN_ENERGY_CAPACITY },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).recycleCreep(Game.getObjectById(${creepId}))
		`);
		expect(rc).toBe(OK);
		expect(await shard.getObject(creepId)).toBeNull();
	});

	// A tick of difference moves these floors: 2/15 energy per tick for a
	// 200-cost body, a TTL of half a lifetime.
	const ticksToLive = CREEP_LIFE_TIME / 2;

	test('RECYCLE-CREEP-002 recycling leaves floor(remaining TTL / CREEP_LIFE_TIME × body cost) energy in a tombstone', async ({ shard }) => {
		// Vanilla spawns/recycle-creep.js:22 kills at drop rate 1.0, not
		// CREEP_CORPSE_RATE (creeps/_die.js:42-57).
		await shard.ownedRoom('p1', 'W1N1', 2);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: SPAWN_ENERGY_CAPACITY },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [WORK, CARRY, MOVE],
			ticksToLive,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).recycleCreep(Game.getObjectById(${creepId}))
		`);
		expect(rc).toBe(OK);
		const bodyCost = BODYPART_COST[WORK] + BODYPART_COST[CARRY] + BODYPART_COST[MOVE];
		const tombstones = await shard.findInRoom('W1N1', FIND_TOMBSTONES);
		expect(tombstones.map(t => ({ pos: [t.pos.x, t.pos.y], store: t.store })))
			.toEqual([{ pos: [25, 26], store: { energy: Math.floor(bodyCost * ticksToLive / CREEP_LIFE_TIME) } }]);
		expect(await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES)).toEqual([]);
	});

	test('RECYCLE-CREEP-003 recycling a boosted creep returns its boost compound and energy with the body', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: SPAWN_ENERGY_CAPACITY },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [ATTACK, MOVE],
			boosts: { 0: RESOURCE_UTRIUM_HYDRIDE },
			ticksToLive,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).recycleCreep(Game.getObjectById(${creepId}))
		`);
		expect(rc).toBe(OK);
		// Each boosted part returns LAB_BOOST_MINERAL and LAB_BOOST_ENERGY at the
		// same rate as the body (creeps/_die.js:44-50).
		const lifeRate = ticksToLive / CREEP_LIFE_TIME;
		const tombstones = await shard.findInRoom('W1N1', FIND_TOMBSTONES);
		expect(tombstones.map(t => t.store)).toEqual([{
			energy: Math.floor((BODYPART_COST[ATTACK] + BODYPART_COST[MOVE] + LAB_BOOST_ENERGY) * lifeRate),
			[RESOURCE_UTRIUM_HYDRIDE]: Math.floor(LAB_BOOST_MINERAL * lifeRate),
		}]);
	});

	test(`${staleSpawnRecycleCreepCase.catalogId}:${staleSpawnRecycleCreepCase.label} stale cached StructureSpawn.recycleCreep() throws a runtime error`, async ({ shard }) => {
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
			globalThis.__screepsOkStaleRecycleSpawn = spawn;
			spawn.destroy()
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const err = await shard.expectRunPlayerError('p1', code`
			const target = Game.getObjectById(${creepId});
			globalThis.__screepsOkStaleRecycleSpawn.recycleCreep(target)
		`, 'runtime');
		expect(err.errorKind).toBe('runtime');
	});

	for (const row of recycleCreepValidationCases) {
		test(`RECYCLE-CREEP-005:${row.label} recycleCreep() validation returns the canonical code`, async ({ shard }) => {
			const blockers = shard.validationBlockers(row);
			const spawnOwner = blockers.has('not-owner-spawn') ? 'p2' : 'p1';
			const creepOwner = blockers.has('not-owner-creep') ? 'p2' : 'p1';
			// A spawning target spawns beside the spawn from a second one, which
			// W1N1 has at RCL 7; where W1N1 can't host it (inactive or another
			// player's) it spawns in its owner's W2N1.
			const spawning = blockers.has('spawning-target');
			const spawnsNearby = spawning && !['not-owner-spawn', 'not-owner-creep', 'rcl'].some(b => blockers.has(b as never));
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [
					// A spawn in a room with no controller level is inactive.
					blockers.has('rcl') ? { name: 'W1N1' } : { name: 'W1N1', rcl: spawnsNearby ? 7 : 2, owner: spawnOwner },
					...(spawning && !spawnsNearby ? [{ name: 'W2N1', rcl: 2, owner: creepOwner }] : []),
				],
			});
			if (spawnOwner === 'p2' || creepOwner === 'p2') {
				await shard.placeCreep('W1N1', { pos: [20, 20], owner: 'p1', body: [MOVE] });
			}
			const spawnId = await shard.placeStructure('W1N1', {
				pos: [25, 25],
				structureType: STRUCTURE_SPAWN,
				owner: spawnOwner,
				store: { energy: SPAWN_ENERGY_CAPACITY },
			});
			const pos: [number, number] = blockers.has('range') ? [30, 30] : [25, 26];
			const targetId = blockers.has('invalid-target')
				? await shard.placeSource('W1N1', { pos })
				: spawning
					? await spawnBusyCreep(shard, spawnsNearby
						? { pos, body: [WORK, CARRY, MOVE], name: 'SpawningTarget' }
						: { roomName: 'W2N1', owner: creepOwner, observerOwner: creepOwner === 'p1' ? undefined : 'p1', body: [WORK, CARRY, MOVE], name: 'SpawningTarget' })
					: await shard.placeCreep('W1N1', {
						pos,
						owner: creepOwner,
						body: [WORK, CARRY, MOVE],
					});
			if (blockers.has('rcl')) await shard.tick();

			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${spawnId}).recycleCreep(Game.getObjectById(${targetId}))
			`);
			expect(rc).toBe(row.expectedRc);
		});
	}

	test(`${staleArgSpawnRecycleCreepCase.catalogId}:${staleArgSpawnRecycleCreepCase.label} StructureSpawn.recycleCreep() rejects a stale cached Creep target`, async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1', body: [WORK, CARRY, MOVE], name: 'RecycleTarget',
		});
		await shard.tick();

		const rc1 = await shard.runPlayer('p1', code`
			globalThis.__screepsOkStaleArgRecycleCreep = Game.getObjectById(${creepId});
			globalThis.__screepsOkStaleArgRecycleCreep.suicide()
		`);
		expect(rc1).toBe(OK);
		expect(await shard.getObject(creepId)).toBeNull();

		await expectStaleArgumentRejected(shard, 'p1', staleArgSpawnRecycleCreepCase, code`
			Game.getObjectById(${spawnId}).recycleCreep(globalThis.__screepsOkStaleArgRecycleCreep)
		`);
	});
});
