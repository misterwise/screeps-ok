import { COMMODITIES } from '../index.js';

interface FactoryProduceCase {
	resource: string;
	expectedAmount: number;
	expectedCooldown: number;
	expectedComponents: Record<string, number>;
	requiredLevel: number | undefined;
}

// Canonical factory recipe mapping: resource → amount, cooldown, components, level.
export const factoryProduceCases: readonly FactoryProduceCase[] =
	Object.entries(COMMODITIES)
		.map(([resource, recipe]) => ({
			resource,
			expectedAmount: recipe.amount,
			expectedCooldown: recipe.cooldown,
			expectedComponents: { ...recipe.components },
			requiredLevel: recipe.level,
		}))
		.sort((a, b) => a.resource.localeCompare(b.resource));
