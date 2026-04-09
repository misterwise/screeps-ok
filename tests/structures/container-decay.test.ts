import { describe, test, expect,
	STRUCTURE_CONTAINER, CONTAINER_DECAY, CONTAINER_HITS,
	FIND_DROPPED_RESOURCES, RESOURCE_ENERGY, MOVE,
} from '../../src/index.js';
import { containerDecayCases } from '../support/matrices/container-decay.js';

describe('Container decay', () => {
	// ---- CONTAINER-001: decay amount and interval by room ownership ----
	for (const { label, owned, expectedDecayAmount, expectedDecayInterval } of containerDecayCases) {
		test(`CONTAINER-001:${label} container in ${label} decays by ${expectedDecayAmount} every ${expectedDecayInterval} ticks`, async ({ shard }) => {
			if (owned) {
				await shard.ownedRoom('p1');
			} else {
				await shard.createShard({
					players: ['p1'],
					rooms: [
						{ name: 'W1N1', rcl: 1, owner: 'p1' },
						{ name: 'W2N1' }, // unowned
					],
				});
				// Place a creep to activate the unowned room for engine processing.
				await shard.placeCreep('W2N1', {
					pos: [20, 20], owner: 'p1', body: [MOVE],
				});
			}
			const room = owned ? 'W1N1' : 'W2N1';

			// Place container with decay due in 3 ticks.
			const id = await shard.placeStructure(room, {
				pos: [25, 25], structureType: STRUCTURE_CONTAINER,
				ticksToDecay: 3,
			});

			const before = await shard.expectStructure(id, STRUCTURE_CONTAINER);
			expect(before.hits).toBe(CONTAINER_HITS);
			expect(before.ticksToDecay).toBeGreaterThan(0);

			// Tick past the decay point.
			await shard.tick(3);

			const after = await shard.expectStructure(id, STRUCTURE_CONTAINER);
			expect(after.hits).toBe(CONTAINER_HITS - expectedDecayAmount);
		});
	}

	// ---- CONTAINER-002: destroyed container spills contents ----
	test('CONTAINER-002 when a container is destroyed its contents become dropped resources', async ({ shard }) => {
		await shard.ownedRoom('p1');

		// Place container with minimal hits and some energy, decay imminent.
		const id = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_CONTAINER,
			hits: CONTAINER_DECAY,
			store: { energy: 500 },
			ticksToDecay: 2,
		});

		const before = await shard.expectStructure(id, STRUCTURE_CONTAINER);
		expect(before.hits).toBe(CONTAINER_DECAY);
		expect(before.store.energy).toBe(500);

		// Tick exactly to the decay point — container destroyed, resources appear
		// this tick but haven't had time to decay on the ground yet.
		await shard.tick(2);

		const obj = await shard.getObject(id);
		expect(obj).toBeNull();

		// Energy should be on the ground at full amount.
		const drops = await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES);
		const energyDrop = drops.find(d => d.pos.x === 25 && d.pos.y === 25 && d.resourceType === RESOURCE_ENERGY);
		expect(energyDrop).toBeDefined();
		expect(energyDrop!.amount).toBe(500);
	});
});
