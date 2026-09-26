import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { TestModule } from 'vitest/node';
import ParityReporter from '../../src/reporters/parity-reporter.js';
import { parityExitCode } from '../../scripts/lib/parity-verdict.js';

type State = 'passed' | 'failed' | 'skipped';

const dirs: string[] = [];
afterEach(() => {
	vi.restoreAllMocks();
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

// Runs the reporter over fake results against a parity.json holding `tests`.
function verdictFor(tests: string[], results: [string, State][], fullRun: boolean, errors: { module?: string[]; unhandled?: string[] } = {}) {
	const dir = mkdtempSync(path.join(tmpdir(), 'screeps-ok-parity-'));
	dirs.push(dir);
	writeFileSync(path.join(dir, 'parity.json'), JSON.stringify({
		expected_failures: { 'some-gap': { tests } },
	}));
	const verdictPath = path.join(dir, 'verdict.json');
	const reporter = new ParityReporter({
		env: {
			SCREEPS_OK_ADAPTER: path.join(dir, 'index.ts'),
			SCREEPS_OK_PARITY_VERDICT: verdictPath,
			SCREEPS_OK_FULL_RUN: fullRun ? '1' : '0',
		},
	});
	reporter.onInit();
	vi.spyOn(console, 'log').mockImplementation(() => {});
	const cases = results.map(([fullName, state]) => ({ fullName, result: () => ({ state }) }));
	const moduleErrors = (errors.module ?? []).map(message => ({ message }));
	const unhandled = (errors.unhandled ?? []).map(message => ({ message }));
	reporter.onTestRunEnd(
		[{ children: { allTests: () => cases }, errors: () => moduleErrors } as unknown as TestModule],
		unhandled as never,
	);
	return JSON.parse(readFileSync(verdictPath, 'utf8'));
}

describe('parity reporter', () => {
	test('a full run counts a registration no test ran as orphaned', () => {
		const verdict = verdictFor(['GAP-001', 'GAP-002'], [
			['GAP-001 fails as registered', 'failed'],
			['OTHER-001 passes', 'passed'],
		], true);
		expect(verdict).toEqual({
			expectedFailures: 1, unexpectedPasses: 0, genuineFailures: 0, orphanedRegistrations: 1,
		});
	});

	test('a registration whose tests only skipped is orphaned', () => {
		const verdict = verdictFor(['GAP-001:rowA'], [
			['GAP-001:rowA skipped by capability', 'skipped'],
		], true);
		expect(verdict.orphanedRegistrations).toBe(1);
	});

	test('a file that fails to collect or an unhandled error is a genuine failure', () => {
		const registered: [string, State][] = [['GAP-001 fails as registered', 'failed']];
		expect(verdictFor(['GAP-001'], registered, true, { module: ['SyntaxError'] }).genuineFailures).toBe(1);
		expect(verdictFor(['GAP-001'], registered, true, { unhandled: ['TypeError'] }).genuineFailures).toBe(1);
	});

	test('a test\'s `:row` id wins over its describe\'s bare id', () => {
		const verdict = verdictFor(['GAP-001:rowA'], [
			['GAP-001: group GAP-001:rowA fails as registered', 'failed'],
		], true);
		expect(verdict).toEqual({
			expectedFailures: 1, unexpectedPasses: 0, genuineFailures: 0, orphanedRegistrations: 0,
		});
	});

	test('a name that runs on past an id carries no id to register', () => {
		const verdict = verdictFor(['GAP-002', 'GENERATE-OPS-001'], [
			['GAP-002a fails', 'failed'],
			['POWER-GENERATE-OPS-001 fails', 'failed'],
		], false);
		expect(verdict).toMatchObject({ expectedFailures: 0, genuineFailures: 2 });
	});

	test('a filtered or sharded run does not count orphans', () => {
		const verdict = verdictFor(['GAP-001', 'GAP-002'], [
			['GAP-001 fails as registered', 'failed'],
		], false);
		expect(verdict.orphanedRegistrations).toBe(0);
	});
});

describe('parity file loading', () => {
	function reporterOver(parityText: string | null) {
		const dir = mkdtempSync(path.join(tmpdir(), 'screeps-ok-parity-'));
		dirs.push(dir);
		if (parityText !== null) writeFileSync(path.join(dir, 'parity.json'), parityText);
		return new ParityReporter({ env: { SCREEPS_OK_ADAPTER: path.join(dir, 'index.ts') } });
	}

	test('a missing parity.json means no registrations', () => {
		expect(() => reporterOver(null).onInit()).not.toThrow();
	});

	test('a malformed parity.json or an unresolvable extends throws', () => {
		expect(() => reporterOver('{ "expected_failures": ').onInit()).toThrow();
		expect(() => reporterOver('{ "extends": "no-such-package/parity.json" }').onInit()).toThrow(/no-such-package/);
	});
});

describe('parity exit code', () => {
	const clean = { expectedFailures: 3, unexpectedPasses: 0, genuineFailures: 0, orphanedRegistrations: 0 };

	test('forgives failures that are all registered gaps', () => {
		expect(parityExitCode(1, clean)).toBe(0);
	});

	test('fails a run vitest passed when a gap now passes or a registration is orphaned', () => {
		expect(parityExitCode(0, { ...clean, unexpectedPasses: 1 })).toBe(1);
		expect(parityExitCode(0, { ...clean, orphanedRegistrations: 1 })).toBe(1);
	});

	test('keeps vitest\'s code for genuine failures and when no verdict was written', () => {
		expect(parityExitCode(1, { ...clean, genuineFailures: 1 })).toBe(1);
		expect(parityExitCode(0, null)).toBe(0);
		expect(parityExitCode(1, null)).toBe(1);
	});
});
