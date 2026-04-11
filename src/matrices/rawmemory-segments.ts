import {
	MAX_ACTIVE_SEGMENTS, MAX_SEGMENT_COUNT, MAX_SEGMENT_SIZE,
} from '../index.js';

// Canonical RawMemory segment limits.
export const rawMemorySegmentLimits = {
	maxSegmentCount: MAX_SEGMENT_COUNT,
	validIdRange: { min: 0, max: MAX_SEGMENT_COUNT - 1 },
	maxActiveSegments: MAX_ACTIVE_SEGMENTS,
	maxSegmentSize: MAX_SEGMENT_SIZE,
} as const;
