#!/usr/bin/env node

import process from 'node:process';
import { parseRunnerArgs, runSuite, builtInAdapters } from '../scripts/run-suite.js';

try {
	const parsed = parseRunnerArgs(process.argv.slice(2));
	if (parsed.showHelp) {
		printHelp();
		process.exit(0);
	}

	process.exit(runSuite({
		adapter: parsed.adapter,
		preflight: parsed.preflight,
		preflightOnly: parsed.preflightOnly,
		vitestArgs: parsed.vitestArgs,
	}));
} catch (error) {
	console.error(`[screeps-ok] ${error instanceof Error ? error.message : String(error)}`);
	printHelp();
	process.exit(1);
}

function printHelp() {
	const builtIns = Object.keys(builtInAdapters).join(', ');
	console.log(`Usage: screeps-ok [options] [adapter] [-- <vitest-args>]

Runs the canonical screeps-ok test suite against a built-in adapter or an
adapter module supplied by another repository.

Options:
  --adapter <name-or-path>   Built-in adapter (${builtIns}) or adapter module path
  --preflight <target>       Preflight target: xxscreeps, vanilla, or none
  --preflight-only           Run environment checks without invoking Vitest
  -h, --help                 Show this help

Examples:
  screeps-ok xxscreeps
  screeps-ok --adapter vanilla -- tests/06-controller/controller.test.ts
  screeps-ok --adapter ./adapters/screeps-ok/index.ts --preflight none
`);
}
