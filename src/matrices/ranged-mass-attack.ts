import { RANGED_ATTACK_POWER, RANGED_ATTACK_DISTANCE_RATE } from '../index.js';

type RangeBand = 1 | 2 | 3;

const RANGE_BANDS: readonly RangeBand[] = [1, 2, 3];

export const rangedMassAttackRangeCases = RANGE_BANDS.map(range => ({
	range,
	expectedDamage: Math.floor(RANGED_ATTACK_POWER * RANGED_ATTACK_DISTANCE_RATE[range]),
})) as ReadonlyArray<{ range: RangeBand; expectedDamage: number }>;
