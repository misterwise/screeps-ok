// Pre-publish safety net. Confirms the tarball npm would publish contains
// exactly what we expect — no CLAUDE files, no adapters/, no reports/,
// and no other artefacts that could leak private context into a public
// package. Run by `prepublishOnly` and available as `npm run validate:package`.
//
// Strategy: shell out to `npm pack --dry-run --json`, which reports every
// file that would ship without actually producing a tarball. Compare the
// returned file list against an allowlist of top-level directories we
// explicitly intend to publish, plus a denylist of patterns that must
// never appear.

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const allowedTopLevel = new Set([
	'src',
	'tests',
	'bin',
	'scripts',
	'starter',
	'parity',
	'docs',
	'behaviors.md',
	'package.json',
	'README.md',
	'LICENSE',
	'vitest.config.ts',
]);

// Files under `scripts/` that may ship. Everything else in scripts/ is
// either dev-only or setup-only and must not leak.
const allowedScripts = new Set([
	'scripts/run-suite.js',
	'scripts/preflight.js',
]);

// Directories under scripts/ that are fully allowed.
const allowedScriptDirs = ['scripts/lib/'];

// Docs we intentionally publish — everything else under docs/ is internal.
const allowedDocs = new Set([
	'docs/adapter-spec.md',
	'docs/adapter-guide.md',
	'docs/test-authoring.md',
]);

const denyPatterns = [
	/CLAUDE/i,
	/^\.agent\//,
	/^adapters\//,
	/^reports\//,
	/^server\//,
	/^screeps\//,
	/\.env$/i,
	/\.env\./,
	/\.local\./,
];

function main() {
	// --ignore-scripts avoids running `prepare`, whose stdout would
	// corrupt the JSON stream we parse below.
	const output = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
		cwd: packageRoot,
		stdio: ['ignore', 'pipe', 'inherit'],
		encoding: 'utf8',
	});

	const [pack] = JSON.parse(output);
	const files = pack.files.map((f) => f.path);

	const violations = [];

	for (const file of files) {
		const normalized = file.replace(/\\/g, '/');
		const topLevel = normalized.split('/')[0];

		for (const pattern of denyPatterns) {
			if (pattern.test(normalized)) {
				violations.push(`${normalized} — matches deny pattern ${pattern}`);
			}
		}

		if (!allowedTopLevel.has(topLevel)) {
			violations.push(`${normalized} — top-level "${topLevel}" not in allowlist`);
			continue;
		}

		if (topLevel === 'scripts') {
			const inAllowedDir = allowedScriptDirs.some((d) => normalized.startsWith(d));
			if (!inAllowedDir && !allowedScripts.has(normalized)) {
				violations.push(`${normalized} — scripts/ file not in allowlist`);
			}
		}

		if (topLevel === 'docs' && !allowedDocs.has(normalized)) {
			violations.push(`${normalized} — docs/ file not in allowlist`);
		}
	}

	if (violations.length > 0) {
		console.error('[validate-package] tarball contains disallowed files:');
		for (const v of violations) console.error(`  ${v}`);
		console.error(`\n${violations.length} violation(s). Fix the "files" field in package.json.`);
		process.exit(1);
	}

	console.log(`[validate-package] OK — ${files.length} files, ${(pack.size / 1024).toFixed(1)} KB packed, ${(pack.unpackedSize / 1024).toFixed(1)} KB unpacked`);
}

main();
