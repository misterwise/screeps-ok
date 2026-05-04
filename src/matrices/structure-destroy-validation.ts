import { ERR_BUSY, ERR_NOT_OWNER } from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

export const structureDestroyValidationCases = makeValidationCases('STRUCTURE-API-007', [
	{ condition: 'not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'busy', expectedRc: ERR_BUSY },
] as const);

export type StructureDestroyValidationCase = typeof structureDestroyValidationCases[number];
