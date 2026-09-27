import { describe, test, expect, code, type ContainerSnapshot,
	OK, WORK, CARRY, MOVE,
	HARVEST_POWER, CARRY_CAPACITY, UPGRADE_CONTROLLER_POWER, RESOURCE_ENERGY,
	ENERGY_DECAY, CREEP_CORPSE_RATE, CREEP_LIFE_TIME, CREEP_PART_MAX_ENERGY, BODYPART_COST,
	STRUCTURE_CONTAINER, FIND_DROPPED_RESOURCES, FIND_TOMBSTONES,
} from '../../src/index.js';
import type { ShardFixture } from '../../src/fixture.js';

// A creep's actions resolve in the engine's own fixed order
// (processor/intents/creeps/intents.js `creepActions`), not in the order the
// player's code called them: `drop`, `transfer`, `withdraw` and `pickup` resolve
// before `harvest`. Each case calls harvest first on a one-CARRY creep beside a
// full source: an emptied store takes the harvest, a refilled one overflows it
// onto the creep's tile.
const HARVESTED = 2 * HARVEST_POWER;
const decayed = (amount: number) => amount - Math.ceil(amount / ENERGY_DECAY);

interface OrderCase {
	/** The creep's starting energy. */
	carried: number;
	/** Places what the store action acts on beside the creep at (25,25); returns its id. */
	place(shard: ShardFixture): Promise<string>;
	call: string;
	/** The creep's energy and each energy pile's tile and amount after the tick. */
	creep: number;
	piles: Array<{ x: number; y: number; amount: number }>;
}

const orderCases: Record<string, OrderCase> = {
	drop: {
		carried: CARRY_CAPACITY, call: 'drop', creep: HARVESTED,
		place: async () => '',
		piles: [{ x: 25, y: 25, amount: decayed(CARRY_CAPACITY) }],
	},
	transfer: {
		carried: CARRY_CAPACITY, call: 'transfer', creep: HARVESTED,
		place: shard => shard.placeStructure('W1N1', { pos: [26, 25], structureType: STRUCTURE_CONTAINER }),
		piles: [],
	},
	withdraw: {
		carried: 0, call: 'withdraw', creep: CARRY_CAPACITY,
		place: shard => shard.placeStructure('W1N1', {
			pos: [26, 25], structureType: STRUCTURE_CONTAINER, store: { [RESOURCE_ENERGY]: CARRY_CAPACITY },
		}),
		piles: [{ x: 25, y: 25, amount: decayed(HARVESTED) }],
	},
	pickup: {
		carried: 0, call: 'pickup', creep: CARRY_CAPACITY,
		place: shard => shard.placeDroppedResource('W1N1', { pos: [26, 25], resourceType: RESOURCE_ENERGY, amount: CARRY_CAPACITY }),
		piles: [{ x: 25, y: 25, amount: decayed(HARVESTED) }],
	},
};

describe('Intent creep resolution order', () => {
	for (const [action, row] of Object.entries(orderCases)) {
		test(`INTENT-CREEP-004:${action} ${action} resolves before harvest even when harvest is called first`, async ({ shard }) => {
			await shard.ownedRoom('p1');
			const creepId = await shard.placeCreep('W1N1', {
				pos: [25, 25], owner: 'p1', body: [WORK, WORK, CARRY, MOVE], store: { [RESOURCE_ENERGY]: row.carried },
			});
			const srcId = await shard.placeSource('W1N1', { pos: [25, 26] });
			const targetId = await row.place(shard);

			const rcs = await shard.runPlayer('p1', code`
				const c = Game.getObjectById(${creepId});
				const target = Game.getObjectById(${targetId});
				const calls = {
					drop: () => c.drop(RESOURCE_ENERGY),
					transfer: () => c.transfer(target, RESOURCE_ENERGY),
					withdraw: () => c.withdraw(target, RESOURCE_ENERGY),
					pickup: () => c.pickup(target),
				};
				[c.harvest(Game.getObjectById(${srcId})), calls[${row.call}]()]
			`);
			expect(rcs).toEqual([OK, OK]);

			const creep = await shard.expectObject(creepId, 'creep');
			expect(creep.store.energy ?? 0).toBe(row.creep);
			const piles = await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES);
			expect(piles.map(pile => ({ x: pile.pos.x, y: pile.pos.y, amount: pile.amount }))).toEqual(row.piles);
		});
	}

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

		const { rcs, ticksToLive } = await shard.runPlayer('p1', code`
			const c = Game.getObjectById(${creepId});
			({
				rcs: [c.suicide(), c.transfer(Game.getObjectById(${contId}), RESOURCE_ENERGY)],
				ticksToLive: c.ticksToLive,
			})
		`) as { rcs: number[]; ticksToLive: number };
		expect(rcs).toEqual([OK, OK]);

		// The whole load reached the container. The tombstone holds only the
		// body's corpse energy (processor/intents/creeps/_die.js), never the load.
		expect(await shard.getObject(creepId)).toBeNull();
		const cont = await shard.expectObject(contId, 'structure');
		expect((cont as ContainerSnapshot).store?.energy).toBe(CARRY_CAPACITY);
		const tombstones = await shard.findInRoom('W1N1', FIND_TOMBSTONES);
		expect(tombstones.length).toBe(1);
		expect(tombstones[0].creepName).toBe('dumper');
		// Each part returns its cost at CREEP_CORPSE_RATE, scaled by the life left (_die.js:40-57).
		const lifeRate = CREEP_CORPSE_RATE * ticksToLive / CREEP_LIFE_TIME;
		const corpse = Math.floor([CARRY, MOVE].reduce((sum, part) => sum + Math.min(CREEP_PART_MAX_ENERGY, BODYPART_COST[part] * lifeRate), 0));
		expect(tombstones[0].store.energy ?? 0).toBe(corpse);
	});
});
