import {
	ERR_BUSY, ERR_FULL, ERR_INVALID_TARGET, ERR_NOT_ENOUGH_ENERGY,
	ERR_NOT_IN_RANGE, ERR_NOT_OWNER,
} from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

export const renewCreepValidationCases = makeValidationCases('RENEW-CREEP-011', [
	{ condition: 'busy', expectedRc: ERR_BUSY },
	{ condition: 'invalid-target', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'range', expectedRc: ERR_NOT_IN_RANGE },
	{ condition: 'not-enough', expectedRc: ERR_NOT_ENOUGH_ENERGY },
	{ condition: 'full', expectedRc: ERR_FULL },
] as const);

export type RenewCreepValidationCase = typeof renewCreepValidationCases[number];
