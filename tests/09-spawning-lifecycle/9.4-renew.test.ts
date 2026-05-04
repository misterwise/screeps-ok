import { describe, test, expect, code,
	OK, ERR_NOT_ENOUGH_ENERGY, ERR_FULL, ERR_NOT_IN_RANGE, ERR_BUSY,
	ERR_RCL_NOT_ENOUGH,
	MOVE, WORK, CARRY, CLAIM, BODYPART_COST,
	STRUCTURE_SPAWN, STRUCTURE_LAB, LAB_BOOST_MINERAL, LAB_ENERGY_CAPACITY,
	CREEP_LIFE_TIME, CREEP_CLAIM_LIFE_TIME, CREEP_SPAWN_TIME, SPAWN_RENEW_RATIO,
	BOOSTS, FIND_DROPPED_RESOURCES,
} from '../../src/index.js';
import { renewCreepValidationCases } from '../../src/matrices/renew-creep-validation.js';

describe('Spawn.renewCreep', () => {
	test('RENEW-CREEP-001 renewCreep returns OK and increases creep TTL', async ({ shard }) => {
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
			const creep = Game.getObjectById(${creepId});
			spawn.renewCreep(creep)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		// renewCreep adds floor(600 / bodyLength) TTL per tick.
		// Body = [MOVE] → length 1 → +600 TTL. But capped at CREEP_LIFE_TIME.
		// 100 + 600 = 700, under cap.
		expect(creep.ticksToLive).toBeGreaterThan(100);
	});

	test('RENEW-CREEP-002 renewCreep deducts energy from the spawn', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [WORK, CARRY, MOVE],
			ticksToLive: 100,
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const spawn = Game.getObjectById(${spawnId});
			const creep = Game.getObjectById(${creepId});
			spawn.renewCreep(creep)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const spawn = await shard.expectStructure(spawnId, STRUCTURE_SPAWN);
		expect(spawn.store.energy).toBeLessThan(300);
	});

	test('RENEW-CREEP-008 renewCreep returns ERR_NOT_ENOUGH_ENERGY when spawn has insufficient energy', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 0 },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [MOVE],
			ticksToLive: 100,
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const spawn = Game.getObjectById(${spawnId});
			const creep = Game.getObjectById(${creepId});
			spawn.renewCreep(creep)
		`);
		expect(rc).toBe(ERR_NOT_ENOUGH_ENERGY);
	});

	test('RENEW-CREEP-001 renewCreep returns ERR_NOT_IN_RANGE when creep is not adjacent', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 28], owner: 'p1',
			body: [MOVE],
			ticksToLive: 100,
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const spawn = Game.getObjectById(${spawnId});
			const creep = Game.getObjectById(${creepId});
			spawn.renewCreep(creep)
		`);
		expect(rc).toBe(ERR_NOT_IN_RANGE);
	});

	test('RENEW-CREEP-010 renewCreep returns ERR_FULL when creep is already at CREEP_LIFE_TIME', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [MOVE],
			ticksToLive: CREEP_LIFE_TIME,
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const spawn = Game.getObjectById(${spawnId});
			const creep = Game.getObjectById(${creepId});
			spawn.renewCreep(creep)
		`);
		expect(rc).toBe(ERR_FULL);
	});

	test('RENEW-CREEP-007 renewCreep rejects creeps with any CLAIM body part', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [CLAIM, MOVE],
			ticksToLive: 100,
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const spawn = Game.getObjectById(${spawnId});
			const creep = Game.getObjectById(${creepId});
			spawn.renewCreep(creep)
		`);
		// Vanilla rejects CLAIM creeps from renewal.
		expect(rc).not.toBe(OK);
	});

	test('RENEW-CREEP-003 renewCreep spends the correct energy cost', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		// Use energy strictly above SPAWN_ENERGY_CAPACITY (300) so the spawn's
		// per-tick auto-regen (spawns/tick.js:44 — +1 when store < cap) does
		// not re-fund energy in the same tick the renew intent is processed.
		// The regen makes observed spend = cost − 1 whenever post-renew energy
		// is still below 300. See canonical formula below.
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 500 },
		});
		// Body: [WORK, CARRY, MOVE] — cost = 200.
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [WORK, CARRY, MOVE],
			ticksToLive: 100,
		});
		await shard.tick();

		const energyBefore = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).store.energy
		`) as number;

		const rc = await shard.runPlayer('p1', code`
			const spawn = Game.getObjectById(${spawnId});
			const creep = Game.getObjectById(${creepId});
			spawn.renewCreep(creep)
		`);
		expect(rc).toBe(OK);

		const energyAfter = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).store.energy
		`) as number;

		// Canonical engine (@screeps/engine/.../renew-creep.js:33):
		// cost = ceil(SPAWN_RENEW_RATIO * calcCreepCost(body) / CREEP_SPAWN_TIME / body.length)
		// Reproduce the same float ordering so rounding matches (1.2 × 200 is
		// 239.999… in IEEE 754, which floors differently than the inverted form).
		const bodyCostSum = BODYPART_COST[WORK] + BODYPART_COST[CARRY] + BODYPART_COST[MOVE];
		const bodyLength = 3;
		const expectedCost = Math.ceil(SPAWN_RENEW_RATIO * bodyCostSum / CREEP_SPAWN_TIME / bodyLength);
		expect(energyBefore - energyAfter).toBe(expectedCost);
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
			boosts: { 0: 'UH' }, // Boost the WORK part with UH.
		});
		await shard.tick();

		// Verify the creep is boosted before renew.
		const boostBefore = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).body[0].boost
		`);
		expect(boostBefore).toBe('UH');

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
			store: { energy: 300 },
		});
		const labId = await shard.placeStructure('W1N1', {
			pos: [26, 26], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { UH: 0, energy: 0 },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [WORK, CARRY, MOVE],
			ticksToLive: 100,
			boosts: { 0: 'UH' },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const spawn = Game.getObjectById(${spawnId});
			const creep = Game.getObjectById(${creepId});
			spawn.renewCreep(creep)
		`);
		expect(rc).toBe(OK);

		// The lab should not have gained any UH or energy from the deboost.
		const labStore = await shard.runPlayer('p1', code`
			const lab = Game.getObjectById(${labId});
			({ uh: lab.store['UH'] || 0, energy: lab.store.energy || 0 })
		`) as { uh: number; energy: number };
		expect(labStore.uh).toBe(0);
		expect(labStore.energy).toBe(0);

		// No dropped resources on the tile either.
		const drops = await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES);
		const boostDrop = drops.find(r => r.resourceType === 'UH');
		expect(boostDrop).toBeUndefined();
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
			boosts: { 0: 'KH' },
			store: { energy: 75 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const spawn = Game.getObjectById(${spawnId});
			const creep = Game.getObjectById(${creepId});
			spawn.renewCreep(creep)
		`);
		expect(rc).toBe(OK);

		// After renew, capacity is back to 50. Excess 25 should be dropped.
		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store.energy).toBeLessThanOrEqual(50);

		const drops = await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES);
		const energyDrop = drops.find(r => r.pos.x === 25 && r.pos.y === 26 && r.resourceType === 'energy');
		expect(energyDrop).toBeDefined();
	});

	test('RENEW-CREEP-009 renewCreep returns ERR_BUSY when the spawn is currently spawning', async ({ shard }) => {
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

		// Start spawning to make the spawn busy.
		const spawnRc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep([MOVE], 'Blocker')
		`);
		expect(spawnRc).toBe(OK);
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const spawn = Game.getObjectById(${spawnId});
			const creep = Game.getObjectById(${creepId});
			spawn.renewCreep(creep)
		`);
		expect(rc).toBe(ERR_BUSY);
	});

	for (const row of renewCreepValidationCases) {
		test(`RENEW-CREEP-011:${row.label} renewCreep() validation returns the canonical code`, async ({ shard }) => {
			const blockers = new Set(row.blockers);
			const owner = blockers.has('not-owner') ? 'p2' : 'p1';
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [{ name: 'W1N1', rcl: 2, owner }],
			});
			if (owner === 'p2') {
				await shard.placeCreep('W1N1', { pos: [20, 20], owner: 'p1', body: [MOVE] });
			}
			const spawnId = await shard.placeStructure('W1N1', {
				pos: [25, 25],
				structureType: STRUCTURE_SPAWN,
				owner,
				store: blockers.has('not-enough') && !blockers.has('busy') ? { energy: 0 } : { energy: 300 },
			});
			const creepId = blockers.has('invalid-target')
				? await shard.placeSource('W1N1', { pos: blockers.has('range') ? [30, 30] : [25, 26] })
				: await shard.placeCreep('W1N1', {
					pos: blockers.has('range') ? [30, 30] : [25, 26],
					owner: 'p1',
					body: blockers.has('full') ? [MOVE] : blockers.has('not-enough') ? Array.from({ length: 20 }, () => WORK) : [WORK, CARRY, MOVE],
					ticksToLive: blockers.has('full') ? CREEP_LIFE_TIME : 100,
				});
			if (blockers.has('busy')) {
				const busyRc = await shard.runPlayer(owner, code`
					Game.getObjectById(${spawnId}).spawnCreep([MOVE, MOVE, MOVE], 'BusyRenew')
				`);
				expect(busyRc).toBe(OK);
				await shard.tick();
			}

			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${spawnId}).renewCreep(Game.getObjectById(${creepId}))
			`);
			expect(rc).toBe(row.expectedRc);
		});
	}
});
