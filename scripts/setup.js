import { execFileSync, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const minNodeMajor = 24;
const tscBin = require.resolve('typescript/bin/tsc');
const target = process.argv[2] ?? 'all';
const validTargets = new Set(['all', 'xxscreeps', 'vanilla']);

if (!validTargets.has(target)) {
	console.error(`[screeps-ok] Unknown setup target '${target}'. Expected one of: ${[...validTargets].join(', ')}`);
	process.exit(1);
}

const nodeMajor = Number.parseInt(process.versions.node.split('.')[0] ?? '', 10);
if (!Number.isFinite(nodeMajor) || nodeMajor < minNodeMajor) {
	console.error(`[screeps-ok] Setup requires Node >=${minNodeMajor}. Current runtime is ${process.version}.`);
	console.error('[screeps-ok] Switch to Node 24.x or newer and reinstall dependencies before building native addons.');
	process.exit(1);
}

if (target === 'all' || target === 'xxscreeps') {
	setupXxscreeps();
}

if (target === 'all' || target === 'vanilla') {
	setupVanilla();
}

function setupXxscreeps() {
	const root = resolvePackageRoot('xxscreeps');
	console.log(`[screeps-ok] Preparing xxscreeps in ${root}`);
	runTypeScriptBuild(root);
	runGeneratedModsBootstrap(root);
	const pathfinderRoot = resolvePackageRoot('@xxscreeps/pathfinder');
	console.log(`[screeps-ok] Building path-finder native addon in ${pathfinderRoot}`);
	run('npx node-gyp rebuild --release', { cwd: pathfinderRoot });
}

function setupVanilla() {
	const driverRoot = resolvePackageRoot('@screeps/driver');
	console.log(`[screeps-ok] Preparing vanilla dependencies in ${driverRoot}`);
	run('NODE_PATH=../../.. npx webpack', { cwd: driverRoot });
	run('npx node-gyp rebuild --release -C node_modules/isolated-vm', {
		cwd: process.cwd(),
	});
	run('npx node-gyp rebuild --release -C node_modules/@screeps/driver/native', {
		cwd: process.cwd(),
	});
}

function resolvePackageRoot(packageName) {
	const directNodeModulesPath = path.join(repoRoot, 'node_modules', ...packageName.split('/'));
	if (existsSync(path.join(directNodeModulesPath, 'package.json'))) {
		return directNodeModulesPath;
	}

	const resolutionCandidates = [
		`${packageName}/package.json`,
		packageName,
	];

	for (const candidate of resolutionCandidates) {
		try {
			const resolved = require.resolve(candidate);
			const root = findPackageRoot(resolved);
			if (root) return root;
		} catch {
			// Try the next resolution strategy.
		}
	}

	console.error(`[screeps-ok] Required package '${packageName}' is not installed. Run npm install first.`);
	process.exit(1);
}

function run(command, options) {
	console.log(`[screeps-ok] ${command}`);
	execSync(command, {
		stdio: 'inherit',
		shell: true,
		...options,
	});
}

function runTypeScriptBuild(cwd) {
	console.log(`[screeps-ok] ${process.execPath} ${tscBin} --noEmitOnError false`);
	try {
		execFileSync(process.execPath, [tscBin, '--noEmitOnError', 'false'], {
			cwd,
			stdio: 'inherit',
		});
	} catch {
		// tsc exits non-zero on type errors but still emits JS. The caller
		// verifies the expected output below before proceeding.
	}
	if (!existsSync(path.join(cwd, 'dist/test/simulate.js'))) {
		console.error(`[screeps-ok] xxscreeps tsc build did not emit dist/test/simulate.js in ${cwd}`);
		process.exit(1);
	}
}

function runGeneratedModsBootstrap(cwd) {
	console.log(`[screeps-ok] ${process.execPath} dist/config/mods/index.js`);
	execFileSync(process.execPath, ['dist/config/mods/index.js'], {
		cwd,
		stdio: 'inherit',
	});
}

function findPackageRoot(resolvedPath) {
	let current = path.dirname(resolvedPath);
	while (true) {
		if (existsSync(path.join(current, 'package.json'))) {
			return current;
		}
		const parent = path.dirname(current);
		if (parent === current) return null;
		current = parent;
	}
}
