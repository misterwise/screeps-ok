// Shared npm-CLI resolver for screeps-ok's dev/setup scripts.
//
// These scripts shell out to npm. When they run via `npm run`/lifecycle hooks,
// npm prepends every ancestor `node_modules/.bin` to PATH; if screeps-ok is
// nested inside another package's tree, a stray transitive npm shim there
// (e.g. passport-steam -> npm@5) can shadow the real npm and crash on modern
// Node (`cb.apply is not a function`). Resolve npm explicitly instead of
// trusting a bare `npm` on PATH. Every path is derived at runtime so this stays
// portable across machines and CI.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';

// Prefer the npm that launched this lifecycle (`npm_execpath`), then the npm
// bundled with the running Node. Returns null if neither resolves so callers
// can fall back to a bare `npm`.
export function resolveNpmCli() {
	const fromEnv = process.env.npm_execpath;
	if (fromEnv && existsSync(fromEnv)) return fromEnv;
	const nodeDir = dirname(process.execPath);
	const candidates = [
		join(nodeDir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'), // unix (nvm/standard)
		join(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js'), // windows
	];
	for (const candidate of candidates) {
		if (existsSync(candidate)) return candidate;
	}
	return null;
}

// Drop-in for `execFileSync('npm', args, opts)` that never lets PATH pick npm.
// Returns whatever execFileSync returns (e.g. captured stdout when opts ask for
// it), so callers that parse npm's output keep working unchanged.
export function runNpm(args, opts) {
	const cli = resolveNpmCli();
	if (cli) {
		// Run the resolved npm under the current Node so PATH never gets a vote.
		return execFileSync(process.execPath, [cli, ...args], opts);
	}
	// Last resort: resolve `npm` from PATH (may hit a shadowing shim).
	return execFileSync('npm', args, opts);
}
