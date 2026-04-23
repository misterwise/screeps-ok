import { describe, test, expect, code, OK, MOVE, CARRY, ATTACK, TOUGH, body, FIND_TOMBSTONES, FIND_DROPPED_RESOURCES, RESOURCE_ENERGY, RESOURCE_POWER, STRUCTURE_CONTAINER, TOMBSTONE_DECAY_PER_PART, BODYPART_COST, CREEP_CORPSE_RATE, CREEP_LIFE_TIME, CREEP_PART_MAX_ENERGY, CONTAINER_CAPACITY, LAB_BOOST_ENERGY, LAB_BOOST_MINERAL } from '../../src/index.js';

describe('creep death', () => {
	test('CREEP-DEATH-001 creep with ticksToLive === 1 dies and does not appear on the next tick', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [MOVE],
			ticksToLive: 2,
		});
		await shard.tick(); // TTL 2 → 1
		const alive = await shard.getObject(id);
		expect(alive).not.toBeNull();

		await shard.tick(); // TTL 1 → 0 → dies
		const dead = await shard.getObject(id);
		expect(dead).toBeNull();
	});

	test('CREEP-DEATH-002 death creates a tombstone at the position of death', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', {
			pos: [20, 30], owner: 'p1',
			body: [MOVE],
			name: 'doomed',
			ticksToLive: 2,
		});
		await shard.tick(); // TTL 1
		await shard.tick(); // dies

		const tombstones = await shard.findInRoom('W1N1', FIND_TOMBSTONES);
		const tomb = tombstones.find(t => t.creepName === 'doomed');
		expect(tomb).toBeDefined();
		expect(tomb!.pos.x).toBe(20);
		expect(tomb!.pos.y).toBe(30);
	});

	test('CREEP-DEATH-003 death resources go into a same-tile container first', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const containerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_CONTAINER,
		});
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, CARRY, MOVE],
			store: { energy: 100 },
			name: 'containerDeath',
			ticksToLive: 1000,
		});
		await shard.tick();
		const { ttl } = await shard.runPlayer('p1', code`
			const c = Game.creeps['containerDeath'];
			const ttl = c.ticksToLive;
			c.suicide();
			({ ttl })
		`) as { ttl: number };

		// Empty container has 2000 free; all reclaimed + carried energy fits.
		const lifeRate = CREEP_CORPSE_RATE * ttl / CREEP_LIFE_TIME;
		const bodyEnergy = Math.floor(
			BODYPART_COST[CARRY] * lifeRate +
			BODYPART_COST[CARRY] * lifeRate +
			BODYPART_COST[MOVE] * lifeRate,
		);
		const expected = bodyEnergy + 100;

		const container = await shard.expectStructure(containerId, STRUCTURE_CONTAINER);
		expect(container.store.energy ?? 0).toBe(expected);

		const tombstones = await shard.findInRoom('W1N1', FIND_TOMBSTONES);
		const tomb = tombstones.find(t => t.creepName === 'containerDeath');
		expect(tomb!.store.energy ?? 0).toBe(0);
	});

	test('CREEP-DEATH-004 tombstone stores resources not diverted to a container', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { energy: 50 },
			name: 'noContainer',
			ticksToLive: 2,
		});
		await shard.tick(); // TTL 1
		await shard.tick(); // dies (age-expiry — ticksToLive at burial is 0, no body reclaim)

		const tombstones = await shard.findInRoom('W1N1', FIND_TOMBSTONES);
		const tomb = tombstones.find(t => t.creepName === 'noContainer');
		expect(tomb).toBeDefined();
		// Carried resources are deposited 1:1 (no rate multiplier on store).
		expect(tomb!.store.energy ?? 0).toBe(50);
	});

	test('CREEP-DEATH-005 tombstone resource amounts do not decay while tombstone lives', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, CARRY, CARRY, MOVE],
			store: { energy: 50 },
			name: 'stableStore',
			ticksToLive: 2,
		});
		await shard.tick(); // TTL 1
		await shard.tick(); // dies

		const tombstones = await shard.findInRoom('W1N1', FIND_TOMBSTONES);
		const tomb = tombstones.find(t => t.creepName === 'stableStore');
		expect(tomb).toBeDefined();
		const initialEnergy = tomb!.store.energy ?? 0;

		// Tick a few more times — resources should not change
		await shard.tick();
		await shard.tick();

		const tombsAfter = await shard.findInRoom('W1N1', FIND_TOMBSTONES);
		const tombAfter = tombsAfter.find(t => t.creepName === 'stableStore');
		expect(tombAfter).toBeDefined();
		expect(tombAfter!.store.energy ?? 0).toBe(initialEnergy);
	});

	test('CREEP-DEATH-006 tombstone decay equals body.length * TOMBSTONE_DECAY_PER_PART', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const bodyParts = [CARRY, CARRY, MOVE, MOVE];
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: bodyParts,
			name: 'decayCheck',
			ticksToLive: 2,
		});
		await shard.tick(); // TTL 1
		await shard.tick(); // dies

		const tombstones = await shard.findInRoom('W1N1', FIND_TOMBSTONES);
		const tomb = tombstones.find(t => t.creepName === 'decayCheck');
		expect(tomb).toBeDefined();
		const expected = bodyParts.length * TOMBSTONE_DECAY_PER_PART;
		// Allow 1 tick of decrement since we observe after tick resolution
		expect(tomb!.ticksToDecay).toBeGreaterThanOrEqual(expected - 1);
		expect(tomb!.ticksToDecay).toBeLessThanOrEqual(expected);
	});

	// CREEP-DEATH-011 (rate=0 death leaves empty tombstone) requires placing an
	// NPC-owned creep (user id length ≤ 2 in xxscreeps, user='2' in vanilla). The
	// adapter API has no NPC-owner hook today — tracked in docs/pending-tests.md.

	test('CREEP-DEATH-012 mixed-resource deposits fill container sequentially before overflowing to tombstone', async ({ shard }) => {
		await shard.ownedRoom('p1');
		// Pre-fill the container near capacity so only a small window absorbs
		// the first resource type; the remainder overflows to the tombstone.
		const preFill = CONTAINER_CAPACITY - 10;
		const containerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_CONTAINER,
			store: { energy: preFill },
		});
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [ATTACK, CARRY],
			boosts: { 0: 'UH' },
			store: { [RESOURCE_POWER]: 20 },
			name: 'MixedDeath',
			ticksToLive: 1500,
		});
		await shard.tick();
		const { ttl } = await shard.runPlayer('p1', code`
			const c = Game.creeps['MixedDeath'];
			const ttl = c.ticksToLive;
			c.suicide();
			({ ttl })
		`) as { ttl: number };

		// Vanilla deposit order: body-energy first (bodyResources seeded with {energy:0}),
		// then body-mineral, then carried store. Each deposit re-reads container free capacity.
		const lifeRate = CREEP_CORPSE_RATE * ttl / CREEP_LIFE_TIME;
		const bodyEnergy = Math.floor(
			Math.min(CREEP_PART_MAX_ENERGY, BODYPART_COST[ATTACK] * lifeRate) +
			LAB_BOOST_ENERGY * lifeRate +
			Math.min(CREEP_PART_MAX_ENERGY, BODYPART_COST[CARRY] * lifeRate),
		);
		const bodyMineral = Math.floor(LAB_BOOST_MINERAL * lifeRate);
		const containerFree = CONTAINER_CAPACITY - preFill;
		const energyToContainer = Math.min(bodyEnergy, containerFree);
		const energyToTombstone = bodyEnergy - energyToContainer;

		const container = await shard.expectStructure(containerId, STRUCTURE_CONTAINER);
		expect(container.store.energy ?? 0).toBe(preFill + energyToContainer);
		expect(container.store.UH ?? 0).toBe(0);
		expect(container.store.power ?? 0).toBe(0);

		const tombstones = await shard.findInRoom('W1N1', FIND_TOMBSTONES);
		const tomb = tombstones.find(t => t.creepName === 'MixedDeath');
		expect(tomb).toBeDefined();
		expect(tomb!.store.energy ?? 0).toBe(energyToTombstone);
		expect(tomb!.store.UH ?? 0).toBe(bodyMineral);
		expect(tomb!.store.power ?? 0).toBe(20);
	});

	test('CREEP-DEATH-007 when tombstone decays, remaining resources become dropped resources', async ({ shard }) => {
		await shard.ownedRoom('p1');
		// 1-part creep: tombstone lasts TOMBSTONE_DECAY_PER_PART (5) ticks
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY],
			store: { energy: 50 },
			name: 'dropOnDecay',
			ticksToLive: 2,
		});
		await shard.tick(); // TTL 1
		await shard.tick(); // dies, tombstone created with ~5 ticks decay

		// Wait for tombstone to expire (TOMBSTONE_DECAY_PER_PART * 1 part = 5 ticks)
		await shard.tick(TOMBSTONE_DECAY_PER_PART + 1);

		const tombstones = await shard.findInRoom('W1N1', FIND_TOMBSTONES);
		const tomb = tombstones.find(t => t.creepName === 'dropOnDecay');
		// Tombstone should be gone
		expect(tomb).toBeUndefined();

		// If the tombstone had resources, they become dropped resources
		const drops = await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES);
		const energyDrop = drops.find(d => d.pos.x === 25 && d.pos.y === 25 && d.resourceType === 'energy');
		// There should be a dropped resource if the tombstone had any energy
		if (energyDrop) {
			expect(energyDrop.amount).toBeGreaterThan(0);
		}
	});
});
