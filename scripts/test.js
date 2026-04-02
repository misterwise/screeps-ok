import process from 'node:process';
import { runSuite } from './run-suite.js';

const args = process.argv.slice(2);
let adapter = 'xxscreeps';

// Use first arg as adapter if it matches
if (args[0] === 'xxscreeps' || args[0] === 'vanilla') {
  adapter = args.shift();
}

process.exit(runSuite({
	adapter,
	vitestArgs: args,
}));
