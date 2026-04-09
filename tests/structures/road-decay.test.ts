import { describe, test, expect,
	STRUCTURE_ROAD, ROAD_HITS, ROAD_DECAY_AMOUNT, ROAD_DECAY_TIME,
	TERRAIN_PLAIN, TERRAIN_SWAMP, TERRAIN_WALL,
	CONSTRUCTION_COST_ROAD_SWAMP_RATIO, CONSTRUCTION_COST_ROAD_WALL_RATIO,
} from '../../src/index.js';
import { requireCapability } from '../support/policy.js';
import { knownParityGap } from '../support/parity-gaps.js';
import { roadDecayCases } from '../support/matrices/road-decay.js';

describe('Road decay', () => {
	// ---- ROAD-DECAY-002: scheduled decay interval ----
	knownParityGap('road-decay-not-implemented')('ROAD-DECAY-002 road ticksToDecay decreases each tick and decay fires on schedule', async ({ shard }) => {
		await shard.ownedRoom('p1');
		// Place road with decay due in 5 ticks.
		const id = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_ROAD,
			ticksToDecay: 5,
		});

		const before = await shard.expectStructure(id, STRUCTURE_ROAD);
		expect(before.hits).toBe(ROAD_HITS);
		expect(before.ticksToDecay).toBeGreaterThan(0);
		const t0 = before.ticksToDecay;

		// Tick 2 times — hits should be unchanged, ticksToDecay should decrease.
		await shard.tick(2);
		const mid = await shard.expectStructure(id, STRUCTURE_ROAD);
		expect(mid.hits).toBe(ROAD_HITS);
		expect(mid.ticksToDecay).toBe(t0 - 2);

		// Tick past the decay point — hits should decrease by ROAD_DECAY_AMOUNT.
		await shard.tick(4);
		const after = await shard.expectStructure(id, STRUCTURE_ROAD);
		expect(after.hits).toBe(ROAD_HITS - ROAD_DECAY_AMOUNT);
	});

	// ---- ROAD-DECAY-001: terrain-specific decay amounts ----
	// Terrain multiplier applies to both hits and decay equally.
	// Plain: 5000 hits, 100 decay. Swamp: 25000 hits, 500 decay. Wall: 750000 hits, 15000 decay.
	// All survive exactly 50 decay events.
	const terrainHitsMultiplier: Record<number, number> = {
		[TERRAIN_PLAIN]: 1,
		[TERRAIN_SWAMP]: CONSTRUCTION_COST_ROAD_SWAMP_RATIO,
		[TERRAIN_WALL]: CONSTRUCTION_COST_ROAD_WALL_RATIO,
	};

	for (const { label, terrain, expectedDecayAmount } of roadDecayCases) {
		knownParityGap('road-decay-not-implemented')(`ROAD-DECAY-001:${label} road on ${label} terrain decays by ${expectedDecayAmount} per interval`, async ({ shard, skip }) => {
			if (terrain !== TERRAIN_PLAIN) {
				requireCapability(shard, skip, 'terrain', 'custom terrain required for swamp/wall road decay');
			}

			if (terrain === TERRAIN_PLAIN) {
				await shard.ownedRoom('p1');
			} else {
				// Set terrain at [25,25] to the target type.
				const terrainArr = new Array(2500).fill(0);
				terrainArr[25 * 50 + 25] = terrain;
				await shard.createShard({
					players: ['p1'],
					rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1', terrain: terrainArr }],
				});
			}

			// Set hits to match the terrain-scaled maximum (engine multiplies
			// ROAD_HITS by the same ratio as decay).
			const scaledHits = ROAD_HITS * terrainHitsMultiplier[terrain];

			// Place road with terrain-appropriate hits and decay due in 3 ticks.
			const id = await shard.placeStructure('W1N1', {
				pos: [25, 25], structureType: STRUCTURE_ROAD,
				hits: scaledHits,
				ticksToDecay: 3,
			});

			const before = await shard.expectStructure(id, STRUCTURE_ROAD);
			expect(before.hits).toBe(scaledHits);

			// Tick to the decay point.
			// Engine fires at gameTime >= nextDecayTime - 1, so 3 ticks is enough.
			await shard.tick(3);

			const after = await shard.expectStructure(id, STRUCTURE_ROAD);
			expect(after.hits).toBe(scaledHits - expectedDecayAmount);
		});
	}

	// ---- ROAD-DECAY-003: road removed when hits reach 0 ----
	knownParityGap('road-decay-not-implemented')('ROAD-DECAY-003 road is removed when decay reduces hits to 0 or below', async ({ shard }) => {
		await shard.ownedRoom('p1');
		// Place road with only ROAD_DECAY_AMOUNT hits left and decay imminent.
		const id = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_ROAD,
			hits: ROAD_DECAY_AMOUNT,
			ticksToDecay: 2,
		});

		const before = await shard.expectStructure(id, STRUCTURE_ROAD);
		expect(before.hits).toBe(ROAD_DECAY_AMOUNT);

		// Tick past decay — road should be destroyed.
		await shard.tick(3);

		const obj = await shard.getObject(id);
		expect(obj).toBeNull();
	});
});
