import { describe, test, expect, code,
	OK,
	MOVE, WORK, CARRY, CLAIM, BODYPART_COST,
	STRUCTURE_SPAWN,
	CREEP_LIFE_TIME, CREEP_SPAWN_TIME, SPAWN_RENEW_RATIO,
	FIND_DROPPED_RESOURCES, CARRY_CAPACITY, ENERGY_DECAY, SPAWN_ENERGY_CAPACITY, RESOURCE_UTRIUM_HYDRIDE,
} from '../../src/index.js';
import { boostTableCases } from '../../src/matrices/boost-tables.js';
import { renewCreepValidationCases } from '../../src/matrices/renew-creep-validation.js';
import { staleReceiverCases } from '../../src/matrices/stale-receiver.js';
import { staleArgumentCases } from '../../src/matrices/stale-argument.js';
import { expectStaleArgumentRejected, spawnBusyCreep } from '../intent-validation-helpers.js';

const staleSpawnRenewCreepCase = staleReceiverCases.find(row => row.key === 'spawnRenewCreep')!;
const staleArgSpawnRenewCreepCase = staleArgumentCases.find(row => row.key === 'spawnRenewCreep')!;

describe('Spawn.renewCreep', () => {
	test('RENEW-CREEP-002 renewCreep returns OK and increases creep TTL by the per-part renew amount', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: SPAWN_ENERGY_CAPACITY },
		});
		const ticksToLive = 100;
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [MOVE],
			ticksToLive,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).renewCreep(Game.getObjectById(${creepId}))
		`);
		expect(rc).toBe(OK);
		// One body part: well under the CREEP_LIFE_TIME cap; the renew tick ages it once.
		const effect = Math.floor(SPAWN_RENEW_RATIO * CREEP_LIFE_TIME / CREEP_SPAWN_TIME / 1);
		expect((await shard.expectObject(creepId, 'creep')).ticksToLive).toBe(ticksToLive + effect - 1);
	});

	// Above capacity, so the spawn's regeneration (spawns/tick.js:44) doesn't
	// refill part of the charge.
	const renewSpawnEnergy = SPAWN_ENERGY_CAPACITY + 200;
	// The float order of renew-creep.js:33: 1.2 × 200 is 239.999… in IEEE 754.
	const renewCost = (creepBody: string[]) => Math.ceil(SPAWN_RENEW_RATIO
		* creepBody.reduce((sum, part) => sum + BODYPART_COST[part], 0) / CREEP_SPAWN_TIME / creepBody.length);

	test('RENEW-CREEP-003 renewCreep spends the correct energy cost', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: renewSpawnEnergy },
		});
		const creepBody = [WORK, CARRY, MOVE];
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: creepBody,
			ticksToLive: 100,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).renewCreep(Game.getObjectById(${creepId}))
		`);
		expect(rc).toBe(OK);
		expect((await shard.expectStructure(spawnId, STRUCTURE_SPAWN)).store.energy).toBe(renewSpawnEnergy - renewCost(creepBody));
	});

	test('RENEW-CREEP-004 renewCreep removes all boosts from the target creep', async ({ shard }) => {
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		// Place a boosted creep.
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [WORK, CARRY, MOVE],
			ticksToLive: 100,
			boosts: { 0: RESOURCE_UTRIUM_HYDRIDE },
		});
		await shard.tick();

		// Verify the creep is boosted before renew.
		const boostBefore = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).body[0].boost
		`);
		expect(boostBefore).toBe(RESOURCE_UTRIUM_HYDRIDE);

		const rc = await shard.runPlayer('p1', code`
			const spawn = Game.getObjectById(${spawnId});
			const creep = Game.getObjectById(${creepId});
			spawn.renewCreep(creep)
		`);
		expect(rc).toBe(OK);

		// After renew, canonical processor (renew-creep.js:50-53) sets each
		// body part's boost field to null (not undefined).
		const boostAfter = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).body[0].boost
		`);
		expect(boostAfter).toBeNull();
	});

	test('RENEW-CREEP-005 renewCreep does not refund removed boost compounds or energy', async ({ shard }) => {
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: renewSpawnEnergy },
		});
		const creepBody = [WORK, CARRY, MOVE];
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: creepBody,
			ticksToLive: 100,
			boosts: { 0: RESOURCE_UTRIUM_HYDRIDE },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).renewCreep(Game.getObjectById(${creepId}))
		`);
		expect(rc).toBe(OK);
		// Unlike unboostCreep, nothing comes back: no pile, no energy, nothing carried.
		expect(await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES)).toEqual([]);
		expect((await shard.expectStructure(spawnId, STRUCTURE_SPAWN)).store.energy).toBe(renewSpawnEnergy - renewCost(creepBody));
		expect((await shard.expectObject(creepId, 'creep')).store).toEqual({});
	});

	test('RENEW-CREEP-006 boost removal that reduces storeCapacity drops excess carried resources', async ({ shard }) => {
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		// Boosted CARRY part increases capacity. After deboost, capacity shrinks.
		// Body: [CARRY, MOVE] with CARRY boosted by KH (carry capacity boost).
		// Normal CARRY = 50 capacity. KH doubles carry → 100 effective.
		// Place the creep with 75 energy (fits in boosted capacity, exceeds unboosted).
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [CARRY, MOVE],
			ticksToLive: 100,
			boosts: { 0: boostTableCases.find(row => row.mechanic === 'capacity')!.compound },
			store: { energy: 75 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const spawn = Game.getObjectById(${spawnId});
			const creep = Game.getObjectById(${creepId});
			spawn.renewCreep(creep)
		`);
		expect(rc).toBe(OK);

		// After renew, capacity is back to CARRY_CAPACITY; the excess drops and
		// takes the drop tick's decay.
		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store.energy).toBe(CARRY_CAPACITY);

		const drops = await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES);
		const energyDrop = drops.find(r => r.pos.x === 25 && r.pos.y === 26 && r.resourceType === 'energy');
		const excess = 75 - CARRY_CAPACITY;
		expect(energyDrop?.amount).toBe(excess - Math.ceil(excess / ENERGY_DECAY));
	});

	test(`${staleSpawnRenewCreepCase.catalogId}:${staleSpawnRenewCreepCase.label} stale cached StructureSpawn.renewCreep() throws a runtime error`, async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [MOVE],
			ticksToLive: 100,
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const spawn = Game.getObjectById(${spawnId});
			globalThis.__screepsOkStaleRenewSpawn = spawn;
			spawn.destroy()
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const err = await shard.expectRunPlayerError('p1', code`
			const target = Game.getObjectById(${creepId});
			globalThis.__screepsOkStaleRenewSpawn.renewCreep(target)
		`, 'runtime');
		expect(err.errorKind).toBe('runtime');
	});

	for (const row of renewCreepValidationCases) {
		test(`RENEW-CREEP-011:${row.label} renewCreep() validation returns the canonical code`, async ({ shard }) => {
			const blockers = shard.validationBlockers(row);
			const owner = blockers.has('not-owner') ? 'p2' : 'p1';
			const creepOwner = blockers.has('not-owner-creep') ? 'p2' : 'p1';
			// A spawning target spawns beside the spawn from a second one, which
			// W1N1 has at RCL 7; where W1N1 can't host it (inactive, another
			// player's, or drained) it spawns in its owner's W2N1.
			const spawning = blockers.has('spawning-target');
			const spawnsNearby = spawning && !['not-owner', 'not-owner-creep', 'rcl', 'not-enough'].some(b => blockers.has(b as never));
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [
					// A spawn in a room with no controller level is inactive.
					blockers.has('rcl') ? { name: 'W1N1' } : { name: 'W1N1', rcl: spawnsNearby ? 7 : 2, owner },
					...(spawning && !spawnsNearby ? [{ name: 'W2N1', rcl: 2, owner: creepOwner }] : []),
				],
			});
			if (owner === 'p2') {
				await shard.placeCreep('W1N1', { pos: [20, 20], owner: 'p1', body: [MOVE] });
			}
			const spawnId = await shard.placeStructure('W1N1', {
				pos: [25, 25],
				structureType: STRUCTURE_SPAWN,
				owner,
				// Busy, the spawn holds just what the busy spawn costs.
				store: { energy: !blockers.has('not-enough') ? SPAWN_ENERGY_CAPACITY : blockers.has('busy') ? 3 * BODYPART_COST[MOVE] : 0 },
			});
			const pos: [number, number] = blockers.has('range') ? [30, 30] : [25, 26];
			const creepBody = blockers.has('claim-part') ? [CLAIM, MOVE]
				: blockers.has('full') ? [MOVE]
				: [WORK, CARRY, MOVE];
			const creepId = blockers.has('invalid-target')
				? await shard.placeSource('W1N1', { pos })
				: spawning
					? await spawnBusyCreep(shard, spawnsNearby
						? { pos, body: creepBody, name: 'SpawningTarget' }
						: { roomName: 'W2N1', owner: creepOwner, observerOwner: creepOwner === 'p1' ? undefined : 'p1', body: creepBody, name: 'SpawningTarget' })
					: await shard.placeCreep('W1N1', {
						pos,
						owner: creepOwner,
						body: creepBody,
						ticksToLive: blockers.has('full') ? CREEP_LIFE_TIME : 100,
					});
			if (blockers.has('busy')) {
				const busyRc = await shard.runPlayer(owner, code`
					Game.getObjectById(${spawnId}).spawnCreep([MOVE, MOVE, MOVE], 'BusyRenew')
				`);
				expect(busyRc).toBe(OK);
				await shard.tick();
			}
			if (blockers.has('rcl')) await shard.tick();

			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${spawnId}).renewCreep(Game.getObjectById(${creepId}))
			`);
			expect(rc).toBe(row.expectedRc);
		});
	}

	test(`${staleArgSpawnRenewCreepCase.catalogId}:${staleArgSpawnRenewCreepCase.label} StructureSpawn.renewCreep() rejects a stale cached Creep target`, async ({ shard }) => {
		await shard.ownedRoom('p1');
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: SPAWN_ENERGY_CAPACITY },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1', body: [MOVE], name: 'RenewTarget',
		});
		await shard.tick();

		const rc1 = await shard.runPlayer('p1', code`
			globalThis.__screepsOkStaleArgRenewCreep = Game.getObjectById(${creepId});
			globalThis.__screepsOkStaleArgRenewCreep.suicide()
		`);
		expect(rc1).toBe(OK);
		expect(await shard.getObject(creepId)).toBeNull();

		await expectStaleArgumentRejected(shard, 'p1', staleArgSpawnRenewCreepCase, code`
			Game.getObjectById(${spawnId}).renewCreep(globalThis.__screepsOkStaleArgRenewCreep)
		`);

		const spawn = await shard.expectStructure(spawnId, STRUCTURE_SPAWN);
		expect(spawn.store.energy).toBe(SPAWN_ENERGY_CAPACITY);
	});
});
