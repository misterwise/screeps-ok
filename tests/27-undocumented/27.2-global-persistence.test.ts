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

	test('UNDOC-GLOBAL-003 exports aliases module.exports within an executing user module', async ({ shard }) => {
		// The module records what it saw while it ran; player code requires it.
		const probe = [
			"exports.viaExports = 'exports-value';",
			"module.exports.viaModule = 'module-value';",
			'module.exports.seen = { sameReference: exports === module.exports, viaExportsOnModule: module.exports.viaExports, viaModuleOnExports: exports.viaModule };',
		].join('\n');
		await shard.createShard({
			players: [{ name: 'p1', modules: { probe } }],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});

		const result = await shard.runPlayer('p1', code`require('probe').seen`);
		expect(result).toEqual({ sameReference: true, viaExportsOnModule: 'exports-value', viaModuleOnExports: 'module-value' });
	});

	test('UNDOC-GLOBAL-004 require.cache exposes module exports and delete evicts the entry', async ({ shard }) => {
		await shard.ownedRoom('p1');

		// `delete require.cache[name]` returning true proves nothing on its own — `delete`
		// only returns false for a non-configurable property. The meaningful contract is that
		// the read view exposes the cached module under the name it was required as, and that
		// deleting it actually evicts the entry (how a wasm bot frees its instantiated bytes).
		const result = await shard.runPlayer('p1', code`
			const exported = require('main');
			const cachedIsExports = require.cache['main'] === exported;
			const deleteOk = delete require.cache['main'];
			({ cachedIsExports, deleteOk, evicted: !('main' in require.cache) })
		`);
		expect(result).toEqual({ cachedIsExports: true, deleteOk: true, evicted: true });
	});
});
