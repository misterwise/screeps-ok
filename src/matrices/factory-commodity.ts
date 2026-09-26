import { COMMODITIES } from '../index.js';
import { toLabelToken } from './validation-cases.js';

interface FactoryCommodityCase {
	resource: string;
	label: string;
	requiredLevel: number | undefined;
}

// Canonical commodity resource → required factory level mapping.
// Resources without a level field can be produced by any factory (level undefined).
export const factoryCommodityCases: readonly FactoryCommodityCase[] =
	Object.entries(COMMODITIES)
		.map(([resource, recipe]) => ({
			resource,
			label: toLabelToken(resource),
			requiredLevel: recipe.level,
		}))
		.sort((a, b) => a.resource.localeCompare(b.resource));
