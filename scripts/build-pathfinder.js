// On-demand vendor build of @xxscreeps/pathfinder from the pinned source.
//
// The xxscreeps engine consumes @xxscreeps/pathfinder as a published npm
// package (JS wrapper + prebuilt napi binary). Upstream only publishes on a
// version bump, so pathfinder source changes at the pin can sit unreleased
// for a while. This script builds the complete package (compiled wrapper +
// native binary) from the pinned source into vendor/pathfinder/, where
// build-xxscreeps.js will prefer it over the registry prebuild until a newer
// registry version is published. See vendor/pathfinder/README.md.
//
// Run it only when a pin bump changes packages/pathfinder beyond the latest
// published prebuild — build-xxscreeps.js prints a staleness warning when
// that happens. Build once per platform we run on:
//   npm run pf:build             (host platform; macOS needs brew llvm,
//                                 cmake >= 4, ninja, boost)
//   npm run pf:build:linux-x64   (via docker, debian:sid + clang-22)
//
// The toolchain recipe mirrors upstream's .github/workflows/pathfinder.yml,
// minus the PGO passes (irrelevant for a test harness).
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import {
	chmodSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync,
	statSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { hashTree, pathfinderTriplet } from './pathfinder-vendor.js';
import { runNpm } from './npm-cli.js';

const require = createRequire(import.meta.url);
// Match upstream's pathfinder.yml so the binary targets the same node ABI.
const nodeHeadersVersion = '24.15.0';

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), '..');
const pinFile = join(repoRoot, '.xxscreeps-pin');
const vendorDir = join(repoRoot, 'vendor/pathfinder');
const manifestFile = join(vendorDir, 'manifest.json');
const srcCacheDir = join(repoRoot, 'node_modules/.cache/screeps-ok/pf-src');
const repoUrl = 'https://github.com/laverdet/xxscreeps.git';

const triplet = pathfinderTriplet();
const stageDir = join(repoRoot, `node_modules/.cache/screeps-ok/pf-build/${triplet}`);
const packageDir = join(stageDir, 'packages/pathfinder');

const pin = readFileSync(pinFile, 'utf8').trim();
if (!/^[0-9a-f]{40}$/.test(pin)) {
	console.error(`[screeps-ok] .xxscreeps-pin must contain a full 40-char sha; got '${pin}'`);
	process.exit(1);
}

console.log(`[screeps-ok] Building @xxscreeps/pathfinder for ${triplet} from pin ${pin.slice(0, 8)}`);
fetchPathfinderSource(pin);
stageBuildTree();
installBuildDeps();
buildWrapper();
const builtBinary = buildNative();
const { version, abi } = probe(builtBinary);
installIntoVendor(builtBinary, version, abi);
console.log(`[screeps-ok] Vendor pathfinder ${version} (abi ${abi}) ready for ${triplet}`);

function fetchPathfinderSource(sha) {
	const headFile = join(srcCacheDir, '.git/HEAD');
	if (existsSync(headFile)) {
		try {
			const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: srcCacheDir, encoding: 'utf8' }).trim();
			if (head === sha && existsSync(join(srcCacheDir, 'packages/pathfinder/CMakeLists.txt'))) {
				console.log('[screeps-ok] Reusing cached pathfinder source');
				return;
			}
		} catch {}
	}
	console.log('[screeps-ok] Fetching pathfinder source from upstream');
	rmSync(srcCacheDir, { recursive: true, force: true });
	mkdirSync(srcCacheDir, { recursive: true });
	const git = args => execFileSync('git', args, { cwd: srcCacheDir, stdio: ['ignore', 'inherit', 'inherit'] });
	git(['init', '--quiet']);
	git(['remote', 'add', 'origin', repoUrl]);
	git(['config', 'extensions.partialClone', 'origin']);
	git(['fetch', '--depth=1', '--filter=blob:none', 'origin', sha]);
	git(['sparse-checkout', 'set', '--no-cone', '/tsconfig.base.json', '/packages/pathfinder/']);
	git(['checkout', '--quiet', 'FETCH_HEAD']);
}

function stageBuildTree() {
	// Per-triplet staging dir: node_modules and build output are platform
	// specific (the docker linux build shares the host cache mount).
	rmSync(packageDir, { recursive: true, force: true });
	mkdirSync(dirname(packageDir), { recursive: true });
	cpSync(join(srcCacheDir, 'tsconfig.base.json'), join(stageDir, 'tsconfig.base.json'));
	cpSync(join(srcCacheDir, 'packages/pathfinder'), packageDir, { recursive: true });
}

function installBuildDeps() {
	runNpm([
		'install', '--ignore-scripts', '--no-audit', '--no-fund',
	], { cwd: packageDir, stdio: 'inherit' });
	// npm strips the exec bit that pnpm preserves on @auto_js's cmake helpers.
	const cmakeDir = join(packageDir, 'node_modules/@auto_js/js/cmake');
	for (const entry of readdirSync(cmakeDir)) {
		chmodSync(join(cmakeDir, entry), 0o755);
	}
}

function buildWrapper() {
	// Before cmake so build/ output can't leak into dist/. The pathfinder
	// package has no typescript devDep; use the repo's.
	const tscBin = require.resolve('typescript/bin/tsc');
	execFileSync(process.execPath, [tscBin], { cwd: packageDir, stdio: 'inherit' });
	if (!existsSync(join(packageDir, 'dist/pathfinder.mjs'))) {
		throw new Error('tsc did not emit dist/pathfinder.mjs');
	}
}

function buildNative() {
	const env = { ...process.env };
	const cmakeArgs = [
		'-DCMAKE_BUILD_TYPE=Release',
		// @auto_js 0.0.5's export_tag.h gates EXPORT on EXPORT_IS_EXPORT but no
		// cmake defines it, so InitForContext (the isolated-vm context init the
		// xxscreeps sandbox requires) compiles with hidden visibility and gets
		// stripped from the dylib. Define it ourselves.
		'-DCMAKE_CXX_FLAGS=-DEXPORT_IS_EXPORT=1',
		`-DCMAKE_MODULE_PATH=${join(packageDir, 'node_modules/@auto_js/js/cmake/')}`,
		`-DNODE_VERSION=${nodeHeadersVersion}`,
		'-G', 'Ninja', '-B', 'build',
	];
	if (process.platform === 'darwin') {
		const llvm = execFileSync('brew', ['--prefix', 'llvm'], { encoding: 'utf8' }).trim();
		env.CXX ??= join(llvm, 'bin/clang++');
		cmakeArgs.push(`-DCMAKE_CXX_STDLIB_MODULES_JSON=${join(llvm, 'lib/c++/libc++.modules.json')}`);
		ensureBrewClangConfig();
	} else {
		env.CXX ??= 'clang++-22';
	}
	execFileSync('cmake', cmakeArgs, { cwd: packageDir, stdio: 'inherit', env });
	execFileSync('ninja', ['-C', 'build'], { cwd: packageDir, stdio: 'inherit', env });
	const binary = join(packageDir, `module/node_modules/@xxscreeps/pathfinder-${triplet}/pf.${triplet}.node`);
	if (!existsSync(binary)) {
		throw new Error(`Build did not emit ${binary}`);
	}
	return binary;
}

function ensureBrewClangConfig() {
	// Brew's clang needs its config dir linked into ~/.config to find the SDK
	// (https://github.com/Homebrew/homebrew-core/issues/221782).
	const link = join(homedir(), '.config/clang');
	if (existsSync(link)) return;
	const brewPrefix = execFileSync('brew', ['--prefix'], { encoding: 'utf8' }).trim();
	mkdirSync(dirname(link), { recursive: true });
	symlinkSync(join(brewPrefix, 'etc/clang'), link);
	console.log(`[screeps-ok] Symlinked ${link} -> ${brewPrefix}/etc/clang`);
}

function probe(binary) {
	const version = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8')).version;
	const abi = require(binary).version;
	if (typeof abi !== 'number') {
		throw new Error('Built binary does not export a numeric version');
	}
	// The wrapper's loader hardcodes the abi it expects; a mismatch here means
	// the wrapper and binary came from different sources.
	const loader = readFileSync(join(packageDir, 'module/index.cjs'), 'utf8');
	const expected = loader.match(/version !== (\d+)/);
	if (expected && Number(expected[1]) !== abi) {
		throw new Error(`Binary abi ${abi} does not match wrapper expectation ${expected[1]}`);
	}
	// The isolated-vm sandbox loads the binary via ivm.NativeModule, which
	// needs the InitForContext export; require() alone doesn't exercise it.
	if (!readFileSync(binary).includes('InitForContext')) {
		throw new Error('Built binary does not export InitForContext (isolated-vm incompatible)');
	}
	return { version, abi };
}

function installIntoVendor(binary, version, abi) {
	const packageOut = join(vendorDir, 'package');
	const manifest = existsSync(manifestFile)
		? JSON.parse(readFileSync(manifestFile, 'utf8'))
		: { builds: {} };
	const sourceTreeHash = hashTree(join(srcCacheDir, 'packages/pathfinder'));

	// The wrapper package is shared by all triplets; rebuilding from different
	// source than the other triplets' binaries would ship a mismatched set.
	const staleTriplets = Object.entries(manifest.builds ?? {})
		.filter(([name, build]) => name !== triplet && build.sourceSha !== pin)
		.map(([name]) => name);
	if (staleTriplets.length > 0) {
		console.warn(`[screeps-ok] WARNING: vendor binaries for ${staleTriplets.join(', ')} were built from a different pin; rebuild them too.`);
	}

	rmSync(packageOut, { recursive: true, force: true });
	mkdirSync(packageOut, { recursive: true });
	const pkg = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
	delete pkg.devDependencies;
	delete pkg.scripts;
	delete pkg.napi;
	writeFileSync(join(packageOut, 'package.json'), JSON.stringify(pkg, null, '\t') + '\n');
	// Copy file-by-file: the staged module/ and dist/ dirs also hold build
	// output (module/node_modules native artifacts, stray tsc state). Plain
	// read/write instead of cpSync — cpSync's chmod fails on the docker
	// bind mount when overwriting host-owned files.
	const copyFile = (from, to) => writeFileSync(to, readFileSync(from));
	mkdirSync(join(packageOut, 'module'));
	for (const file of readdirSync(join(packageDir, 'module'))) {
		if (statSync(join(packageDir, 'module', file)).isDirectory()) continue;
		copyFile(join(packageDir, 'module', file), join(packageOut, 'module', file));
	}
	mkdirSync(join(packageOut, 'dist'));
	for (const file of readdirSync(join(packageDir, 'dist'))) {
		if (!/^pathfinder\./.test(file)) continue;
		copyFile(join(packageDir, 'dist', file), join(packageOut, 'dist', file));
	}

	const platformOut = join(vendorDir, `platform/${triplet}/pf.${triplet}.node`);
	mkdirSync(dirname(platformOut), { recursive: true });
	copyFile(binary, platformOut);

	writeFileSync(manifestFile, JSON.stringify({
		sourceSha: pin,
		sourceTreeHash,
		version,
		abi,
		builds: {
			...manifest.builds,
			[triplet]: { sourceSha: pin, version, abi },
		},
	}, null, '\t') + '\n');
}

