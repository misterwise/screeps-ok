import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { collectShards, mergeShardReports } from '../../scripts/lib/shards.js';

const dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function artifacts(shards: Record<string, string[]>) {
	const root = mkdtempSync(path.join(tmpdir(), 'screeps-ok-shards-'));
	dirs.push(root);
	for (const [dir, names] of Object.entries(shards)) {
		const [, adapter] = /^reports-(.+)-\d+$/.exec(dir)!;
		mkdirSync(path.join(root, dir));
		writeFileSync(path.join(root, dir, `${adapter}-partial.json`), JSON.stringify({
			testResults: [{ name: `/ci/tests/01-a/${dir}.test.ts`, assertionResults: names.map(fullName => ({ fullName, status: 'passed' })) }],
			numTotalTests: names.length,
			numPassedTests: names.length,
			success: true,
		}));
	}
	return root;
}

describe('CI shard merge', () => {
	test('a shard that wrote no report is missing, not empty', () => {
		const root = artifacts({ 'reports-xxscreeps-1': ['GAP-001 a'], 'reports-xxscreeps-3': ['GAP-003 c'], 'reports-vanilla-2': [] });
		mkdirSync(path.join(root, 'reports-xxscreeps-2'));
		expect(collectShards(root, 'xxscreeps', 3).missing).toEqual([2]);
		expect(collectShards(root, 'vanilla', 3).missing).toEqual([1, 3]);
	});

	test('merges every shard\'s tests into one report', () => {
		const root = artifacts({ 'reports-xxscreeps-1': ['GAP-001 a', 'GAP-002 b'], 'reports-xxscreeps-2': ['GAP-003 c'] });
		const merged = mergeShardReports(collectShards(root, 'xxscreeps', 2).found);
		expect(merged.numTotalTests).toBe(3);
		expect(merged.testResults).toHaveLength(2);
	});
});
