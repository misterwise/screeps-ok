import { describe, test, expect, code, type ContainerSnapshot,
	WORK, CARRY, MOVE,
	HARVEST_POWER, CARRY_CAPACITY, RESOURCE_ENERGY,
	STRUCTURE_CONTAINER, FIND_DROPPED_RESOURCES,
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
});
