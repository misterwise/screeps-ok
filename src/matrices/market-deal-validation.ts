import {
	ERR_FULL, ERR_INVALID_ARGS, ERR_NOT_ENOUGH_RESOURCES, ERR_NOT_OWNER, ERR_TIRED,
} from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

// game/market.js:107-153, the path for a resource that isn't intershard.
export const marketDealValidationCases = makeValidationCases('MARKET-DEAL-003', [
	{ condition: 'missing-order', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'invalid-amount', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'no-target-room', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'no-terminal', expectedRc: ERR_NOT_OWNER },
	{ condition: 'terminal-energy', expectedRc: ERR_NOT_ENOUGH_RESOURCES },
	{ condition: 'cooldown', expectedRc: ERR_TIRED },
	{ condition: 'traded-resource', expectedRc: ERR_NOT_ENOUGH_RESOURCES },
	{ condition: 'not-enough-credits', expectedRc: ERR_NOT_ENOUGH_RESOURCES },
	{ condition: 'deal-cap', expectedRc: ERR_FULL },
] as const, [
	// The order decides the transfer cost and whether it is bought or sold.
	['missing-order', 'terminal-energy'],
	['missing-order', 'traded-resource'],
	['missing-order', 'not-enough-credits'],
	// The cost and both stocks are measured against the amount.
	['invalid-amount', 'terminal-energy'],
	['invalid-amount', 'traded-resource'],
	['invalid-amount', 'not-enough-credits'],
	// The terminal is the target room's.
	['no-target-room', 'no-terminal'],
	['no-target-room', 'terminal-energy'],
	['no-target-room', 'cooldown'],
	['no-target-room', 'traded-resource'],
	['no-terminal', 'terminal-energy'],
	['no-terminal', 'cooldown'],
	['no-terminal', 'traded-resource'],
	// A buy order checks the terminal's stock, a sell order the credits.
	['traded-resource', 'not-enough-credits'],
]);

export type MarketDealValidationCase = typeof marketDealValidationCases[number];
