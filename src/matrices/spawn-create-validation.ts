import {
	ERR_BUSY, ERR_INVALID_ARGS, ERR_NAME_EXISTS, ERR_NOT_ENOUGH_ENERGY,
	ERR_NOT_OWNER, ERR_RCL_NOT_ENOUGH,
} from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

export const spawnCreateValidationCases = makeValidationCases('SPAWN-CREATE-014', [
	{ condition: 'invalid-name-or-options', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'name-exists', expectedRc: ERR_NAME_EXISTS },
	{ condition: 'name-spawning', expectedRc: ERR_NAME_EXISTS },
	{ condition: 'invalid-directions', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'busy', expectedRc: ERR_BUSY },
	{ condition: 'rcl', expectedRc: ERR_RCL_NOT_ENOUGH },
	{ condition: 'invalid-body', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'oversized-body', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'invalid-part', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'not-enough', expectedRc: ERR_NOT_ENOUGH_ENERGY },
	{ condition: 'not-enough-selected', expectedRc: ERR_NOT_ENOUGH_ENERGY },
] as const, [
	// One creep holds a name, living or spawning.
	['name-exists', 'name-spawning'],
	// An inactive spawn can't start the spawn that makes it busy.
	['busy', 'rcl'],
	['invalid-body', 'oversized-body'],
	['invalid-body', 'invalid-part'],
	['oversized-body', 'invalid-part'],
]);

export type SpawnCreateValidationCase = typeof spawnCreateValidationCases[number];
