import {
	ERR_FULL, ERR_INVALID_ARGS, ERR_INVALID_TARGET, ERR_NOT_ENOUGH_ENERGY,
	ERR_NOT_IN_RANGE, ERR_NOT_OWNER, ERR_RCL_NOT_ENOUGH, ERR_TIRED,
} from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

export const linkValidationCases = makeValidationCases('LINK-014', [
	{ condition: 'invalid-args', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'invalid-target', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'target-not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'source-not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'cooldown', expectedRc: ERR_TIRED },
	{ condition: 'rcl', expectedRc: ERR_RCL_NOT_ENOUGH },
	{ condition: 'not-enough', expectedRc: ERR_NOT_ENOUGH_ENERGY },
	{ condition: 'full', expectedRc: ERR_FULL },
	{ condition: 'range', expectedRc: ERR_NOT_IN_RANGE },
] as const);

export type LinkValidationCase = typeof linkValidationCases[number];
