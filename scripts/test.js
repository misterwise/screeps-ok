import { spawnSync } from 'node:child_process';
import process from 'node:process';

const args = process.argv.slice(2);
let adapter = 'xxscreeps';

// Use first arg as adapter if it matches
if (args[0] === 'xxscreeps' || args[0] === 'vanilla') {
  adapter = args.shift();
}

// Check if we should run in watch mode
const isWatch = args.includes('--watch') || args.includes('-w');
const vitestCmd = isWatch ? [] : ['run'];

console.log(`Testing ${adapter} ${isWatch ? '(watch mode)' : ''}`);

const preflight = spawnSync('node', ['scripts/preflight.js', adapter], {
  stdio: 'inherit',
  env: process.env,
  shell: true
});

if ((preflight.status ?? 1) !== 0) {
  process.exit(preflight.status ?? 1);
}

const env = { ...process.env, SCREEPS_OK_ADAPTER: `./adapters/${adapter}/index.ts` };
const result = spawnSync('npx', ['vitest', ...vitestCmd, ...args], {
  stdio: 'inherit',
  env,
  shell: true
});
process.exit(result.status ?? 1);
