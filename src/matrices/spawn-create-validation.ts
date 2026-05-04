import {
	ERR_BUSY, ERR_INVALID_ARGS, ERR_NAME_EXISTS, ERR_NOT_ENOUGH_ENERGY,
	ERR_NOT_OWNER,
} from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

export const spawnCreateValidationCases = makeValidationCases('SPAWN-CREATE-014', [
	{ condition: 'invalid-name-or-options', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'name-exists', expectedRc: ERR_NAME_EXISTS },
	{ condition: 'invalid-directions', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'busy', expectedRc: ERR_BUSY },
	{ condition: 'invalid-body', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'not-enough', expectedRc: ERR_NOT_ENOUGH_ENERGY },
] as const);

export type SpawnCreateValidationCase = typeof spawnCreateValidationCases[number];
