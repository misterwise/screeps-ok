import {
	ERR_BUSY, ERR_INVALID_ARGS, ERR_NAME_EXISTS, ERR_NOT_ENOUGH_ENERGY,
	ERR_NOT_OWNER, ERR_RCL_NOT_ENOUGH,
} from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

export const spawnCreateValidationCases = makeValidationCases('SPAWN-CREATE-014', [
	{ condition: 'missing-name', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'invalid-options', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'invalid-name-or-options', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'name-exists', expectedRc: ERR_NAME_EXISTS },
	{ condition: 'name-spawning', expectedRc: ERR_NAME_EXISTS },
	{ condition: 'name-taken', expectedRc: ERR_NAME_EXISTS },
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
	// A missing name has no length and nothing holding it.
	['missing-name', 'invalid-name-or-options'],
	['missing-name', 'name-exists'],
	['missing-name', 'name-spawning'],
	['missing-name', 'name-taken'],
	// Directions and energyStructures are fields of an options object.
	['invalid-options', 'invalid-directions'],
	['invalid-options', 'not-enough-selected'],
	// One creep holds a name, living, spawning or started this tick.
	['name-exists', 'name-spawning'],
	['name-exists', 'name-taken'],
	['name-spawning', 'name-taken'],
	// An inactive spawn can't start the spawn that makes it busy.
	['busy', 'rcl'],
	// A spawning creep's name is one spawnCreep accepted: 100 characters at most.
	['invalid-name-or-options', 'name-spawning'],
	['invalid-name-or-options', 'name-taken'],
	['invalid-body', 'oversized-body'],
	['invalid-body', 'invalid-part'],
	['oversized-body', 'invalid-part'],
	// An empty body costs nothing, and an unknown part has no cost.
	['invalid-body', 'not-enough'],
	['invalid-body', 'not-enough-selected'],
	['invalid-part', 'not-enough'],
	['invalid-part', 'not-enough-selected'],
]);

export type SpawnCreateValidationCase = typeof spawnCreateValidationCases[number];
