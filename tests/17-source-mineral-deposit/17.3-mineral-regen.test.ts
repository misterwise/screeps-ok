import { describe, test, expect, code,
	DENSITY_LOW, DENSITY_MODERATE, DENSITY_HIGH, DENSITY_ULTRA,
	MINERAL_DENSITY, MINERAL_REGEN_TIME, RESOURCE_HYDROGEN, RESOURCE_LEMERGIUM,
} from '../../src/index.js';
import { mineralRegenCases } from '../../src/matrices/mineral-regen.js';

describe('mineral regeneration', () => {
	test('MINERAL-REGEN-003 a full mineral reports ticksToRegeneration as undefined', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeMineral('W1N1', {
			pos: [25, 25], mineralType: RESOURCE_HYDROGEN, mineralAmount: MINERAL_DENSITY[DENSITY_HIGH],
		});
		await shard.tick();

		// Read through the engine getter; the adapter snapshot defaults a missing timer.
		const result = await shard.runPlayer('p1', code`
			const m = Game.getObjectById(${id});
			({ amount: m.mineralAmount, hasTimer: m.ticksToRegeneration !== undefined })
		`);
		expect(result).toEqual({ amount: MINERAL_DENSITY[DENSITY_HIGH], hasTimer: false });
	});

	test('MINERAL-REGEN-004 a depleted mineral has ticksToRegeneration that decreases by 1 each tick', async ({ shard }) => {
		await shard.ownedRoom('p1');
		// No timer placed: the mineral's first tick starts one (minerals/tick.js:10-13).
		const id = await shard.placeMineral('W1N1', {
			pos: [25, 25], mineralType: RESOURCE_HYDROGEN, mineralAmount: 0,
		});

		const readings = [];
		for (let i = 0; i < 3; i++) {
			await shard.tick();
			readings.push((await shard.expectObject(id, 'mineral')).ticksToRegeneration);
		}
		expect(readings).toEqual([MINERAL_REGEN_TIME - 1, MINERAL_REGEN_TIME - 2, MINERAL_REGEN_TIME - 3]);
	});

	test('MINERAL-REGEN-002 when regeneration timer completes, mineral restores to density amount', async ({ shard }) => {
		await shard.ownedRoom('p1');
		// Placed three ticks from regenerating, at the default DENSITY_HIGH.
		const id = await shard.placeMineral('W1N1', {
			pos: [25, 25], mineralType: RESOURCE_HYDROGEN, mineralAmount: 0,
			ticksToRegeneration: 3,
		});

		const readings = [];
		for (let i = 0; i < 3; i++) {
			await shard.tick();
			const mineral = await shard.expectObject(id, 'mineral');
			readings.push([mineral.mineralAmount, mineral.ticksToRegeneration]);
		}
		// Refilled on the tick the timer runs out, which clears it.
		expect(readings).toEqual([[0, 2], [0, 1], [MINERAL_DENSITY[DENSITY_HIGH], null]]);
	});

	test('MINERAL-REGEN-005 mineral type remains the same after regeneration', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeMineral('W1N1', {
			pos: [25, 25], mineralType: RESOURCE_LEMERGIUM, mineralAmount: 0,
			ticksToRegeneration: 3,
		});

		await shard.tick(3);

		const mineral = await shard.expectObject(id, 'mineral');
		expect([mineral.mineralType, mineral.mineralAmount]).toEqual([RESOURCE_LEMERGIUM, MINERAL_DENSITY[DENSITY_HIGH]]);
	});

	test('MINERAL-REGEN-006 mineral.density exposes the placed density level', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const densities = [DENSITY_LOW, DENSITY_MODERATE, DENSITY_HIGH, DENSITY_ULTRA];
		const ids = [];
		for (const [i, density] of densities.entries()) {
			ids.push(await shard.placeMineral('W1N1', { pos: [25, 20 + 2 * i], mineralType: RESOURCE_HYDROGEN, density }));
		}

		expect(await shard.runPlayer('p1', code`${ids}.map(id => Game.getObjectById(id).density)`)).toEqual(densities);
	});

	// ---- Matrix: density-keyed refill amount (MINERAL-REGEN-001) ----
	// Place a depleted mineral at each density, regenerate, assert the restored
	// amount equals MINERAL_DENSITY[density]. Replaces the prior constants-table
	// check, which only validated the table's values rather than engine behavior.
	for (const { density, label, expectedAmount } of mineralRegenCases) {
		test(`MINERAL-REGEN-001:${label} density=${density} regenerates to MINERAL_DENSITY[${density}]=${expectedAmount}`, async ({ shard }) => {
			await shard.ownedRoom('p1');
			const id = await shard.placeMineral('W1N1', {
				pos: [25, 25], mineralType: RESOURCE_HYDROGEN, density,
				mineralAmount: 0, ticksToRegeneration: 3,
			});

			await shard.tick(5);

			const mineral = await shard.expectObject(id, 'mineral');
			expect(mineral.mineralAmount).toBe(expectedAmount);
			expect(mineral.ticksToRegeneration).toBeNull();
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
			pos: [25, 25], mineralType: RESOURCE_HYDROGEN, density: DENSITY_LOW,
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
			pos: [25, 25], mineralType: RESOURCE_HYDROGEN, density: DENSITY_ULTRA,
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
				pos: [25, 25], mineralType: RESOURCE_HYDROGEN, density,
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
				pos: [25, 25], mineralType: RESOURCE_HYDROGEN, density,
				mineralAmount: 0, ticksToRegeneration: 3,
			});

			await shard.tick(5, { random: [0.99] });

			const mineral = await shard.expectObject(id, 'mineral');
			expect(mineral.density).toBe(density);
		});
	}
});
