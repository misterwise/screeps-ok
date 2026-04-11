import { RUIN_DECAY, RUIN_DECAY_STRUCTURES } from '../index.js';

type OverrideStructureType = keyof typeof RUIN_DECAY_STRUCTURES;

// Canonical ruin decay time by destroyed structure type.
// Most structures use the default RUIN_DECAY; a small set has explicit overrides.
export const ruinDecayCases = [
	{
		label: 'default (most structures)',
		structureType: undefined,
		expectedDecayTime: RUIN_DECAY,
	},
	...(Object.entries(RUIN_DECAY_STRUCTURES) as [OverrideStructureType, number][]).map(
		([structureType, decayTime]) => ({
			label: structureType,
			structureType: structureType as OverrideStructureType,
			expectedDecayTime: decayTime,
		}),
	),
] as ReadonlyArray<{
	label: string;
	structureType: OverrideStructureType | undefined;
	expectedDecayTime: number;
}>;
