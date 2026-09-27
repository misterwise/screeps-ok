import {
	ERR_FULL, ERR_BUSY, ERR_GCL_NOT_ENOUGH, ERR_INVALID_TARGET, ERR_NO_BODYPART,
	ERR_NOT_IN_RANGE, ERR_NOT_OWNER,
} from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

export const ctrlClaimValidationCases = makeValidationCases('CTRL-CLAIM-008', [
	{ condition: 'not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'busy', expectedRc: ERR_BUSY },
	{ condition: 'gcl-not-enough', expectedRc: ERR_GCL_NOT_ENOUGH },
	{ condition: 'novice', expectedRc: ERR_FULL },
	{ condition: 'invalid-target', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'no-bodypart', expectedRc: ERR_NO_BODYPART },
	{ condition: 'range', expectedRc: ERR_NOT_IN_RANGE },
	{ condition: 'not-controller', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'invalid-controller-state', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'hostile-reservation', expectedRc: ERR_INVALID_TARGET },
] as const, [
	// A spawning creep's room is its owner's: the controller beside it is owned.
	['busy', 'invalid-controller-state'],
	// A source (no structure) or a container (no controller) replaces the controller the last two describe.
	['invalid-target', 'not-controller'],
	['invalid-target', 'invalid-controller-state'],
	['invalid-target', 'hostile-reservation'],
	['not-controller', 'invalid-controller-state'],
	['not-controller', 'hostile-reservation'],
	['invalid-controller-state', 'hostile-reservation'],
]);

export type CtrlClaimValidationCase = typeof ctrlClaimValidationCases[number];
