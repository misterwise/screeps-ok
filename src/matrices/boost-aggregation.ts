import { BOOSTS } from '../index.js';

// Canonical list of additive boost mechanics — mechanics where the per-part
// effect is multiplied by the base output and summed across active parts.
//
// This family is about the summation pattern, not the numeric multipliers
// (those are in boost-tables.ts).
export const boostAdditivesMechanics: readonly string[] = (() => {
	const mechanics = new Set<string>();
	for (const compounds of Object.values(BOOSTS)) {
		for (const effects of Object.values(compounds)) {
			for (const mechanic of Object.keys(effects)) {
				mechanics.add(mechanic);
			}
		}
	}
	return [...mechanics].sort();
})();
