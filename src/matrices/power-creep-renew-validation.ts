import {
	ERR_BUSY, ERR_INVALID_TARGET, ERR_NOT_IN_RANGE, ERR_NOT_OWNER, ERR_RCL_NOT_ENOUGH,
} from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

// A hostile power creep is only reachable while spawned, an unspawned creep has
// no position to be out of range from, and an inactive power spawn only matters
// when it is the target.
export const powerCreepRenewValidationCases = makeValidationCases('POWERCREEP-RENEW-002', [
	{ condition: 'not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'busy', expectedRc: ERR_BUSY },
	{ condition: 'invalid-target', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'rcl', expectedRc: ERR_RCL_NOT_ENOUGH },
	{ condition: 'range', expectedRc: ERR_NOT_IN_RANGE },
] as const, [
	['not-owner', 'busy'],
	['busy', 'range'],
	['invalid-target', 'rcl'],
]);

export type PowerCreepRenewValidationCase = typeof powerCreepRenewValidationCases[number];
