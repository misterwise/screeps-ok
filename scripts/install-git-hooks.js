// Point this clone's git hooks at .githooks/. No-op when .git is missing
// (downstream installs via npm don't ship .git, so nothing to wire up).
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (!existsSync(path.join(packageRoot, '.git'))) process.exit(0);

try {
	execFileSync('git', ['config', 'core.hooksPath', '.githooks'], {
		cwd: packageRoot,
		stdio: 'ignore',
	});
	console.log('[screeps-ok] git hooks wired to .githooks/');
} catch (err) {
	console.warn(`[screeps-ok] could not set core.hooksPath: ${err.message}`);
}
