import {
	ERR_INVALID_ARGS, ERR_NOT_ENOUGH_RESOURCES, ERR_NOT_OWNER, ERR_RCL_NOT_ENOUGH, ERR_TIRED,
} from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

export const terminalSendValidationCases = makeValidationCases('TERMINAL-SEND-013', [
	{ condition: 'not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'rcl', expectedRc: ERR_RCL_NOT_ENOUGH },
	{ condition: 'invalid-room', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'invalid-resource', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'not-enough-amount', expectedRc: ERR_NOT_ENOUGH_RESOURCES },
	{ condition: 'cooldown', expectedRc: ERR_TIRED },
	{ condition: 'not-enough-energy-cost', expectedRc: ERR_NOT_ENOUGH_RESOURCES },
	{ condition: 'invalid-description', expectedRc: ERR_INVALID_ARGS },
] as const);

export type TerminalSendValidationCase = typeof terminalSendValidationCases[number];
