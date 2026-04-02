import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const minNodeMajor = 24;
const adapter = process.argv[2] ?? 'all';
const validAdapters = new Set(['all', 'xxscreeps', 'vanilla']);

if (!validAdapters.has(adapter)) {
	console.error(`[screeps-ok] Unknown adapter '${adapter}'. Expected one of: ${[...validAdapters].join(', ')}`);
	process.exit(1);
}

const nodeMajor = Number.parseInt(process.versions.node.split('.')[0] ?? '', 10);
if (!Number.isFinite(nodeMajor) || nodeMajor < minNodeMajor) {
	fail(
		`Node ${process.version} is unsupported.`,
		[
			`screeps-ok requires Node >=${minNodeMajor}.`,
			'Switch to Node 24.x or newer, then reinstall dependencies so native addons rebuild for the active runtime.',
			'Example: nvm use 24 && rm -rf node_modules package-lock.json && npm install',
		],
	);
}

if (adapter === 'all' || adapter === 'xxscreeps') {
	checkXxscreeps();
}

if (adapter === 'all' || adapter === 'vanilla') {
	await checkVanilla();
}

function checkXxscreeps() {
	const root = resolvePackageRoot('xxscreeps');
	checkFile(
		path.join(root, 'dist/test/simulate.js'),
		'xxscreeps JavaScript build output is missing.',
		'Run npm run setup:xxscreeps',
	);
	checkFile(
		path.join(root, 'dist/config/mods.static/constants.js'),
		'xxscreeps generated mods constants bundle is missing.',
		'Run npm run setup:xxscreeps',
	);
	checkFile(
		path.join(root, 'dist/config/mods.static/game.js'),
		'xxscreeps generated mods game bundle is missing.',
		'Run npm run setup:xxscreeps',
	);
	checkFile(
		path.join(root, 'dist/config/mods.static/config.js'),
		'xxscreeps generated mods config bundle is missing.',
		'Run npm run setup:xxscreeps',
	);

	const nativeId = `${process.arch}-${process.platform}-${process.version}`;
	const pfNode = path.join(root, 'src/driver/path-finder/out', nativeId, 'pf.node');
	checkFile(
		pfNode,
		`xxscreeps path-finder native module is missing for ${nativeId}.`,
		'Run npm run setup:xxscreeps',
	);

	try {
		require(pfNode);
	} catch (error) {
		fail(
			'xxscreeps path-finder native module failed to load.',
			[
				String(error instanceof Error ? error.message : error),
				'Run npm run setup:xxscreeps after switching to the intended Node version.',
			],
		);
	}
}

async function checkVanilla() {
	const isolatedVmRoot = resolvePackageRoot('isolated-vm');
	checkFile(
		path.join(isolatedVmRoot, 'build/Release/isolated_vm.node'),
		'isolated-vm native module has not been built.',
		'Run npm run setup:vanilla',
	);

	const driverRoot = resolvePackageRoot('@screeps/driver');
	checkFile(
		path.join(driverRoot, 'lib/index.js'),
		'@screeps/driver webpack bundle is missing.',
		'Run npm run setup:vanilla',
	);
	checkFile(
		path.join(driverRoot, 'native/build/Release/native.node'),
		'@screeps/driver native module has not been built.',
		'Run npm run setup:vanilla',
	);

	try {
		await import(pathToFileURL(path.join(isolatedVmRoot, 'isolated-vm.js')).href);
	} catch (error) {
		fail(
			'isolated-vm failed to load for the current Node runtime.',
			[
				String(error instanceof Error ? error.message : error),
				'Run npm run setup:vanilla after switching to the intended Node version.',
			],
		);
	}
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

	fail(
		`Required package '${packageName}' is not installed.`,
		['Run npm install from the repository root.'],
	);
}

function checkFile(filePath, message, fix) {
	if (!existsSync(filePath)) {
		fail(message, [`Expected file: ${filePath}`, fix]);
	}
}

function fail(message, details) {
	console.error(`[screeps-ok] Preflight failed: ${message}`);
	for (const detail of details) {
		console.error(`[screeps-ok] ${detail}`);
	}
	process.exit(1);
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
