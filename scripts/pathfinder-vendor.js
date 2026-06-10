// Shared helpers for the vendored @xxscreeps/pathfinder build.
// Used by build-pathfinder.js (producer) and build-xxscreeps.js (consumer).
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import process from 'node:process';

// Same naming as upstream's napi platform packages (module/triplet.cjs).
export function pathfinderTriplet() {
	const { arch, platform } = process;
	if (platform !== 'linux') return `${platform}-${arch}`;
	try {
		if (readFileSync('/usr/bin/ldd', 'latin1').includes('ld-musl-')) {
			return `linux-${arch}-musl`;
		}
	} catch {}
	return `linux-${arch}-gnu`;
}

// Content hash of a pathfinder source tree, used to warn when the pin's
// source has drifted from the vendor build.
export function hashTree(dir) {
	const hash = createHash('sha256');
	const skip = new Set(['node_modules', 'build', 'dist', 'package-lock.json']);
	const walk = current => {
		for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
			if (skip.has(entry.name)) continue;
			const full = join(current, entry.name);
			if (entry.isDirectory()) {
				walk(full);
			} else if (entry.isFile()) {
				hash.update(relative(dir, full));
				hash.update('\0');
				hash.update(readFileSync(full));
				hash.update('\0');
			}
		}
	};
	walk(dir);
	return hash.digest('hex');
}

// Minimal x.y.z comparison — enough for @xxscreeps/pathfinder's versioning.
// Returns <0, 0, or >0 like a comparator.
export function compareSemver(a, b) {
	const parse = v => String(v).split('-')[0].split('.').map(n => Number.parseInt(n, 10) || 0);
	const [aa, bb] = [parse(a), parse(b)];
	for (let i = 0; i < 3; i++) {
		if ((aa[i] ?? 0) !== (bb[i] ?? 0)) return (aa[i] ?? 0) - (bb[i] ?? 0);
	}
	return 0;
}
