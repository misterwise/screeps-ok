import { REACTIONS } from '../index.js';

interface LabReverseCase {
	compound: string;
	expectedReagent1: string;
	expectedReagent2: string;
}

// Canonical reverse reaction mapping: compound → reagent pair.
// Built by inverting the REACTIONS table. Each compound appears exactly once.
export const labReverseCases: readonly LabReverseCase[] = (() => {
	const productToReagents = new Map<string, [string, string]>();
	for (const [r1, inner] of Object.entries(REACTIONS)) {
		for (const [r2, product] of Object.entries(inner)) {
			if (productToReagents.has(product)) continue;
			const [a, b] = [r1, r2].sort();
			productToReagents.set(product, [a, b]);
		}
	}
	return [...productToReagents.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([compound, [r1, r2]]) => ({
			compound,
			expectedReagent1: r1,
			expectedReagent2: r2,
		}));
})();
