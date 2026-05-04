import {
	ERR_BUSY, ERR_NOT_ENOUGH_RESOURCES, ERR_NOT_OWNER, ERR_TIRED,
} from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

export const ctrlSafemodeValidationCases = makeValidationCases('CTRL-SAFEMODE-009', [
	{ condition: 'not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'not-enough', expectedRc: ERR_NOT_ENOUGH_RESOURCES },
	{ condition: 'cooldown', expectedRc: ERR_TIRED },
	{ condition: 'busy', expectedRc: ERR_BUSY },
] as const, [
	['cooldown', 'busy'],
]);

export type CtrlSafemodeValidationCase = typeof ctrlSafemodeValidationCases[number];
