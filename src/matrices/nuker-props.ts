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
		label: 'energy-alias',
		property: 'energy',
		expected: 12_345,
	},
	{
		catalogId: 'NUKER-PROPS-001',
		label: 'ghodium-alias',
		property: 'ghodium',
		expected: 678,
	},
	{
		catalogId: 'NUKER-PROPS-001',
		label: 'energy-capacity-alias',
		property: 'energyCapacity',
		expected: NUKER_ENERGY_CAPACITY,
	},
	{
		catalogId: 'NUKER-PROPS-001',
		label: 'ghodium-capacity-alias',
		property: 'ghodiumCapacity',
		expected: NUKER_GHODIUM_CAPACITY,
	},
];
