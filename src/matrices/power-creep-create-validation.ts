import { ERR_INVALID_ARGS, ERR_NAME_EXISTS, ERR_NOT_ENOUGH_RESOURCES } from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

export const powerCreepCreateValidationCases = makeValidationCases('POWERCREEP-CREATE-002', [
	{ condition: 'invalid-name', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'no-free-levels', expectedRc: ERR_NOT_ENOUGH_RESOURCES },
	{ condition: 'name-exists', expectedRc: ERR_NAME_EXISTS },
	{ condition: 'invalid-class', expectedRc: ERR_INVALID_ARGS },
] as const, [
	// No power creep holds a name create refuses.
	['invalid-name', 'name-exists'],
]);

export type PowerCreepCreateValidationCase = typeof powerCreepCreateValidationCases[number];
