/**
 * Validates that tests for capability-gated catalog entries include
 * the corresponding shard.requires() call.
 *
 * Catches the common mistake of adding a test under a capability-tagged
 * section in behaviors.md without gating it — which would cause spurious
 * failures on adapters that don't support the capability.
 *
 * Usage:
 *   node scripts/validate-capabilities.js
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCatalog } from './lib/parse-catalog.js';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptsDir, '..');
const behaviorsPath = path.join(root, 'behaviors.md');
const testsDir = path.join(root, 'tests');

const TEST_ID_RE = /\b([A-Z]+-(?:[A-Z]+-)?[0-9]{3})\b/g;
const REQUIRES_RE = /shard\.requires\('(\w+)'/g;

// 1. Parse catalog — build map of catalog ID → required capability
const catalog = parseCatalog(behaviorsPath);
const requiredCapability = new Map();
for (const entry of catalog) {
	if (entry.capability) {
		requiredCapability.set(entry.id, entry.capability);
	}
}

// 2. Walk test files
function walkDir(dir) {
	const files = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...walkDir(full));
		} else if (entry.name.endsWith('.test.ts')) {
			files.push(full);
		}
	}
	return files;
}

// 3. Check each test file
const errors = [];
const testFiles = walkDir(testsDir);

for (const file of testFiles) {
	const content = readFileSync(file, 'utf8');
	const relFile = path.relative(root, file);

	// Skip adapter-contract tests — they don't have catalog IDs
	if (relFile.startsWith('tests/00-adapter-contract/')) continue;

	// Extract all catalog IDs in this file
	const testIds = new Set([...content.matchAll(TEST_ID_RE)].map(m => m[1]));

	// Extract all shard.requires('cap') calls
	const requiresCalls = new Set([...content.matchAll(REQUIRES_RE)].map(m => m[1]));

	// Check: each tested ID that needs a capability should have requires()
	for (const id of testIds) {
		const needed = requiredCapability.get(id);
		if (needed && !requiresCalls.has(needed)) {
			errors.push({ file: relFile, id, capability: needed });
		}
	}
}

// 4. Report
if (errors.length > 0) {
	console.error(`Found ${errors.length} test(s) missing capability gates:\n`);
	for (const e of errors) {
		console.error(`  ${e.file}: ${e.id} requires capability '${e.capability}' but no shard.requires('${e.capability}') found`);
	}
	process.exit(1);
} else {
	console.log(`All ${requiredCapability.size} capability-gated catalog entries are properly gated in tests.`);
}
