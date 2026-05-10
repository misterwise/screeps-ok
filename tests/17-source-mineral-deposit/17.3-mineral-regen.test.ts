import { describe, test, expect,
	DENSITY_LOW, DENSITY_MODERATE, DENSITY_HIGH, DENSITY_ULTRA,
	MINERAL_DENSITY,
} from '../../src/index.js';
import { mineralRegenCases } from '../../src/matrices/mineral-regen.js';

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

	test('MINERAL-REGEN-002 when regeneration timer completes, mineral restores to density amount', async ({ shard }) => {
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
		// Default density is DENSITY_HIGH → MINERAL_DENSITY[3] = 70000.
		expect(after.mineralAmount).toBe(MINERAL_DENSITY[DENSITY_HIGH]);
		expect(after.ticksToRegeneration).toBe(0);
	});

	test('MINERAL-REGEN-005 mineral type remains the same after regeneration', async ({ shard }) => {
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

	test('MINERAL-REGEN-006 mineral.density exposes the placed density level', async ({ shard }) => {
		await shard.ownedRoom('p1');
		// Place one mineral per density level at distinct positions.
		const placements = [
			{ density: DENSITY_LOW, pos: [25, 20] as [number, number] },
			{ density: DENSITY_MODERATE, pos: [25, 22] as [number, number] },
			{ density: DENSITY_HIGH, pos: [25, 24] as [number, number] },
			{ density: DENSITY_ULTRA, pos: [25, 26] as [number, number] },
		];
		for (const { density, pos } of placements) {
			const id = await shard.placeMineral('W1N1', {
				pos, mineralType: 'H', density,
			});
			const mineral = await shard.expectObject(id, 'mineral');
			expect(mineral.density).toBe(density);
		}
	});

	// ---- Matrix: density-keyed refill amount (MINERAL-REGEN-001) ----
	// Place a depleted mineral at each density, regenerate, assert the restored
	// amount equals MINERAL_DENSITY[density]. Replaces the prior constants-table
	// check, which only validated the table's values rather than engine behavior.
	for (const { density, label, expectedAmount } of mineralRegenCases) {
		test(`MINERAL-REGEN-001:${label} density=${density} regenerates to MINERAL_DENSITY[${density}]=${expectedAmount}`, async ({ shard }) => {
			await shard.ownedRoom('p1');
			const id = await shard.placeMineral('W1N1', {
				pos: [25, 25], mineralType: 'H', density,
				mineralAmount: 0, ticksToRegeneration: 3,
			});

			await shard.tick(5);

			const mineral = await shard.expectObject(id, 'mineral');
			expect(mineral.mineralAmount).toBe(expectedAmount);
			expect(mineral.ticksToRegeneration).toBe(0);
		});
	}

	// LOW and ULTRA always redensify on regeneration (deterministic gate in
	// the engine processor). The new density is sampled from
	// MINERAL_DENSITY_PROBABILITY with the current density removed, so the
	// resulting density is non-deterministic across runs — assert membership +
	// inequality, not a specific value.
	const VALID_DENSITIES = [DENSITY_LOW, DENSITY_MODERATE, DENSITY_HIGH, DENSITY_ULTRA];

	test('MINERAL-REGEN-007 DENSITY_LOW redensifies on regeneration', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeMineral('W1N1', {
			pos: [25, 25], mineralType: 'H', density: DENSITY_LOW,
			mineralAmount: 0, ticksToRegeneration: 3,
		});

		await shard.tick(5);

		const mineral = await shard.expectObject(id, 'mineral');
		expect(VALID_DENSITIES).toContain(mineral.density);
		expect(mineral.density).not.toBe(DENSITY_LOW);
	});

	test('MINERAL-REGEN-008 DENSITY_ULTRA redensifies on regeneration', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeMineral('W1N1', {
			pos: [25, 25], mineralType: 'H', density: DENSITY_ULTRA,
			mineralAmount: 0, ticksToRegeneration: 3,
		});

		await shard.tick(5);

		const mineral = await shard.expectObject(id, 'mineral');
		expect(VALID_DENSITIES).toContain(mineral.density);
		expect(mineral.density).not.toBe(DENSITY_ULTRA);
	});

	// MINERAL-REGEN-009 — MODERATE/HIGH redensify gated on the stochastic
	// `Math.random() < MINERAL_DENSITY_CHANGE` (5%) check. With injected
	// random sequences both adapters take the same branch deterministically.
	// Selection value 0.05 picks density 1 (LOW) on both engines:
	//   - vanilla: 0.05 ≤ MINERAL_DENSITY_PROBABILITY[1]=0.1 → newDensity=1
	//   - xxscreeps: 0.05 * accumulated.at(-1)=0.6 → 0.03; first accumulated
	//     entry ≥ 0.03 is index 1 → density=1
	for (const { density, label, densityName } of [
		{ density: DENSITY_MODERATE, label: 'moderate', densityName: 'DENSITY_MODERATE' },
		{ density: DENSITY_HIGH, label: 'high', densityName: 'DENSITY_HIGH' },
	]) {
		test(`MINERAL-REGEN-009:${label}Redensify ${densityName} redensifies when injected gate < MINERAL_DENSITY_CHANGE`, async ({ shard }) => {
			shard.requires('randomInjection');
			await shard.ownedRoom('p1');
			const id = await shard.placeMineral('W1N1', {
				pos: [25, 25], mineralType: 'H', density,
				mineralAmount: 0, ticksToRegeneration: 3,
			});

			await shard.tick(5, { random: [0.04, 0.05] });

			const mineral = await shard.expectObject(id, 'mineral');
			expect(mineral.density).toBe(DENSITY_LOW);
		});

		test(`MINERAL-REGEN-009:${label}Unchanged ${densityName} stays unchanged when injected gate >= MINERAL_DENSITY_CHANGE`, async ({ shard }) => {
			shard.requires('randomInjection');
			await shard.ownedRoom('p1');
			const id = await shard.placeMineral('W1N1', {
				pos: [25, 25], mineralType: 'H', density,
				mineralAmount: 0, ticksToRegeneration: 3,
			});

			await shard.tick(5, { random: [0.99] });

			const mineral = await shard.expectObject(id, 'mineral');
			expect(mineral.density).toBe(density);
		});
	}
});
