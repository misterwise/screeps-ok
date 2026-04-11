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
const reportsDir = path.join(packageRoot, 'reports');
mkdirSync(reportsDir, { recursive: true });

let overallStatus = 0;

for (const adapter of targets) {
	console.log(`\n== ${adapter} ==`);
	const reportPath = path.join(reportsDir, `${adapter}.json`);
	const status = runSuite({
		adapter,
		env: { ...process.env, CI: '1' },
		vitestArgs,
	});
	overallStatus = overallStatus || status;
	printReportSummary(adapter, reportPath, status);
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
the local reports/ directory. You may limit the run to one adapter by naming it.

Examples:
  npm run parity
  npm run parity xxscreeps
  npm run parity -- tests/06-controller/controller.test.ts
`);
}
