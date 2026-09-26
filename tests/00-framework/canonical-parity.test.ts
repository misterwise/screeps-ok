import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { loadParity } from '../../scripts/lib/parity.js';

const adaptersDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../adapters');
const engines = readdirSync(adaptersDir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name);

describe('canonical parity.json', () => {
	test.each(engines)('%s registers every gap with a why', engine => {
		const { gaps } = loadParity(path.join(adaptersDir, engine, 'parity.json'));
		const unexplained = Object.entries(gaps).filter(([, gap]) => !gap.why).map(([gapId]) => gapId);
		expect(unexplained).toEqual([]);
	});

	test.each(engines)('%s skips no test: a reference adapter runs the whole suite', engine => {
		expect(loadParity(path.join(adaptersDir, engine, 'parity.json')).skips).toEqual({});
	});
});
