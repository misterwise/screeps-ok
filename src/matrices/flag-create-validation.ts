import { ERR_FULL, ERR_INVALID_ARGS, ERR_NAME_EXISTS } from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

export const flagCreateValidationCases = makeValidationCases('FLAG-009', [
	{ condition: 'invalid-coords', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'flag-cap-full', expectedRc: ERR_FULL },
	{ condition: 'invalid-color', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'name-exists', expectedRc: ERR_NAME_EXISTS },
	{ condition: 'invalid-name-length', expectedRc: ERR_INVALID_ARGS },
] as const);

export type FlagCreateValidationCase = typeof flagCreateValidationCases[number];
