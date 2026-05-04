import {
	ERR_INVALID_TARGET, ERR_NOT_ENOUGH_RESOURCES, ERR_NOT_FOUND, ERR_NOT_IN_RANGE,
	ERR_NOT_OWNER, ERR_RCL_NOT_ENOUGH,
} from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

export const boostCreepValidationCases = makeValidationCases('BOOST-CREEP-010', [
	{ condition: 'not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'rcl', expectedRc: ERR_RCL_NOT_ENOUGH },
	{ condition: 'invalid-target', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'range', expectedRc: ERR_NOT_IN_RANGE },
	{ condition: 'not-enough-energy', expectedRc: ERR_NOT_ENOUGH_RESOURCES },
	{ condition: 'not-enough-mineral', expectedRc: ERR_NOT_ENOUGH_RESOURCES },
	{ condition: 'not-found', expectedRc: ERR_NOT_FOUND },
] as const);

export type BoostCreepValidationCase = typeof boostCreepValidationCases[number];
