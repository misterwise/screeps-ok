import { REACTIONS } from '../../../src/index.js';

interface LabRunCase {
	reagent1: string;
	reagent2: string;
	expectedProduct: string;
}

// Canonical lab reaction product mapping.
// One case per unique (reagent1, reagent2) → product, deduplicated so that
// symmetric pairs (A+B and B+A) only appear once.
export const labRunCases: readonly LabRunCase[] = (() => {
	const seen = new Set<string>();
	const cases: LabRunCase[] = [];
	for (const [r1, inner] of Object.entries(REACTIONS)) {
		for (const [r2, product] of Object.entries(inner)) {
			const key = [r1, r2].sort().join('+');
			if (seen.has(key)) continue;
			seen.add(key);
			cases.push({ reagent1: r1, reagent2: r2, expectedProduct: product });
		}
	}
	return cases;
})();
