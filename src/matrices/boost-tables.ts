import { BOOSTS } from '../index.js';

interface BoostTableCase {
	bodyPart: string;
	compound: string;
	mechanic: string;
	expectedMultiplier: number;
}

// Canonical boost compound → mechanic multiplier mapping.
// One case per (bodyPart, compound, mechanic) triple.
export const boostTableCases: readonly BoostTableCase[] = (() => {
	const cases: BoostTableCase[] = [];
	for (const [bodyPart, compounds] of Object.entries(BOOSTS)) {
		for (const [compound, effects] of Object.entries(compounds)) {
			for (const [mechanic, multiplier] of Object.entries(effects)) {
				cases.push({ bodyPart, compound, mechanic, expectedMultiplier: multiplier });
			}
		}
	}
	return cases;
})();
