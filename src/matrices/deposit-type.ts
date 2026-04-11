import {
	RESOURCE_SILICON, RESOURCE_METAL, RESOURCE_BIOMASS, RESOURCE_MIST,
} from '../index.js';

// Canonical deposit types exposed through deposit.depositType.
export const depositTypeCases = [
	{ label: 'silicon', expectedType: RESOURCE_SILICON },
	{ label: 'metal', expectedType: RESOURCE_METAL },
	{ label: 'biomass', expectedType: RESOURCE_BIOMASS },
	{ label: 'mist', expectedType: RESOURCE_MIST },
] as const;
