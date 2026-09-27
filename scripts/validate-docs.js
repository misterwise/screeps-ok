/**
 * Checks that the prose docs point at things that exist: relative links and
 * their #anchors, `npm run` scripts, and repo paths in code. Also rejects
 * absolute local paths, which only ever describe one contributor's machine.
 *
 * Usage:
 *   node scripts/validate-docs.js
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scripts = new Set(Object.keys(JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).scripts));

// docs/status.md is generated; its generator owns what it says.
const docs = [
	'AGENTS.md', 'CONTRIBUTING.md', 'README.md',
	...readdirSync(path.join(root, 'docs')).filter(name => name.endsWith('.md') && name !== 'status.md').map(name => `docs/${name}`),
];

// A repo path is one of these top-level directories and nothing that could be a placeholder (`<adapter>`, `NN-*`).
const REPO_PATH_RE = /^(?:src|scripts|tests|adapters|docs|starter|parity|bin|vendor|\.github|\.githooks)\/[\w./-]*$/;
// The guides describe a consumer's own adapter directory, which this repo doesn't have.
const CONSUMER_PATH_RE = /^adapters\/screeps-ok(?:\/|$)/;
const CODE_SPAN_RE = /(`+)(.+?)\1(?!`)/g;
const LOCAL_PATH_RE = /(?:^|[\s(`'"])(\/Users\/|\/home\/[^/\s]+\/|[A-Za-z]:\\Users\\)/;

const errors = [];
const slugCache = new Map();

for (const doc of docs) {
	const file = path.join(root, doc);
	let fence = null;
	readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
		const at = `${doc}:${i + 1}`;
		if (LOCAL_PATH_RE.test(line)) errors.push(`${at}: absolute local path`);
		for (const [, name] of line.matchAll(/\bnpm run ([\w:-]+)/g)) {
			if (!scripts.has(name)) errors.push(`${at}: no npm script "${name}"`);
		}

		const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
		if (fence) {
			if (marker?.startsWith(fence)) fence = null;
			else for (const token of line.split(/\s+/)) checkRepoPath(token.replace(/^['"]|['"]$/g, ''), at);
			return;
		}
		if (marker) {
			fence = marker;
			return;
		}

		for (const [, , code] of line.matchAll(CODE_SPAN_RE)) checkRepoPath(code.trim(), at);
		const prose = line.replace(CODE_SPAN_RE, '');
		for (const [, target] of prose.matchAll(/\]\(([^)\s]+)/g)) checkLink(file, target, at);
		const reference = /^\s*\[[^\]]+\]:\s*(\S+)/.exec(prose)?.[1];
		if (reference) checkLink(file, reference, at);
	});
}

if (errors.length > 0) {
	for (const error of errors) console.error(error);
	console.error(`validate-docs: ${errors.length} broken reference(s)`);
	process.exit(1);
}
console.log(`validate-docs: ${docs.length} docs OK`);

function checkRepoPath(candidate, at) {
	if (!REPO_PATH_RE.test(candidate) || CONSUMER_PATH_RE.test(candidate)) return;
	if (!existsSync(path.join(root, candidate))) errors.push(`${at}: no such path ${candidate}`);
}

function checkLink(fromFile, target, at) {
	if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return;
	const [rawPath, anchor] = target.split('#');
	const resolved = rawPath ? path.resolve(path.dirname(fromFile), decodeURIComponent(rawPath)) : fromFile;
	const shown = path.relative(root, resolved);
	if (!existsSync(resolved)) {
		errors.push(`${at}: link to missing ${shown}`);
		return;
	}
	if (!anchor || !resolved.endsWith('.md') || statSync(resolved).isDirectory()) return;
	if (!slugsOf(resolved).has(anchor)) errors.push(`${at}: no heading #${anchor} in ${shown}`);
}

// GitHub's heading anchors: formatting stripped, lowercased, punctuation dropped, spaces to hyphens, repeats numbered.
function slugsOf(file) {
	let slugs = slugCache.get(file);
	if (slugs) return slugs;
	slugs = new Set();
	const seen = new Map();
	let fence = null;
	for (const line of readFileSync(file, 'utf8').split('\n')) {
		const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
		if (fence) {
			if (marker?.startsWith(fence)) fence = null;
			continue;
		}
		if (marker) {
			fence = marker;
			continue;
		}
		for (const [, id] of line.matchAll(/<a\s+(?:id|name)="([^"]+)"/g)) slugs.add(id);
		const heading = /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(line)?.[1];
		if (heading === undefined) continue;
		const base = heading
			.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
			.toLowerCase()
			.replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '')
			.replace(/ /g, '-');
		const count = seen.get(base) ?? 0;
		seen.set(base, count + 1);
		slugs.add(count === 0 ? base : `${base}-${count}`);
	}
	slugCache.set(file, slugs);
	return slugs;
}
