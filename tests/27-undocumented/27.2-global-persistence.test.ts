import { describe, test, expect, code } from '../../src/index.js';

describe('Undocumented API Surface — global / VM persistence', () => {
	test('UNDOC-GLOBAL-001 top-level assignments to global.X persist across ticks within the same VM', async ({ shard }) => {
		await shard.ownedRoom('p1');

		await shard.runPlayer('p1', code`
			global.screepsOkGlobalProbe = 'across-ticks-42';
			'ok'
		`);

		const result = await shard.runPlayer('p1', code`
			({
				viaGlobal: global.screepsOkGlobalProbe,
				viaBare: typeof screepsOkGlobalProbe === 'string' ? screepsOkGlobalProbe : null,
			})
		`) as { viaGlobal: unknown; viaBare: unknown };

		expect(result.viaGlobal).toBe('across-ticks-42');
		expect(result.viaBare).toBe('across-ticks-42');
	});

	test('UNDOC-GLOBAL-002 require()d module exports are reference-stable across ticks within the same VM', async ({ shard }) => {
		await shard.ownedRoom('p1');

		await shard.runPlayer('p1', code`
			global.screepsOkMainRef = require('main');
			'ok'
		`);

		const result = await shard.runPlayer('p1', code`
			const freshRequire = require('main');
			({
				sameReference: freshRequire === global.screepsOkMainRef,
				bothDefined: freshRequire !== undefined && global.screepsOkMainRef !== undefined,
			})
		`) as { sameReference: boolean; bothDefined: boolean };

		expect(result.bothDefined).toBe(true);
		expect(result.sameReference).toBe(true);
	});
});
