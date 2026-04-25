// Post-install helper: assemble the pinned xxscreeps package from upstream.
//
// Upstream (laverdet/xxscreeps) is a pnpm monorepo whose workspace root
// package.json cannot be consumed by npm. Rather than fight npm's git-dep
// resolver, we fetch just the subtrees we need (`packages/xxscreeps` and
// `packages/pathfinder`) via a sparse git checkout and lay them out under
// `node_modules/` at the same paths our adapter imports expect.
//
// The pin sha lives in `.xxscreeps-pin` at the repo root so bumps are a
// one-line change. Native addon compilation is still deferred to
// `npm run setup:xxscreeps`.
//
// Local override: setting XXSCREEPS_LOCAL=/path/to/xxscreeps-checkout skips
// the fetch and lays out from that directory instead. The path must have the
// upstream monorepo layout (tsconfig.base.json, packages/xxscreeps,
// packages/pathfinder). The pin sha is ignored in this mode, and every run
// rebuilds (no stamp check) since the source tree is assumed to be edited.
// Intended for the screeps-ok-pr workspace — see .agent/workflows/xxscreeps-pr.md.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import {
	cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';

const require = createRequire(import.meta.url);
const minNodeMajor = 24;
const tscBin = require.resolve('typescript/bin/tsc');

const repoRoot = resolve('.');
const pinFile = join(repoRoot, '.xxscreeps-pin');
const xxscreepsDir = join(repoRoot, 'node_modules/xxscreeps');
const pathfinderDir = join(repoRoot, 'node_modules/@xxscreeps/pathfinder');
const cacheDir = join(repoRoot, 'node_modules/.cache/screeps-ok/xxscreeps-src');
const stampFile = join(xxscreepsDir, '.screeps-ok-pin');
const repoUrl = 'https://github.com/laverdet/xxscreeps.git';

// Bump when the build pipeline gains a step that prior stamps wouldn't
// have produced (e.g. v2 added applyUpstreamPatches for lodash-es; v3
// added buildNestedNativeAddons for isolated-vm + ivm-inspect; v4 added
// @xxscreeps/lodash3 wiring after upstream extracted lodash from the
// xxscreeps package into a sibling workspace).
const stampSchema = 'v4';

function stampContent(token) {
	return `${token}\nschema=${stampSchema}`;
}

if (process.env.SCREEPS_OK_SKIP_XXSCREEPS_POSTINSTALL === '1') {
	console.log('[screeps-ok] SCREEPS_OK_SKIP_XXSCREEPS_POSTINSTALL=1, skipping xxscreeps postinstall');
	process.exit(0);
}

const nodeMajor = Number.parseInt(process.versions.node.split('.')[0] ?? '', 10);
if (!Number.isFinite(nodeMajor) || nodeMajor < minNodeMajor) {
	console.log(
		`[screeps-ok] Skipping xxscreeps postinstall on ${process.version}. ` +
		`Use Node ${minNodeMajor}+ and run npm install again for a supported environment.`,
	);
	process.exit(0);
}

const localOverride = process.env.XXSCREEPS_LOCAL
	? resolve(process.env.XXSCREEPS_LOCAL)
	: null;

let pin = null;
let shortPin = null;
if (localOverride) {
	validateLocalCheckout(localOverride);
} else {
	if (!existsSync(pinFile)) {
		console.error(`[screeps-ok] Missing ${pinFile}`);
		process.exit(1);
	}
	pin = readFileSync(pinFile, 'utf8').trim();
	if (!/^[0-9a-f]{40}$/.test(pin)) {
		console.error(`[screeps-ok] .xxscreeps-pin must contain a full 40-char sha; got '${pin}'`);
		process.exit(1);
	}
	shortPin = pin.slice(0, 8);

	if (
		existsSync(stampFile) && readFileSync(stampFile, 'utf8').trim() === stampContent(pin) &&
		existsSync(join(xxscreepsDir, 'dist/test/simulate.js'))
	) {
		console.log(`[screeps-ok] xxscreeps already built at pin ${shortPin}`);
		process.exit(0);
	}
}

let srcDir;
if (localOverride) {
	console.log(`[screeps-ok] Using local xxscreeps checkout at ${localOverride}`);
	srcDir = localOverride;
} else {
	console.log(`[screeps-ok] Fetching xxscreeps ${shortPin} from upstream`);
	fetchSubtrees(pin);
	srcDir = cacheDir;
}
layOutPackages(srcDir);
inlineTsconfigBase(srcDir);
rewriteWorkspaceRefs();
installNestedDeps();
applyUpstreamPatches(srcDir);
buildNestedNativeAddons();
buildTypeScript();
runGeneratedModsBootstrap();
writeFileSync(stampFile, stampContent(localOverride ? `local:${localOverride}` : pin) + '\n');
console.log(localOverride
	? `[screeps-ok] xxscreeps ready from local ${localOverride}`
	: `[screeps-ok] xxscreeps ready at pin ${shortPin}`);
console.log('[screeps-ok] Run npm run setup:xxscreeps to build the path-finder native addon');

function fetchSubtrees(sha) {
	rmSync(cacheDir, { recursive: true, force: true });
	mkdirSync(cacheDir, { recursive: true });
	const git = (args, opts = {}) => execFileSync('git', args, {
		cwd: cacheDir,
		stdio: ['ignore', 'inherit', 'inherit'],
		...opts,
	});
	git(['init', '--quiet']);
	git(['remote', 'add', 'origin', repoUrl]);
	git(['config', 'extensions.partialClone', 'origin']);
	git(['fetch', '--depth=1', '--filter=blob:none', 'origin', sha]);
	// Root-level files like tsconfig.base.json aren't captured by a cone-mode
	// sparse-checkout scoped to packages/*, so stay in non-cone mode and list
	// the exact paths we need.
	git(['sparse-checkout', 'set', '--no-cone',
		'/tsconfig.base.json',
		'/packages/xxscreeps/',
		'/packages/pathfinder/',
		'/packages/lodash3/package.json',
		'/patches/',
	]);
	git(['checkout', '--quiet', 'FETCH_HEAD']);
}

function validateLocalCheckout(dir) {
	const required = [
		join(dir, 'tsconfig.base.json'),
		join(dir, 'packages/xxscreeps'),
		join(dir, 'packages/pathfinder'),
	];
	for (const p of required) {
		if (!existsSync(p)) {
			console.error(`[screeps-ok] XXSCREEPS_LOCAL=${dir} is missing ${p}`);
			console.error('[screeps-ok] Expected the upstream xxscreeps monorepo layout.');
			process.exit(1);
		}
	}
}

function layOutPackages(srcDir) {
	rmSync(xxscreepsDir, { recursive: true, force: true });
	mkdirSync(dirname(xxscreepsDir), { recursive: true });
	cpSync(join(srcDir, 'packages/xxscreeps'), xxscreepsDir, { recursive: true });

	rmSync(pathfinderDir, { recursive: true, force: true });
	mkdirSync(dirname(pathfinderDir), { recursive: true });
	cpSync(join(srcDir, 'packages/pathfinder'), pathfinderDir, { recursive: true });
}

function inlineTsconfigBase(srcDir) {
	// `packages/xxscreeps/tsconfig.json` extends `../../tsconfig.base.json`
	// (the monorepo root). Our flat layout has no such ancestor, so copy the
	// base next to the xxscreeps tsconfig and rewrite the extends ref.
	// Use a string replace instead of JSON.parse because the tsconfig has
	// JSONC features (trailing commas).
	cpSync(join(srcDir, 'tsconfig.base.json'), join(xxscreepsDir, 'tsconfig.base.json'));
	const configPath = join(xxscreepsDir, 'tsconfig.json');
	const original = readFileSync(configPath, 'utf8');
	let patched = original.replace(
		/"extends":\s*"[^"]*tsconfig\.base\.json"/,
		'"extends": "./tsconfig.base.json"',
	);
	if (patched === original) {
		throw new Error('Failed to rewrite extends in xxscreeps tsconfig.json');
	}
	// Drop the sibling-workspace lodash3 path/reference. The published
	// `@xxscreeps/lodash3` package resolves through node_modules at runtime,
	// and TS finds its types via package resolution — no path override needed.
	patched = patched
		.replace(/^\s*"@xxscreeps\/lodash3":\s*\[[^\]]*\],?\s*$\n?/m, '')
		.replace(/^\s*\{\s*"path":\s*"\.\.\/lodash3"\s*\},?\s*$\n?/m, '');
	writeFileSync(configPath, patched);
}

function rewriteWorkspaceRefs() {
	const pkgPath = join(xxscreepsDir, 'package.json');
	const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
	for (const field of ['dependencies', 'devDependencies']) {
		const deps = pkg[field];
		if (!deps) continue;
		for (const [name, spec] of Object.entries(deps)) {
			if (typeof spec !== 'string' || !spec.startsWith('workspace:')) continue;
			if (name === '@xxscreeps/pathfinder') {
				deps[name] = `file:${pathfinderDir}`;
			} else if (name === '@xxscreeps/lodash3') {
				// lodash3 is published on npm as a self-contained tarball
				// (its prepublishOnly bakes lodash-es source into dist/),
				// so we install from the registry rather than fetching the
				// workspace source. Pin to the exact version from upstream
				// so a sibling-package version bump propagates with the pin.
				deps[name] = readLodash3Version();
			} else {
				// No other workspace sibling is actually imported by the
				// xxscreeps subtree we use — strip to keep npm happy.
				delete deps[name];
			}
		}
	}
	writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

function readLodash3Version() {
	const candidates = localOverride
		? [join(localOverride, 'packages/lodash3/package.json')]
		: [join(cacheDir, 'packages/lodash3/package.json')];
	for (const path of candidates) {
		if (!existsSync(path)) continue;
		const version = JSON.parse(readFileSync(path, 'utf8')).version;
		if (typeof version === 'string' && version.length > 0) return version;
	}
	throw new Error('Could not read @xxscreeps/lodash3 version from upstream packages/lodash3/package.json');
}

function installNestedDeps() {
	execFileSync('npm', [
		'install',
		'--prefix', xxscreepsDir,
		'--no-package-lock',
		'--omit=dev',
		'--ignore-scripts',
		'--no-audit',
		'--no-fund',
	], { stdio: 'inherit' });
}

function buildNestedNativeAddons() {
	// installNestedDeps() runs with --ignore-scripts to avoid pulling in
	// arbitrary install hooks from transitives. The runtime, however, needs
	// the native addons built — `isolated-vm` (sandbox) and `ivm-inspect`
	// (debugger glue) both ship a `binding.gyp` and rely on their `install`
	// script to compile or fetch a prebuild. Run them explicitly.
	const natives = ['isolated-vm', 'ivm-inspect'];
	for (const name of natives) {
		if (!existsSync(join(xxscreepsDir, 'node_modules', name, 'binding.gyp'))) continue;
		execFileSync('npm', ['rebuild', '--prefix', xxscreepsDir, name], { stdio: 'inherit' });
	}
}

function applyUpstreamPatches(srcDir) {
	// Upstream uses pnpm's `patchedDependencies` to patch lodash-es 3.10.1
	// (adds `.js` extensions to legacy extension-less imports + an `exports`
	// map so `import lodash_es from 'lodash-es'` resolves under ESM). pnpm
	// applies it automatically; npm does not, so we apply it here.
	// Guarded by existsSync — pins predating eb14786 have no patches/ dir.
	const patchPath = join(srcDir, 'patches/lodash-es.patch');
	if (!existsSync(patchPath)) return;
	const target = join(xxscreepsDir, 'node_modules/lodash-es');
	if (!existsSync(target)) return;
	execFileSync('git', ['apply', '--unsafe-paths', '--directory', target, patchPath], {
		stdio: 'inherit',
	});
	console.log('[screeps-ok] Applied upstream lodash-es.patch');
}

function buildTypeScript() {
	let tscError = null;
	try {
		execFileSync(process.execPath, [tscBin, '--noEmitOnError', 'false'], {
			cwd: xxscreepsDir,
			stdio: 'inherit',
		});
	} catch (err) {
		// tsc exits non-zero on type errors but still emits JS. Harmless
		// type drift shouldn't block the build as long as the expected
		// output exists — verified below.
		tscError = err;
	}
	if (!existsSync(join(xxscreepsDir, 'dist/test/simulate.js'))) {
		console.error('[screeps-ok] xxscreeps build failed:', tscError ? tscError.message : 'dist/test/simulate.js was not emitted');
		process.exit(1);
	}
	if (tscError) {
		console.log('[screeps-ok] xxscreeps JavaScript build completed with warnings');
	} else {
		console.log('[screeps-ok] xxscreeps JavaScript build complete');
	}
}

function runGeneratedModsBootstrap() {
	execFileSync(process.execPath, ['dist/config/mods/index.js'], {
		cwd: xxscreepsDir,
		stdio: 'inherit',
	});
}
