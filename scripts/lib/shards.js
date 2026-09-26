// CI runs each adapter in shards, and actions/download-artifact (pattern
// reports-*) lays their partial reports out as
// <artifacts-dir>/reports-<adapter>-<n>/<adapter>-partial.json.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

// A shard with no report never ran its tests: it is missing, not empty.
export function collectShards(artifactsDir, adapter, shards) {
	const found = [];
	const missing = [];
	for (let n = 1; n <= shards; n++) {
		const file = path.join(artifactsDir, `reports-${adapter}-${n}`, `${adapter}-partial.json`);
		if (existsSync(file)) found.push(file);
		else missing.push(n);
	}
	return { found, missing };
}

// One vitest JSON report from its shards' reports.
export function mergeShardReports(paths) {
	const merged = {
		testResults: [],
		numTotalTestSuites: 0,
		numPassedTestSuites: 0,
		numFailedTestSuites: 0,
		numPendingTestSuites: 0,
		numTotalTests: 0,
		numPassedTests: 0,
		numFailedTests: 0,
		numPendingTests: 0,
		startTime: Infinity,
		success: true,
	};
	for (const p of paths) {
		const r = JSON.parse(readFileSync(p, 'utf8'));
		merged.testResults.push(...(r.testResults ?? []));
		merged.numTotalTestSuites += r.numTotalTestSuites ?? 0;
		merged.numPassedTestSuites += r.numPassedTestSuites ?? 0;
		merged.numFailedTestSuites += r.numFailedTestSuites ?? 0;
		merged.numPendingTestSuites += r.numPendingTestSuites ?? 0;
		merged.numTotalTests += r.numTotalTests ?? 0;
		merged.numPassedTests += r.numPassedTests ?? 0;
		merged.numFailedTests += r.numFailedTests ?? 0;
		merged.numPendingTests += r.numPendingTests ?? 0;
		if (typeof r.startTime === 'number') merged.startTime = Math.min(merged.startTime, r.startTime);
		merged.success &&= r.success !== false;
	}
	if (!isFinite(merged.startTime)) merged.startTime = Date.now();
	return merged;
}
