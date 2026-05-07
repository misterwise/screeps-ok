import {
	ERR_INVALID_TARGET, ERR_NOT_FOUND, ERR_NOT_IN_RANGE, ERR_NOT_OWNER,
	ERR_RCL_NOT_ENOUGH, ERR_TIRED,
} from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

// Vanilla `StructureLab.prototype.unboostCreep` evaluates `!this.my || !target.my`
// as a single ERR_NOT_OWNER gate before the active-structure / RCL check, so both
// lab- and creep-ownership conditions sit at the same precedence level above `rcl`.
export const unboostValidationCases = makeValidationCases('UNBOOST-006', [
	{ condition: 'invalid-target', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'lab-not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'creep-not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'rcl', expectedRc: ERR_RCL_NOT_ENOUGH },
	{ condition: 'cooldown', expectedRc: ERR_TIRED },
	{ condition: 'not-found', expectedRc: ERR_NOT_FOUND },
	{ condition: 'range', expectedRc: ERR_NOT_IN_RANGE },
] as const, [
	['invalid-target', 'not-found'],
]);

export type UnboostValidationCase = typeof unboostValidationCases[number];
