import { COMMODITIES } from '../index.js';
import { toLabelToken } from './validation-cases.js';

interface FactoryProduceCase {
	resource: string;
	label: string;
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
			label: toLabelToken(resource),
			expectedAmount: recipe.amount,
			expectedCooldown: recipe.cooldown,
			expectedComponents: { ...recipe.components },
			requiredLevel: recipe.level,
		}))
		.sort((a, b) => a.resource.localeCompare(b.resource));
