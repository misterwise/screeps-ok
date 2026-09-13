import { describe, test, expect, code, type ContainerSnapshot,
	OK, WORK, CARRY, MOVE,
	HARVEST_POWER, CARRY_CAPACITY, UPGRADE_CONTROLLER_POWER, RESOURCE_ENERGY,
	ENERGY_DECAY, CREEP_CORPSE_RATE, BODYPART_COST,
	STRUCTURE_CONTAINER, FIND_DROPPED_RESOURCES, FIND_TOMBSTONES,
} from '../../src/index.js';

// A creep's actions resolve in the engine's own fixed order
// (processor/intents/creeps/intents.js `creepActions`), NOT in the order the
// player's code called them. `drop`, `transfer`, `withdraw` and `pickup` all
// resolve BEFORE `harvest`, so a creep that empties and refills in one tick
// always sees the emptying first — whatever order the calls were made in.
//
// Both cases below use a creep whose store is already full, so the tick's
// harvest either lands in the freed store (correct: emptying resolved first) or
// overflows onto the ground (wrong: harvest resolved first).
describe('Intent creep resolution order', () => {
	test('INTENT-CREEP-004 drop resolves before harvest even when harvest is called first', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, WORK, CARRY, MOVE],
			store: { energy: CARRY_CAPACITY },
		});
		const srcId = await shard.placeSource('W1N1', {
			pos: [25, 26], energy: 3000, energyCapacity: 3000,
		});

		await shard.runPlayer('p1', code`
			const c = Game.getObjectById(${creepId});
			c.harvest(Game.getObjectById(${srcId}));
			c.drop(RESOURCE_ENERGY, ${CARRY_CAPACITY});
		`);
		await shard.tick();

		// drop empties the store first, so the tick's harvest lands in the creep.
		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store.energy).toBe(2 * HARVEST_POWER);
		// Exactly one pile, holding the dropped load (minus resource decay) and
		// NOT the harvested energy on top of it.
		const drops = await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES);
		const energy = drops.filter(d => d.resourceType === RESOURCE_ENERGY);
		expect(energy.length).toBe(1);
		expect(energy[0].amount).toBeLessThanOrEqual(CARRY_CAPACITY);
		expect(energy[0].amount).toBeGreaterThan(CARRY_CAPACITY - 2 * HARVEST_POWER);
	});

	test('INTENT-CREEP-004 transfer resolves before harvest even when harvest is called first', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, WORK, CARRY, MOVE],
			store: { energy: CARRY_CAPACITY },
		});
		const srcId = await shard.placeSource('W1N1', {
			pos: [25, 26], energy: 3000, energyCapacity: 3000,
		});
		const contId = await shard.placeStructure('W1N1', {
			pos: [26, 25], structureType: STRUCTURE_CONTAINER,
			store: { energy: 0 },
		});

		await shard.runPlayer('p1', code`
			const c = Game.getObjectById(${creepId});
			c.harvest(Game.getObjectById(${srcId}));
			c.transfer(Game.getObjectById(${contId}), RESOURCE_ENERGY, ${CARRY_CAPACITY});
		`);
		await shard.tick();

		// transfer empties the store first, so the tick's harvest lands in the creep
		// and nothing overflows onto the ground.
		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store.energy).toBe(2 * HARVEST_POWER);
		const cont = await shard.expectObject(contId, 'structure');
		expect(cont.structureType).toBe(STRUCTURE_CONTAINER);
		expect((cont as ContainerSnapshot).store?.energy).toBe(CARRY_CAPACITY);
		const drops = await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES);
		expect(drops.filter(d => d.resourceType === RESOURCE_ENERGY).length).toBe(0);
	});

	// The mirror image: the refill resolves BEFORE the spend. `harvest` sits ahead
	// of `upgradeController` in the engine order and neither blocks the other, so
	// a full creep harvesting and upgrading in one tick overflows the whole
	// harvest onto the ground first and only then spends on the upgrade.
	test('INTENT-CREEP-005 harvest resolves before upgradeController even when upgradeController is called first', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const ctrlPos = await shard.getControllerPos('W1N1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y], owner: 'p1',
			body: [WORK, WORK, CARRY, MOVE],
			store: { energy: CARRY_CAPACITY },
		});
		const srcId = await shard.placeSource('W1N1', {
			pos: [ctrlPos!.x, ctrlPos!.y + 1], energy: 3000, energyCapacity: 3000,
		});
		await shard.tick();

		const rcs = await shard.runPlayer('p1', code`
			const c = Game.getObjectById(${creepId});
			[
				c.upgradeController(Game.rooms['W1N1'].controller),
				c.harvest(Game.getObjectById(${srcId})),
			]
		`);
		expect(rcs).toEqual([OK, OK]);

		// Harvest first: the store is still full, so the whole harvest drops.
		// Then the upgrade spends from the store. Spend-first would leave the
		// store full and drop only the excess.
		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store.energy).toBe(CARRY_CAPACITY - 2 * UPGRADE_CONTROLLER_POWER);
		const drops = await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES);
		// The new pile decays in the same tick it is created (as HARVEST-* pins).
		const energy = drops.filter(d => d.resourceType === RESOURCE_ENERGY);
		expect(energy.length).toBe(1);
		const overflow = 2 * HARVEST_POWER;
		expect(energy[0].amount).toBe(overflow - Math.ceil(overflow / ENERGY_DECAY));
	});

	// `transfer` resolves before `suicide`: the dump-then-die idiom lands the
	// load in the target, not in the tombstone.
	test('INTENT-CREEP-006 transfer resolves before suicide even when suicide is called first', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', name: 'dumper',
			body: [CARRY, MOVE],
			store: { energy: CARRY_CAPACITY },
		});
		const contId = await shard.placeStructure('W1N1', {
			pos: [26, 25], structureType: STRUCTURE_CONTAINER,
			store: { energy: 0 },
		});
		await shard.tick();

		const rcs = await shard.runPlayer('p1', code`
			const c = Game.getObjectById(${creepId});
			[
				c.suicide(),
				c.transfer(Game.getObjectById(${contId}), RESOURCE_ENERGY),
			]
		`);
		expect(rcs).toEqual([OK, OK]);

		// The whole load reached the container. The tombstone holds only the
		// body's corpse energy (processor/intents/creeps/_die.js), never the load.
		expect(await shard.getObject(creepId)).toBeNull();
		const cont = await shard.expectObject(contId, 'structure');
		expect((cont as ContainerSnapshot).store?.energy).toBe(CARRY_CAPACITY);
		const tombstones = await shard.findInRoom('W1N1', FIND_TOMBSTONES);
		expect(tombstones.length).toBe(1);
		expect(tombstones[0].creepName).toBe('dumper');
		const corpseMax = CREEP_CORPSE_RATE * (BODYPART_COST[CARRY] + BODYPART_COST[MOVE]);
		expect(tombstones[0].store.energy ?? 0).toBeLessThanOrEqual(corpseMax);
	});
});
