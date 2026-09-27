import { ERR_BUSY, ERR_NOT_OWNER } from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

export const structureDestroyValidationCases = makeValidationCases('STRUCTURE-API-007', [
	{ condition: 'not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'neutral-controller', expectedRc: ERR_NOT_OWNER },
	{ condition: 'no-controller', expectedRc: ERR_NOT_OWNER },
	{ condition: 'busy', expectedRc: ERR_BUSY },
	{ condition: 'busy-power-creep', expectedRc: ERR_BUSY },
] as const, [
	// A room's controller is another player's, nobody's, or it has none.
	['not-owner', 'neutral-controller'],
	['not-owner', 'no-controller'],
	['neutral-controller', 'no-controller'],
]);

export type StructureDestroyValidationCase = typeof structureDestroyValidationCases[number];
