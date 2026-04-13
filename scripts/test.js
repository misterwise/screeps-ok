import process from 'node:process';
import { parseRunnerArgs, runSuite } from './run-suite.js';

const parsed = parseRunnerArgs(process.argv.slice(2));

if (parsed.showHelp) {
  console.log(`Usage: npm test [-- [adapter] [options] [vitest-args]]

Options:
  xxscreeps | vanilla    Adapter to test (default: xxscreeps)
  --adapter=<name|path>  Adapter by flag instead of positional
  --preflight=<target>   Preflight target (default: adapter name, "none" to skip)
  --preflight-only       Run preflight only, skip tests
  -h, --help             Show this help

Everything else is passed to vitest. Examples:
  npm test                                          # run all tests on xxscreeps
  npm test -- vanilla                               # run all tests on vanilla
  npm test -- -t "non-creep" tests/01-movement/1.5-pulling.test.ts
  npm test -- --adapter=xxscreeps --reporter=verbose tests/foo.test.ts`);
  process.exit(0);
}

process.exit(runSuite({
  adapter: parsed.adapter,
  preflight: parsed.preflight,
  preflightOnly: parsed.preflightOnly,
  vitestArgs: parsed.vitestArgs,
}));
