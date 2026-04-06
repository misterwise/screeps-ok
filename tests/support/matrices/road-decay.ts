import {
	ROAD_DECAY_AMOUNT, ROAD_DECAY_TIME,
	TERRAIN_PLAIN, TERRAIN_SWAMP, TERRAIN_WALL,
} from '../../../src/index.js';

type TerrainType = typeof TERRAIN_PLAIN | typeof TERRAIN_SWAMP | typeof TERRAIN_WALL;

// Canonical road decay amount by underlying terrain category.
// Swamp roads decay at 5x the base rate; wall (tunnel) roads at 10x.
export const roadDecayCases = [
	{
		label: 'plain',
		terrain: TERRAIN_PLAIN as TerrainType,
		expectedDecayAmount: ROAD_DECAY_AMOUNT,
		expectedDecayInterval: ROAD_DECAY_TIME,
	},
	{
		label: 'swamp',
		terrain: TERRAIN_SWAMP as TerrainType,
		expectedDecayAmount: ROAD_DECAY_AMOUNT * 5,
		expectedDecayInterval: ROAD_DECAY_TIME,
	},
	{
		label: 'wall',
		terrain: TERRAIN_WALL as TerrainType,
		expectedDecayAmount: ROAD_DECAY_AMOUNT * 10,
		expectedDecayInterval: ROAD_DECAY_TIME,
	},
] as const;
