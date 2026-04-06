import {
	DENSITY_LOW, DENSITY_MODERATE, DENSITY_HIGH, DENSITY_ULTRA,
	MINERAL_DENSITY,
} from '../../../src/index.js';

type DensityLevel = typeof DENSITY_LOW | typeof DENSITY_MODERATE | typeof DENSITY_HIGH | typeof DENSITY_ULTRA;

// Canonical mineral regeneration amount by density level.
export const mineralRegenCases = ([
	DENSITY_LOW, DENSITY_MODERATE, DENSITY_HIGH, DENSITY_ULTRA,
] as const).map(density => ({
	density,
	label: ['', 'low', 'moderate', 'high', 'ultra'][density],
	expectedAmount: MINERAL_DENSITY[density],
})) as ReadonlyArray<{ density: DensityLevel; label: string; expectedAmount: number }>;
