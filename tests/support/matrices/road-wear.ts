import { ROAD_WEAROUT, ROAD_WEAROUT_POWER_CREEP } from '../../../src/index.js';

// Canonical road wear amount per successful move onto a road tile.
export const roadWearCases = [
	{
		label: 'creep (body length 1)',
		moverType: 'creep' as const,
		bodyLength: 1,
		expectedWear: ROAD_WEAROUT * 1,
	},
	{
		label: 'creep (body length 5)',
		moverType: 'creep' as const,
		bodyLength: 5,
		expectedWear: ROAD_WEAROUT * 5,
	},
	{
		label: 'creep (body length 50)',
		moverType: 'creep' as const,
		bodyLength: 50,
		expectedWear: ROAD_WEAROUT * 50,
	},
	{
		label: 'power creep',
		moverType: 'powerCreep' as const,
		bodyLength: undefined,
		expectedWear: ROAD_WEAROUT_POWER_CREEP,
	},
] as const;
