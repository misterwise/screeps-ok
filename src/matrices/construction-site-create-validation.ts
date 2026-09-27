import {
	ERR_FULL, ERR_INVALID_ARGS, ERR_INVALID_TARGET, ERR_NOT_OWNER, ERR_RCL_NOT_ENOUGH,
} from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

export const constructionSiteCreateValidationCases = makeValidationCases('CONSTRUCTION-SITE-011', [
	{ condition: 'invalid-coords', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'invalid-type', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'invalid-args', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'hostile-reservation', expectedRc: ERR_NOT_OWNER },
	{ condition: 'rcl-or-structure-cap', expectedRc: ERR_RCL_NOT_ENOUGH },
	{ condition: 'invalid-target', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'wall-terrain', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'site-cap-full', expectedRc: ERR_FULL },
] as const, [
	['invalid-coords', 'invalid-target'],
	['invalid-coords', 'wall-terrain'],
	['invalid-type', 'invalid-args'],
	['invalid-type', 'rcl-or-structure-cap'],
	['not-owner', 'hostile-reservation'],
	['invalid-target', 'wall-terrain'],
]);

export type ConstructionSiteCreateValidationCase = typeof constructionSiteCreateValidationCases[number];
