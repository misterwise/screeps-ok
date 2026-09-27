import {
	ERR_FULL, ERR_INVALID_ARGS, ERR_NOT_ENOUGH_RESOURCES, ERR_NOT_OWNER,
} from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

// game/market.js:67-96.
export const marketCreateOrderValidationCases = makeValidationCases('MARKET-ORDER-002', [
	{ condition: 'invalid-resource', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'invalid-type', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'invalid-price', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'invalid-amount', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'not-enough-credits', expectedRc: ERR_NOT_ENOUGH_RESOURCES },
	{ condition: 'no-terminal', expectedRc: ERR_NOT_OWNER },
	{ condition: 'order-cap', expectedRc: ERR_FULL },
] as const, [
	// Price and amount are one expression, and the fee is their product.
	['invalid-price', 'invalid-amount'],
	['invalid-price', 'not-enough-credits'],
	['invalid-amount', 'not-enough-credits'],
]);

// game/market.js:153-167. The fee is on the order's raise.
export const marketChangeOrderPriceValidationCases = makeValidationCases('MARKET-ORDER-006', [
	{ condition: 'missing-order', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'invalid-price', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'not-enough-credits', expectedRc: ERR_NOT_ENOUGH_RESOURCES },
] as const, [
	['missing-order', 'not-enough-credits'],
	['invalid-price', 'not-enough-credits'],
]);

// game/market.js:172-186. The fee is on the added amount at the order's price.
export const marketExtendOrderValidationCases = makeValidationCases('MARKET-ORDER-008', [
	{ condition: 'missing-order', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'invalid-amount', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'not-enough-credits', expectedRc: ERR_NOT_ENOUGH_RESOURCES },
] as const, [
	['missing-order', 'not-enough-credits'],
	['invalid-amount', 'not-enough-credits'],
]);

export type MarketCreateOrderValidationCase = typeof marketCreateOrderValidationCases[number];
export type MarketChangeOrderPriceValidationCase = typeof marketChangeOrderPriceValidationCases[number];
export type MarketExtendOrderValidationCase = typeof marketExtendOrderValidationCases[number];
