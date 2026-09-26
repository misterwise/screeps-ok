// Written by src/reporters/parity-reporter.ts.
export interface ParityVerdict {
	expectedFailures: number;
	unexpectedPasses: number;
	genuineFailures: number;
	orphanedRegistrations: number;
}

export function parityExitCode(vitestExit: number, verdict: ParityVerdict | null): number;
