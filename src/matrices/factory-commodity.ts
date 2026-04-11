import { COMMODITIES } from '../index.js';

interface FactoryCommodityCase {
	resource: string;
	requiredLevel: number | undefined;
}

// Canonical commodity resource → required factory level mapping.
// Resources without a level field can be produced by any factory (level undefined).
export const factoryCommodityCases: readonly FactoryCommodityCase[] =
	Object.entries(COMMODITIES)
		.map(([resource, recipe]) => ({
			resource,
			requiredLevel: recipe.level,
		}))
		.sort((a, b) => a.resource.localeCompare(b.resource));
