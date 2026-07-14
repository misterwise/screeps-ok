import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { packageRoot, runSuite } from './run-suite.js';

const args = process.argv.slice(2);
const adapters = [];
const vitestArgs = [];
let showHelp = false;

while (args.length > 0) {
	const arg = args.shift();
	if (!arg) continue;

	if (arg === '--help' || arg === '-h') {
		showHelp = true;
		continue;
	}

	if (arg === '--') {
		vitestArgs.push(...args);
		break;
	}

	if (!arg.startsWith('-') && (arg === 'xxscreeps' || arg === 'vanilla')) {
		adapters.push(arg);
		continue;
	}

	vitestArgs.push(arg);
}

if (showHelp) {
	printHelp();
	process.exit(0);
}

const targets = adapters.length > 0 ? adapters : ['xxscreeps', 'vanilla'];
// A filtered run is a partial sample: it must not overwrite the full-run
// reports the doc generators read, and must not regenerate the docs.
const filtered = vitestArgs.length > 0;
console.log(`Running the ${filtered ? 'FILTERED' : 'FULL'} test suite (adapters: ${targets.join(', ')}) — this takes minutes, not seconds.`);
const reportsDir = path.join(packageRoot, 'reports');
mkdirSync(reportsDir, { recursive: true });

let overallStatus = 0;

for (const adapter of targets) {
	console.log(`\n== ${adapter} ==`);
	const reportName = filtered ? `${adapter}-partial` : adapter;
	const reportPath = path.join(reportsDir, `${reportName}.json`);
	const status = runSuite({
		adapter,
		reportName,
		env: { ...process.env, CI: '1' },
		vitestArgs,
	});
	overallStatus = overallStatus || status;
	printReportSummary(adapter, reportPath, status);
}

if (filtered) {
	console.log('\nFiltered run: JSON written to reports/<adapter>-partial.json; full-run reports and generated docs untouched.');
} else {
	console.log('\nRegenerating docs/status.md and coverage.html from the fresh reports (npm run status:refresh redoes this without re-running tests).');
	for (const script of ['generate-status.js', 'generate-coverage.js']) {
		const result = spawnSync(process.execPath, [path.join(packageRoot, 'scripts', script)], { stdio: 'inherit' });
		overallStatus = overallStatus || (result.status ?? 1);
	}
}

process.exit(overallStatus);

function printReportSummary(adapter, reportPath, status) {
	try {
		const report = JSON.parse(readFileSync(reportPath, 'utf8'));
		const passed = report.numPassedTests ?? 0;
		const failed = report.numFailedTests ?? 0;
		const skipped = report.numPendingTests ?? report.numTodoTests ?? 0;
		const total = report.numTotalTests ?? passed + failed + skipped;
		console.log(
			`${adapter}: ${passed}/${total} passed` +
			(failed ? `, ${failed} failed` : '') +
			(skipped ? `, ${skipped} skipped` : '') +
			(status ? ' (non-zero exit)' : ''),
		);
	} catch {
		if (status === 0) {
			console.log(`${adapter}: finished successfully, but no JSON report was found at ${reportPath}`);
		} else {
			console.log(`${adapter}: failed before a JSON report was produced`);
		}
	}
}

function printHelp() {
	console.log(`Usage: npm run parity [adapter...] [-- <vitest-args>]

Runs the suite against xxscreeps and vanilla by default, writing JSON reports to
the local reports/ directory and regenerating docs/status.md + coverage.html at
the end. You may limit the run to one adapter by naming it.

Filtered runs (any vitest args) write reports/<adapter>-partial.json instead and
leave the full-run reports and generated docs untouched.

To regenerate the docs from existing reports without running any tests, use
npm run status:refresh.

Examples:
  npm run parity
  npm run parity xxscreeps
  npm run parity -- tests/06-controller/controller.test.ts
`);
}
