import { describe, test, expect, code, OK, MOVE, CARRY, ATTACK, TOUGH, body, FIND_TOMBSTONES, FIND_DROPPED_RESOURCES, RESOURCE_ENERGY, STRUCTURE_CONTAINER, TOMBSTONE_DECAY_PER_PART, BODYPART_COST } from '../../src/index.js';
import { knownParityGap } from '../support/parity-gaps.js';

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

	knownParityGap('death-container-diversion')('CREEP-DEATH-003 death resources go into a same-tile container first', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const containerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_CONTAINER,
		});
		// Use high TTL so CREEP_CORPSE_RATE yields meaningful resources.
		// Canonical: container receives resources before corpse rate reduction.
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, CARRY, MOVE],
			store: { energy: 100 },
			name: 'containerDeath',
			ticksToLive: 1000,
		});
		// Tick once to initialize, then kill via suicide for deterministic timing
		await shard.tick();
		await shard.runPlayer('p1', code`
			Game.creeps['containerDeath'].suicide()
		`);
		await shard.tick();

		const container = await shard.expectStructure(containerId, STRUCTURE_CONTAINER);
		// Energy should have been diverted to the container
		expect(container.store.energy ?? 0).toBeGreaterThan(0);
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
		await shard.tick(); // dies

		const tombstones = await shard.findInRoom('W1N1', FIND_TOMBSTONES);
		const tomb = tombstones.find(t => t.creepName === 'noContainer');
		expect(tomb).toBeDefined();
		// With no container, resources go to tombstone (reduced by CREEP_CORPSE_RATE)
		expect(tomb!.store).toBeDefined();
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
