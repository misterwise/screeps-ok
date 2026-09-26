import { NUKER_ENERGY_CAPACITY, NUKER_GHODIUM_CAPACITY } from '../constants.js';

export type NukerPropCase = {
	catalogId: 'NUKER-PROPS-001';
	label: string;
	property: 'energy' | 'ghodium' | 'energyCapacity' | 'ghodiumCapacity';
	expected: number;
};

export const nukerPropCases: readonly NukerPropCase[] = [
	{
		catalogId: 'NUKER-PROPS-001',
		label: 'energyAlias',
		property: 'energy',
		expected: 12_345,
	},
	{
		catalogId: 'NUKER-PROPS-001',
		label: 'ghodiumAlias',
		property: 'ghodium',
		expected: 678,
	},
	{
		catalogId: 'NUKER-PROPS-001',
		label: 'energyCapacityAlias',
		property: 'energyCapacity',
		expected: NUKER_ENERGY_CAPACITY,
	},
	{
		catalogId: 'NUKER-PROPS-001',
		label: 'ghodiumCapacityAlias',
		property: 'ghodiumCapacity',
		expected: NUKER_GHODIUM_CAPACITY,
	},
];
