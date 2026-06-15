import { execFileSync, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
	await setupXxscreeps();
}

if (target === 'all' || target === 'vanilla') {
	setupVanilla();
}

async function setupXxscreeps() {
	const root = resolvePackageRoot('xxscreeps');
	console.log(`[screeps-ok] Preparing xxscreeps in ${root}`);
	runTypeScriptBuild(root);
	const pathfinderRoot = resolvePackageDependencyRoot(root, '@xxscreeps/pathfinder');
	await setupPathfinder(pathfinderRoot);
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

function resolvePackageDependencyRoot(packageRoot, packageName) {
	const packageRequire = createRequire(path.join(packageRoot, 'package.json'));
	for (const candidate of [`${packageName}/package.json`, packageName]) {
		try {
			const resolved = packageRequire.resolve(candidate);
			const root = findPackageRoot(resolved);
			if (root) return root;
		} catch {
			// Try the next resolution strategy.
		}
	}

	console.error(`[screeps-ok] Required dependency '${packageName}' is not installed under ${packageRoot}.`);
	console.error('[screeps-ok] Run npm run setup:xxscreeps first.');
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

async function setupPathfinder(pathfinderRoot) {
	if (existsSync(path.join(pathfinderRoot, 'binding.gyp'))) {
		console.log(`[screeps-ok] Building path-finder native addon in ${pathfinderRoot}`);
		run('npx node-gyp rebuild --release', { cwd: pathfinderRoot });
		await verifyPathfinder(pathfinderRoot);
		return;
	}

	console.log(`[screeps-ok] Verifying prebuilt path-finder native addon in ${pathfinderRoot}`);
	await verifyPathfinder(pathfinderRoot);
}

async function verifyPathfinder(pathfinderRoot) {
	// napi pathfinder is exports-only ESM, so import the manifest's entry rather
	// than directory-require it; the import runs the native load + version check.
	const pkg = JSON.parse(readFileSync(path.join(pathfinderRoot, 'package.json'), 'utf8'));
	const entry = typeof pkg.exports?.['.'] === 'string' ? pkg.exports['.'] : pkg.main ?? 'index.js';
	try {
		const pf = await import(pathToFileURL(path.join(pathfinderRoot, entry)).href);
		if (pf.path === undefined) {
			throw new Error('pathfinder loaded but exposes no native `path`');
		}
	} catch (error) {
		console.error('[screeps-ok] Failed to load @xxscreeps/pathfinder native addon.');
		console.error(String(error instanceof Error ? error.message : error));
		process.exit(1);
	}
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
