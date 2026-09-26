import { ROAD_WEAROUT, ROAD_WEAROUT_POWER_CREEP } from '../index.js';

// Road wear per successful move onto a road tile: per body part for a creep, flat for a power creep.
export const roadWearCases = [
	{ label: 'creepBody1', moverType: 'creep', bodyLength: 1, expectedWear: ROAD_WEAROUT * 1 },
	{ label: 'creepBody5', moverType: 'creep', bodyLength: 5, expectedWear: ROAD_WEAROUT * 5 },
	{ label: 'creepBody50', moverType: 'creep', bodyLength: 50, expectedWear: ROAD_WEAROUT * 50 },
	{ label: 'powerCreep', moverType: 'powerCreep', bodyLength: undefined, expectedWear: ROAD_WEAROUT_POWER_CREEP },
] as const;
