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

	test('UNDOC-GLOBAL-003 exports aliases module.exports within the executing user module', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			exports.screepsOkViaExports = 'exports-value';
			module.exports.screepsOkViaModule = 'module-value';
			({
				sameReference: exports === module.exports,
				viaExportsOnModule: module.exports.screepsOkViaExports,
				viaModuleOnExports: exports.screepsOkViaModule,
			})
		`) as { sameReference: boolean; viaExportsOnModule: unknown; viaModuleOnExports: unknown };

		expect(result.sameReference).toBe(true);
		expect(result.viaExportsOnModule).toBe('exports-value');
		expect(result.viaModuleOnExports).toBe('module-value');
	});
});
