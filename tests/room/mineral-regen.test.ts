import { describe, test, expect,
	MINERAL_DENSITY, DENSITY_HIGH,
} from '../../src/index.js';
import { mineralRegenCases } from '../support/matrices/mineral-regen.js';
import { knownParityGap } from '../support/parity-gaps.js';

describe('mineral regeneration', () => {
	test('MINERAL-REGEN-003 a full mineral reports ticksToRegeneration as 0', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeMineral('W1N1', {
			pos: [25, 25], mineralType: 'H', mineralAmount: 50000,
		});

		const mineral = await shard.expectObject(id, 'mineral');
		expect(mineral.ticksToRegeneration).toBe(0);
	});

	test('MINERAL-REGEN-004 a depleted mineral has ticksToRegeneration that decreases by 1 each tick', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeMineral('W1N1', {
			pos: [25, 25], mineralType: 'H', mineralAmount: 0,
			ticksToRegeneration: 10,
		});

		// After placing, observe the initial ticksToRegeneration.
		const before = await shard.expectObject(id, 'mineral');
		const t0 = before.ticksToRegeneration;
		expect(t0).toBeGreaterThan(0);

		// Tick 3 times and verify it decreased by 3.
		await shard.tick(3);
		const after = await shard.expectObject(id, 'mineral');
		expect(after.ticksToRegeneration).toBe(t0 - 3);
	});

	knownParityGap('mineral-regen-not-implemented')('MINERAL-REGEN-002 when regeneration timer completes, mineral restores to density amount', async ({ shard }) => {
		await shard.ownedRoom('p1');
		// Place a depleted mineral that regenerates in 3 ticks.
		const id = await shard.placeMineral('W1N1', {
			pos: [25, 25], mineralType: 'H', mineralAmount: 0,
			ticksToRegeneration: 3,
		});

		const before = await shard.expectObject(id, 'mineral');
		expect(before.mineralAmount).toBe(0);

		// Tick past the regeneration time.
		// Engine regenerates at gameTime >= nextRegenerationTime - 1.
		await shard.tick(5);

		const after = await shard.expectObject(id, 'mineral');
		// Mineral should have regenerated. Amount matches MINERAL_DENSITY[density].
		// Default density is 3 (DENSITY_HIGH) → MINERAL_DENSITY[3] = 70000.
		expect(after.mineralAmount).toBe(MINERAL_DENSITY[DENSITY_HIGH]);
		expect(after.ticksToRegeneration).toBe(0);
	});

	knownParityGap('mineral-regen-not-implemented')('MINERAL-REGEN-005 mineral type remains the same after regeneration', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeMineral('W1N1', {
			pos: [25, 25], mineralType: 'L', mineralAmount: 0,
			ticksToRegeneration: 3,
		});

		await shard.tick(5);

		const mineral = await shard.expectObject(id, 'mineral');
		expect(mineral.mineralType).toBe('L');
		expect(mineral.mineralAmount).toBeGreaterThan(0);
	});

	// ---- Matrix: density → amount mapping (MINERAL-REGEN-001) ----
	// This verifies the MINERAL_DENSITY table is correct. We can't set density
	// directly via placeMineral (it defaults to 3/HIGH), so we verify the
	// constant table values match the canonical mapping.
	for (const { density, label, expectedAmount } of mineralRegenCases) {
		test(`MINERAL-REGEN-001:${label} MINERAL_DENSITY[${density}] equals ${expectedAmount}`, () => {
			expect(MINERAL_DENSITY[density]).toBe(expectedAmount);
		});
	}
});
