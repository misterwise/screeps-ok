import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { TestModule } from 'vitest/node';
import ParityReporter from '../../src/reporters/parity-reporter.js';
import { judgeReport, loadParity, parityExitCode } from '../../scripts/lib/parity.js';

type State = 'passed' | 'failed' | 'skipped';

const dirs: string[] = [];
afterEach(() => {
	vi.restoreAllMocks();
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempDir() {
	const dir = mkdtempSync(path.join(tmpdir(), 'screeps-ok-parity-'));
	dirs.push(dir);
	return dir;
}

const TEST_FILE = '/suite/tests/01-section/1.1-some.test.ts';

function gap(tests: string[]) {
	return { actual: 'the engine does one thing', expected: 'vanilla does another', tests };
}

// Runs the reporter over fake results against a parity.json holding `tests`.
function verdictFor(tests: string[], results: [string, State][], fullRun: boolean, errors: { module?: string[]; unhandled?: string[] } = {}) {
	const dir = tempDir();
	writeFileSync(path.join(dir, 'parity.json'), JSON.stringify({
		expected_failures: { 'some-gap': gap(tests) },
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
		[{ moduleId: TEST_FILE, children: { allTests: () => cases }, errors: () => moduleErrors } as unknown as TestModule],
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
			expectedFailures: 1, unexpectedPasses: 0, genuineFailures: 0, orphanedRegistrations: 1, untaggedTests: 0,
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
			expectedFailures: 1, unexpectedPasses: 0, genuineFailures: 0, orphanedRegistrations: 0, untaggedTests: 0,
		});
	});

	test('a bare id\'s registration gates every `:row` of it', () => {
		const verdict = verdictFor(['GAP-001'], [
			['GAP-001:rowA fails as registered', 'failed'],
			['GAP-001:rowB passes beside it', 'passed'],
		], true);
		expect(verdict).toEqual({
			expectedFailures: 1, unexpectedPasses: 0, genuineFailures: 0, orphanedRegistrations: 0, untaggedTests: 0,
		});
		expect(verdictFor(['GAP-001'], [['GAP-001:rowA passes', 'passed']], true).unexpectedPasses).toBe(1);
	});

	test('a row\'s own registration wins over its bare id\'s', () => {
		const dir = tempDir();
		writeFileSync(path.join(dir, 'parity.json'), JSON.stringify({
			expected_failures: { 'row-gap': gap(['GAP-001:rowB']), 'base-gap': gap(['GAP-001']) },
		}));
		const judged = judgeReport({ testResults: [{
			name: TEST_FILE,
			message: '',
			assertionResults: [
				{ fullName: 'GAP-001:rowA fails', status: 'failed' },
				{ fullName: 'GAP-001:rowB passes', status: 'passed' },
			],
		}] }, loadParity(path.join(dir, 'parity.json')));
		expect(judged.verdict).toMatchObject({ expectedFailures: 1, unexpectedPasses: 1 });
		expect(judged.classified.expected.map(t => t.gapId)).toEqual(['base-gap']);
	});

	test('a name that runs on past an id carries no id to register', () => {
		const verdict = verdictFor(['GAP-002', 'GENERATE-OPS-001'], [
			['GAP-002a fails', 'failed'],
			['POWER-GENERATE-OPS-001 fails', 'failed'],
		], false);
		expect(verdict).toMatchObject({ expectedFailures: 0, genuineFailures: 2 });
	});

	test('a catalog test whose name carries no single id fails the run', () => {
		const verdict = verdictFor(['GAP-001'], [
			['GAP-001 fails as registered', 'failed'],
			['GAP-002a passes under an id no tool reads', 'passed'],
			['GAP-002 and GAP-003 pass together', 'passed'],
		], false);
		expect(verdict.untaggedTests).toBe(2);
		expect(parityExitCode(1, verdict)).toBe(1);
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
		const dir = tempDir();
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

	test('a parity.json that breaks the schema throws, naming what broke', () => {
		const throwsOn = (parity: object, pattern: RegExp) =>
			expect(() => reporterOver(JSON.stringify(parity)).onInit()).toThrow(pattern);
		throwsOn({ expected_failure: {} }, /expected_failure/);
		throwsOn({ expected_failures: { 'old-gap': { ...gap(['GAP-001']), summary: 'legacy' } } }, /old-gap.*summary/);
		throwsOn({ expected_failures: { 'no-gap': { actual: 'a', expected: 'e' } } }, /no-gap.*tests/);
		throwsOn({ expected_failures: { 'empty-gap': gap([]) } }, /empty-gap.*tests/);
		throwsOn({ expected_failures: { 'bad-gap': gap(['GAP-002a']) } }, /bad-gap.*GAP-002a/);
		throwsOn({ expected_failures: { 'vague-gap': { expected: 'e', tests: ['GAP-001'] } } }, /vague-gap.*actual/);
		throwsOn({ expected_failures: { 'one-gap': gap(['GAP-001']), 'two-gap': gap(['GAP-001']) } }, /GAP-001.*one-gap.*two-gap/);
		throwsOn({ expected_passes: ['no-such-gap'] }, /no-such-gap/);
	});
});

describe('parity exit code', () => {
	const clean = { expectedFailures: 3, unexpectedPasses: 0, genuineFailures: 0, orphanedRegistrations: 0, untaggedTests: 0 };

	test('forgives failures that are all registered gaps', () => {
		expect(parityExitCode(1, clean)).toBe(0);
	});

	test('fails a run vitest passed when a gap now passes or a registration is orphaned', () => {
		expect(parityExitCode(0, { ...clean, unexpectedPasses: 1 })).toBe(1);
		expect(parityExitCode(0, { ...clean, orphanedRegistrations: 1 })).toBe(1);
		expect(parityExitCode(0, { ...clean, untaggedTests: 1 })).toBe(1);
	});

	test('keeps vitest\'s code for genuine failures and when no verdict was written', () => {
		expect(parityExitCode(1, { ...clean, genuineFailures: 1 })).toBe(1);
		expect(parityExitCode(0, null)).toBe(0);
		expect(parityExitCode(1, null)).toBe(1);
	});

	test('keeps vitest\'s failure when the verdict saw nothing to forgive', () => {
		expect(parityExitCode(1, { ...clean, expectedFailures: 0 })).toBe(1);
	});
});

describe('JSON reports', () => {
	function report(files: { tests: [string, State][]; message?: string; name?: string }[]) {
		return {
			testResults: files.map((f, i) => ({
				name: f.name ?? `/suite/tests/01-section/1.${i}-some.test.ts`,
				message: f.message ?? '',
				assertionResults: f.tests.map(([fullName, status]) => ({ fullName, status })),
			})),
		};
	}

	test('a report gets the verdict the reporter gives the same results live', () => {
		const results: [string, State][] = [
			['GAP-001 fails as registered', 'failed'],
			['GAP-003 passes although registered', 'passed'],
			['OTHER-001 fails', 'failed'],
		];
		const dir = tempDir();
		writeFileSync(path.join(dir, 'parity.json'), JSON.stringify({
			expected_failures: { 'some-gap': gap(['GAP-001', 'GAP-002', 'GAP-003']) },
		}));
		const judged = judgeReport(report([{ tests: results }, { tests: [], message: 'SyntaxError' }]), loadParity(path.join(dir, 'parity.json')));
		expect(judged.verdict).toEqual(verdictFor(['GAP-001', 'GAP-002', 'GAP-003'], results, true, { module: ['SyntaxError'] }));
		expect(judged.verdict).toEqual({
			expectedFailures: 1, unexpectedPasses: 1, genuineFailures: 2, orphanedRegistrations: 1, untaggedTests: 0,
		});
	});

	test('framework and contract sections need no catalog ids', () => {
		const judged = judgeReport(report([
			{ name: '/suite/tests/00-framework/some.test.ts', tests: [['reporter behaves', 'passed']] },
			{ name: '/suite/tests/00-adapter-contract/some.test.ts', tests: [['tick advances one tick', 'passed']] },
		]), { gaps: {}, gapForId: new Map() });
		expect(judged.verdict.untaggedTests).toBe(0);
	});

	test('a report is judged by the overlay merged onto its base', () => {
		const dir = tempDir();
		writeFileSync(path.join(dir, 'base.json'), JSON.stringify({
			expected_failures: { 'fixed-gap': gap(['GAP-001']), 'base-gap': gap(['GAP-002']) },
		}));
		writeFileSync(path.join(dir, 'parity.json'), JSON.stringify({
			extends: './base.json',
			expected_failures: { 'own-gap': gap(['GAP-003']) },
			expected_passes: ['fixed-gap'],
		}));
		const judged = judgeReport(report([{ tests: [
			['GAP-001 passes once fixed', 'passed'],
			['GAP-002 fails as the base registers', 'failed'],
			['GAP-003 fails as the overlay registers', 'failed'],
		] }]), loadParity(path.join(dir, 'parity.json')));
		expect(judged.verdict).toEqual({
			expectedFailures: 2, unexpectedPasses: 0, genuineFailures: 0, orphanedRegistrations: 0, untaggedTests: 0,
		});
	});
});
