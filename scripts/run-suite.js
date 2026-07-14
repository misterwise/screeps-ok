import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const require = createRequire(import.meta.url);
const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
export const packageRoot = path.resolve(scriptsDir, '..');
export const builtInAdapters = {
	xxscreeps: path.join(packageRoot, 'adapters/xxscreeps/index.ts'),
	vanilla: path.join(packageRoot, 'adapters/vanilla/index.ts'),
};

export function parseRunnerArgs(argv, options = {}) {
	const {
		defaultAdapter = 'xxscreeps',
		allowPositionalBuiltIn = true,
	} = options;

	const args = [...argv];
	let adapter = defaultAdapter;
	let preflight = null;
	let preflightOnly = false;
	let showHelp = false;
	const vitestArgs = [];

	while (args.length > 0) {
		const arg = args.shift();
		if (!arg) continue;

		if (arg === '--') {
			vitestArgs.push(...args);
			break;
		}

		if (arg === '--help' || arg === '-h') {
			showHelp = true;
			continue;
		}

		if (arg === '--preflight-only') {
			preflightOnly = true;
			continue;
		}

		if (arg === '--adapter') {
			const value = args.shift();
			if (!value) throw new Error('--adapter requires a value');
			adapter = value;
			continue;
		}

		if (arg.startsWith('--adapter=')) {
			adapter = arg.slice('--adapter='.length);
			if (!adapter) throw new Error('--adapter requires a value');
			continue;
		}

		if (arg === '--preflight') {
			const value = args.shift();
			if (!value) throw new Error('--preflight requires a value');
			preflight = value;
			continue;
		}

		if (arg.startsWith('--preflight=')) {
			preflight = arg.slice('--preflight='.length);
			if (!preflight) throw new Error('--preflight requires a value');
			continue;
		}

		if (allowPositionalBuiltIn && isBuiltInAdapter(arg) && adapter === defaultAdapter) {
			adapter = arg;
			continue;
		}

		vitestArgs.push(arg);
	}

	return { adapter, preflight, preflightOnly, showHelp, vitestArgs };
}

export function resolveAdapter(adapter, invokerCwd = process.cwd()) {
	if (isBuiltInAdapter(adapter)) {
		return {
			label: adapter,
			adapterPath: builtInAdapters[adapter],
			defaultPreflight: adapter,
		};
	}

	return {
		label: adapter,
		adapterPath: path.resolve(invokerCwd, adapter),
		defaultPreflight: 'none',
	};
}

export function runPreflight(target, options = {}) {
	if (!target || target === 'none') return 0;

	const result = spawnSync(process.execPath, ['scripts/preflight.js', target], {
		cwd: packageRoot,
		env: options.env ?? process.env,
		stdio: options.stdio ?? 'inherit',
	});
	return result.status ?? 1;
}

// Suite runs share one test database; concurrent runs corrupt each other
// with mass Database.connect failures. The lock is per-process and PID-based,
// so sequential runSuite calls from one parity run reuse it, a crashed
// holder's stale lock is reclaimed, and a second live process fails loudly.
const suiteLockPath = path.join(packageRoot, '.test-output', '.suite.lock');

function acquireSuiteLock() {
	mkdirSync(path.dirname(suiteLockPath), { recursive: true });
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			writeFileSync(suiteLockPath, String(process.pid), { flag: 'wx' });
			return true;
		} catch (err) {
			if (err.code !== 'EEXIST') throw err;
			const holder = Number(readFileSync(suiteLockPath, 'utf8'));
			if (holder === process.pid) return true;
			if (holder && isProcessAlive(holder)) {
				console.error(
					`Another suite run is already active (PID ${holder}).\n` +
					'Concurrent runs corrupt the shared test database — wait for it to finish\n' +
					`or kill it, then remove ${suiteLockPath} if it lingers.`,
				);
				return false;
			}
			try { unlinkSync(suiteLockPath); } catch {}
		}
	}
	return false;
}

function releaseSuiteLock() {
	try {
		if (Number(readFileSync(suiteLockPath, 'utf8')) === process.pid) {
			unlinkSync(suiteLockPath);
		}
	} catch {}
}

function isProcessAlive(pid) {
	try {
		process.kill(pid, 0);
		return true;
	} catch (err) {
		return err.code === 'EPERM';
	}
}

export function runSuite(options = {}) {
	if (!acquireSuiteLock()) return 1;
	try {
		return runSuiteLocked(options);
	} finally {
		releaseSuiteLock();
	}
}

function runSuiteLocked(options = {}) {
	const invokerCwd = options.invokerCwd ?? process.cwd();
	const env = options.env ?? process.env;
	const stdio = options.stdio ?? 'inherit';
	const resolved = resolveAdapter(options.adapter ?? 'xxscreeps', invokerCwd);
	const preflightTarget = options.preflight ?? resolved.defaultPreflight;
	const vitestArgs = options.vitestArgs ?? [];
	const isWatch = vitestArgs.includes('--watch') || vitestArgs.includes('-w');

	if (!options.quiet) {
		console.log(`Testing ${resolved.label}${isWatch ? ' (watch mode)' : ''}`);
	}

	const preflightStatus = runPreflight(preflightTarget, { env, stdio });
	if (preflightStatus !== 0) {
		return preflightStatus;
	}

	if (options.preflightOnly) {
		return 0;
	}

	const vitestBin = require.resolve('vitest/vitest.mjs');
	const commandArgs = isWatch ? vitestArgs : ['run', ...vitestArgs];
	const verdictPath = path.join(packageRoot, '.parity-verdict.json');
	const result = spawnSync(process.execPath, [vitestBin, ...commandArgs], {
		cwd: packageRoot,
		env: {
			...env,
			SCREEPS_OK_ADAPTER: resolved.adapterPath,
			SCREEPS_OK_REPORT_NAME: options.reportName ?? sanitizeReportName(resolved.label),
			SCREEPS_OK_PROJECT_ROOT: invokerCwd,
			SCREEPS_OK_PARITY_VERDICT: verdictPath,
		},
		stdio,
	});

	const exitCode = result.status ?? 1;

	// If vitest failed, check whether all failures are expected parity gaps.
	if (exitCode !== 0) {
		try {
			const verdict = JSON.parse(readFileSync(verdictPath, 'utf8'));
			if (verdict.genuineFailures === 0 && verdict.unexpectedPasses === 0) {
				try { unlinkSync(verdictPath); } catch {}
				return 0;
			}
		} catch {
			// No verdict file → reporter didn't run or no parity.json
		}
		try { unlinkSync(verdictPath); } catch {}
	}

	return exitCode;
}

function isBuiltInAdapter(value) {
	return Object.prototype.hasOwnProperty.call(builtInAdapters, value);
}

function sanitizeReportName(label) {
	return label
		.replace(/\\/g, '/')
		.split('/')
		.filter(Boolean)
		.pop()
		?.replace(/\.[^.]+$/, '')
		.replace(/[^A-Za-z0-9._-]+/g, '-')
		.replace(/^-+|-+$/g, '')
		|| 'results';
}
