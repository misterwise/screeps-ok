import {
	ERR_BUSY, ERR_FULL, ERR_INVALID_ARGS, ERR_INVALID_TARGET,
	ERR_NOT_ENOUGH_RESOURCES, ERR_NOT_IN_RANGE, ERR_NOT_OWNER,
} from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

export const withdrawValidationCases = makeValidationCases('WITHDRAW-017', [
	{ condition: 'not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'busy', expectedRc: ERR_BUSY },
	{ condition: 'invalid-args', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'invalid-resource', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'invalid-target', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'disrupted-terminal', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'target-not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'safemode-not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'invalid-nuker', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'invalid-power-bank', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'invalid-capacity', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'range', expectedRc: ERR_NOT_IN_RANGE },
	{ condition: 'full', expectedRc: ERR_FULL },
	{ condition: 'full-amount', expectedRc: ERR_FULL },
	{ condition: 'not-enough', expectedRc: ERR_NOT_ENOUGH_RESOURCES },
] as const, [
	['busy', 'safemode-not-owner'],
	// A spawning creep holds nothing: its free capacity is a whole number of CARRY parts.
	['busy', 'full-amount'],
	// A negative amount replaces the amount full-amount passes, and is never more than the target holds.
	['invalid-args', 'full-amount'],
	['invalid-args', 'not-enough'],
	['invalid-resource', 'invalid-capacity'],
	['invalid-target', 'disrupted-terminal'],
	['invalid-target', 'invalid-nuker'],
	['invalid-target', 'invalid-power-bank'],
	['invalid-target', 'invalid-capacity'],
	// A power creep can't use a power in another player's safe mode.
	['disrupted-terminal', 'safemode-not-owner'],
	['disrupted-terminal', 'invalid-nuker'],
	['disrupted-terminal', 'invalid-power-bank'],
	['disrupted-terminal', 'invalid-capacity'],
	// A power bank has no player owner for a rampart rule to apply to.
	['target-not-owner', 'invalid-power-bank'],
	['invalid-nuker', 'invalid-power-bank'],
	['invalid-power-bank', 'invalid-capacity'],
	// A store with no capacity for the resource holds none of it.
	['invalid-capacity', 'not-enough'],
]);

export type WithdrawValidationCase = typeof withdrawValidationCases[number];
