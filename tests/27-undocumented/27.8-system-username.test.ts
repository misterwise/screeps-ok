import { describe, test, expect, code, SYSTEM_USERNAME } from '../../src/index.js';

describe('Undocumented API Surface — SYSTEM_USERNAME global', () => {
	test('UNDOC-SYSUSER-001 SYSTEM_USERNAME is the server username on the global scope', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`[SYSTEM_USERNAME, global.SYSTEM_USERNAME]`);
		expect(result).toEqual([SYSTEM_USERNAME, SYSTEM_USERNAME]);
	});
});
