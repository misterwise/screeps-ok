import {
	TOWER_POWER_ATTACK, TOWER_POWER_HEAL, TOWER_POWER_REPAIR,
	TOWER_OPTIMAL_RANGE, TOWER_FALLOFF_RANGE, TOWER_FALLOFF,
} from '../../../src/index.js';

function towerFalloffAmount(baseAmount: number, range: number): number {
	if (range <= TOWER_OPTIMAL_RANGE) return baseAmount;
	if (range >= TOWER_FALLOFF_RANGE) return Math.round(baseAmount * (1 - TOWER_FALLOFF));

	const extraRange = range - TOWER_OPTIMAL_RANGE;
	const totalFalloffRange = TOWER_FALLOFF_RANGE - TOWER_OPTIMAL_RANGE;
	const falloffFraction = extraRange / totalFalloffRange;
	const multiplier = 1 - TOWER_FALLOFF * falloffFraction;
	return Math.round(baseAmount * multiplier);
}

export const towerAttackRangeCases = [3, 10, 20].map(range => ({
	range,
	expectedAmount: towerFalloffAmount(TOWER_POWER_ATTACK, range),
})) as ReadonlyArray<{ range: 3 | 10 | 20; expectedAmount: number }>;

export const towerHealRangeCases = [3, 10, 20].map(range => ({
	range,
	expectedAmount: towerFalloffAmount(TOWER_POWER_HEAL, range),
})) as ReadonlyArray<{ range: 3 | 10 | 20; expectedAmount: number }>;

export const towerRepairRangeCases = [3, 10, 20].map(range => ({
	range,
	expectedAmount: towerFalloffAmount(TOWER_POWER_REPAIR, range),
})) as ReadonlyArray<{ range: 3 | 10 | 20; expectedAmount: number }>;
