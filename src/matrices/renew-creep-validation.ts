import {
	ERR_BUSY, ERR_FULL, ERR_INVALID_TARGET, ERR_NOT_ENOUGH_ENERGY,
	ERR_NOT_IN_RANGE, ERR_NOT_OWNER, ERR_RCL_NOT_ENOUGH,
} from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

export const renewCreepValidationCases = makeValidationCases('RENEW-CREEP-011', [
	{ condition: 'busy', expectedRc: ERR_BUSY },
	{ condition: 'invalid-target', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'spawning-target', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'claim-part', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'not-owner-creep', expectedRc: ERR_NOT_OWNER },
	{ condition: 'rcl', expectedRc: ERR_RCL_NOT_ENOUGH },
	{ condition: 'range', expectedRc: ERR_NOT_IN_RANGE },
	{ condition: 'not-enough', expectedRc: ERR_NOT_ENOUGH_ENERGY },
	{ condition: 'full', expectedRc: ERR_FULL },
] as const, [
	// An inactive spawn can't start the spawn that makes it busy.
	['busy', 'rcl'],
	// A source replaces the creep whose state, body, owner and age the others describe.
	['invalid-target', 'spawning-target'],
	['invalid-target', 'claim-part'],
	['invalid-target', 'not-owner-creep'],
	['invalid-target', 'full'],
	// A spawning creep has no ticksToLive to overfill.
	['spawning-target', 'full'],
]);

export type RenewCreepValidationCase = typeof renewCreepValidationCases[number];
