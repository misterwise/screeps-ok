import { boostTableCases, type BoostMechanic } from './boost-tables.js';

export interface BoostAggregationCase {
	label: BoostMechanic;
	bodyPart: string;
	compound: string;
	mechanic: BoostMechanic;
	multiplier: number;
	boosted: number;
	unboosted: number;
}

// One case per additive BOOSTS mechanic (all but TOUGH's `damage`): two parts
// boosted with the first compound that boosts it, beside one unboosted part.
export const boostAggregationCases: readonly BoostAggregationCase[] = [
	...new Set(boostTableCases.map(row => row.mechanic)),
].filter(mechanic => mechanic !== 'damage').map(mechanic => {
	const first = boostTableCases.find(row => row.mechanic === mechanic)!;
	return {
		label: mechanic,
		bodyPart: first.bodyPart,
		compound: first.compound,
		mechanic,
		multiplier: first.multiplier,
		boosted: 2,
		unboosted: 1,
	};
});
