import { RAMPART_HITS_MAX } from '../index.js';

export const rampartHitsMaxCases = [2, 3, 4, 5, 6, 7, 8].map(rcl => ({
	rcl: rcl as 2 | 3 | 4 | 5 | 6 | 7 | 8,
	expectedHitsMax: RAMPART_HITS_MAX[rcl as keyof typeof RAMPART_HITS_MAX],
})) as ReadonlyArray<{ rcl: 2 | 3 | 4 | 5 | 6 | 7 | 8; expectedHitsMax: number }>;
