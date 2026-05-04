import { ERR_BUSY, ERR_FULL, ERR_INVALID_TARGET, ERR_NOT_IN_RANGE, ERR_NOT_OWNER } from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

export const pickupValidationCases = makeValidationCases('PICKUP-010', [
	{ condition: 'not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'busy', expectedRc: ERR_BUSY },
	{ condition: 'invalid-target', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'full', expectedRc: ERR_FULL },
	{ condition: 'range', expectedRc: ERR_NOT_IN_RANGE },
] as const);

export type PickupValidationCase = typeof pickupValidationCases[number];
