import {
	ROAD_DECAY_AMOUNT, ROAD_DECAY_TIME,
	TERRAIN_PLAIN, TERRAIN_SWAMP, TERRAIN_WALL,
	CONSTRUCTION_COST_ROAD_SWAMP_RATIO, CONSTRUCTION_COST_ROAD_WALL_RATIO,
} from '../index.js';

type TerrainType = typeof TERRAIN_PLAIN | typeof TERRAIN_SWAMP | typeof TERRAIN_WALL;

// Canonical road decay amount by underlying terrain category.
// The engine multiplies ROAD_DECAY_AMOUNT by the same ratio used for
// construction cost: CONSTRUCTION_COST_ROAD_SWAMP_RATIO (5) for swamp,
// CONSTRUCTION_COST_ROAD_WALL_RATIO (150) for wall/tunnel.
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
		expectedDecayAmount: ROAD_DECAY_AMOUNT * CONSTRUCTION_COST_ROAD_SWAMP_RATIO,
		expectedDecayInterval: ROAD_DECAY_TIME,
	},
	{
		label: 'wall',
		terrain: TERRAIN_WALL as TerrainType,
		expectedDecayAmount: ROAD_DECAY_AMOUNT * CONSTRUCTION_COST_ROAD_WALL_RATIO,
		expectedDecayInterval: ROAD_DECAY_TIME,
	},
] as const;
