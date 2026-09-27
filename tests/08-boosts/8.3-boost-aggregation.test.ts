import { describe, test, expect } from '../../src/index.js';
import { boostAggregationCases } from '../../src/matrices/boost-aggregation.js';
import { expectedBoostedEffect, measureBoostedEffect } from '../boost-helpers.js';

describe('BOOST-AGGREGATION-001 per-part boost aggregation', () => {
	for (const row of boostAggregationCases) {
		test(`BOOST-AGGREGATION-001:${row.label} ${row.boosted} ${row.compound} and ${row.unboosted} unboosted ${row.bodyPart} parts sum their ${row.mechanic}`, async ({ shard }) => {
			shard.requires('chemistry');
			const { effect } = await measureBoostedEffect(shard, row);
			expect(effect).toBe(expectedBoostedEffect(row));
		});
	}
});
