import { describe, test, expect, code } from '../../src/index.js';

describe('Undocumented API Surface — SYSTEM_USERNAME global', () => {
	test('UNDOC-SYSUSER-001 SYSTEM_USERNAME is a non-empty string accessible on the global scope', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			({
				bareType: typeof SYSTEM_USERNAME,
				globalType: typeof global.SYSTEM_USERNAME,
				bareLength: typeof SYSTEM_USERNAME === 'string' ? SYSTEM_USERNAME.length : -1,
				bareEqGlobal: SYSTEM_USERNAME === global.SYSTEM_USERNAME,
			})
		`) as { bareType: string; globalType: string; bareLength: number; bareEqGlobal: boolean };

		expect(result.bareType).toBe('string');
		expect(result.globalType).toBe('string');
		expect(result.bareLength).toBeGreaterThan(0);
		expect(result.bareEqGlobal).toBe(true);
	});
});
