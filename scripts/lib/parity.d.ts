export interface ParityGap {
	actual?: string;
	expected?: string;
	intentional?: boolean;
	why?: string;
	tests: string[];
}

export interface Parity {
	gaps: Record<string, ParityGap>;
	gapForId: Map<string, string>;
}

export interface TestResult {
	fullName: string;
	state: string;
	file: string;
	meta?: Record<string, unknown>;
}

export interface ClassifiedTest extends TestResult {
	id: string | null;
}

export interface Classified {
	passed: ClassifiedTest[];
	expected: ClassifiedTest[];
	failed: ClassifiedTest[];
	unexpectedPasses: ClassifiedTest[];
	skipped: ClassifiedTest[];
	orphans: string[];
	idStats: Map<string, { gapId: string; passed: number; failed: number }>;
}

// Written by src/reporters/parity-reporter.ts, read by scripts/run-suite.js.
export interface ParityVerdict {
	expectedFailures: number;
	unexpectedPasses: number;
	genuineFailures: number;
	orphanedRegistrations: number;
}

export function loadParity(parityPath: string): Parity;
export function classifyResults(gapForId: Map<string, string>, results: TestResult[], options: { fullRun: boolean }): Classified;
export function reportResults(report: unknown): { results: TestResult[]; fileErrors: { file: string; message: string }[] };
export function judgeReport(report: unknown, parity: Parity): {
	classified: Classified;
	fileErrors: { file: string; message: string }[];
	verdict: ParityVerdict;
};
export function parityVerdict(classified: Classified, errorCount: number): ParityVerdict;
export function verdictIsClean(verdict: ParityVerdict): boolean;
export function parityExitCode(vitestExit: number, verdict: ParityVerdict | null): number;
