// The verdict forgives failures that are all registered gaps, and fails a run
// vitest passed when a gap now passes or a registration matched no test.
export function parityExitCode(vitestExit, verdict) {
	if (!verdict) return vitestExit;
	const clean = verdict.genuineFailures === 0
		&& verdict.unexpectedPasses === 0
		&& verdict.orphanedRegistrations === 0;
	return clean ? 0 : (vitestExit || 1);
}
