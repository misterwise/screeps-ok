import {
	ERR_BUSY, ERR_INVALID_TARGET, ERR_NO_BODYPART, ERR_NOT_ENOUGH_RESOURCES,
	ERR_NOT_IN_RANGE, ERR_NOT_OWNER,
} from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

export const buildValidationCases = makeValidationCases('BUILD-011', [
	{ condition: 'not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'busy', expectedRc: ERR_BUSY },
	{ condition: 'no-bodypart', expectedRc: ERR_NO_BODYPART },
	{ condition: 'not-enough', expectedRc: ERR_NOT_ENOUGH_RESOURCES },
	{ condition: 'invalid-target', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'range', expectedRc: ERR_NOT_IN_RANGE },
	{ condition: 'blocked-target', expectedRc: ERR_INVALID_TARGET },
] as const);

export type BuildValidationCase = typeof buildValidationCases[number];
