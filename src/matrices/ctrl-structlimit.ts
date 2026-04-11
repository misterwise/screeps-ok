import { CONTROLLER_STRUCTURES } from '../index.js';

type StructType = keyof typeof CONTROLLER_STRUCTURES;
type RCL = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

interface StructLimitCase {
	structureType: StructType;
	rcl: RCL;
	expectedCount: number;
}

// Canonical controller structure limits — one case per (structureType, rcl) pair.
// Only includes entries where the allowed count transitions (first non-zero
// appearance and each subsequent increase) to keep the case set practical.
export const ctrlStructLimitTransitionCases: readonly StructLimitCase[] = (() => {
	const cases: StructLimitCase[] = [];
	for (const [structureType, levels] of Object.entries(CONTROLLER_STRUCTURES)) {
		const byRcl = levels as Record<number, number>;
		let prev = -1;
		for (let rcl = 0; rcl <= 8; rcl++) {
			const count = byRcl[rcl];
			if (count === undefined) continue;
			if (count !== prev) {
				cases.push({ structureType: structureType as StructType, rcl: rcl as RCL, expectedCount: count });
				prev = count;
			}
		}
	}
	return cases;
})();

// Full table for exhaustive testing if needed.
export const ctrlStructLimitAllCases: readonly StructLimitCase[] = (() => {
	const cases: StructLimitCase[] = [];
	for (const [structureType, levels] of Object.entries(CONTROLLER_STRUCTURES)) {
		const byRcl = levels as Record<number, number>;
		for (let rcl = 0; rcl <= 8; rcl++) {
			const count = byRcl[rcl];
			if (count === undefined) continue;
			cases.push({ structureType: structureType as StructType, rcl: rcl as RCL, expectedCount: count });
		}
	}
	return cases;
})();
