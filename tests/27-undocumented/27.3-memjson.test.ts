import { describe, test, expect, code } from '../../src/index.js';

describe('Undocumented API Surface — Memory serialization fidelity', () => {
	test('UNDOC-MEMJSON-001 function values assigned to Memory are absent on the next tick', async ({ shard }) => {
		await shard.ownedRoom('p1');

		await shard.runPlayer('p1', code`
			Memory.fn = function() { return 42; };
			Memory.marker = 'present';
			'ok'
		`);

		const result = await shard.runPlayer('p1', code`
			({
				fnAbsent: !('fn' in Memory),
				fnType: typeof Memory.fn,
				markerValue: Memory.marker,
			})
		`) as { fnAbsent: boolean; fnType: string; markerValue: unknown };

		expect(result.markerValue).toBe('present');
		expect(result.fnAbsent).toBe(true);
		expect(result.fnType).toBe('undefined');
	});

	test('UNDOC-MEMJSON-002 undefined-valued Memory keys are dropped on the next tick', async ({ shard }) => {
		await shard.ownedRoom('p1');

		await shard.runPlayer('p1', code`
			Memory.undef = undefined;
			Memory.marker = 'present';
			'ok'
		`);

		const result = await shard.runPlayer('p1', code`
			({
				undefAbsent: !('undef' in Memory),
				markerValue: Memory.marker,
			})
		`) as { undefAbsent: boolean; markerValue: unknown };

		expect(result.markerValue).toBe('present');
		expect(result.undefAbsent).toBe(true);
	});

	test('UNDOC-MEMJSON-003 NaN values in Memory read as null on the next tick', async ({ shard }) => {
		await shard.ownedRoom('p1');

		await shard.runPlayer('p1', code`
			Memory.nan = NaN;
			Memory.marker = 'present';
			'ok'
		`);

		const result = await shard.runPlayer('p1', code`
			({
				nanPresent: 'nan' in Memory,
				nanValue: Memory.nan,
				nanIsNull: Memory.nan === null,
				markerValue: Memory.marker,
			})
		`) as { nanPresent: boolean; nanValue: unknown; nanIsNull: boolean; markerValue: unknown };

		expect(result.markerValue).toBe('present');
		expect(result.nanPresent).toBe(true);
		expect(result.nanIsNull).toBe(true);
	});

	test('UNDOC-MEMJSON-004 Infinity values in Memory read as null on the next tick', async ({ shard }) => {
		await shard.ownedRoom('p1');

		await shard.runPlayer('p1', code`
			Memory.pos = Infinity;
			Memory.neg = -Infinity;
			Memory.marker = 'present';
			'ok'
		`);

		const result = await shard.runPlayer('p1', code`
			({
				posPresent: 'pos' in Memory,
				posIsNull: Memory.pos === null,
				negPresent: 'neg' in Memory,
				negIsNull: Memory.neg === null,
				markerValue: Memory.marker,
			})
		`) as {
			posPresent: boolean; posIsNull: boolean;
			negPresent: boolean; negIsNull: boolean;
			markerValue: unknown;
		};

		expect(result.markerValue).toBe('present');
		expect(result.posPresent).toBe(true);
		expect(result.posIsNull).toBe(true);
		expect(result.negPresent).toBe(true);
		expect(result.negIsNull).toBe(true);
	});

	test('UNDOC-MEMJSON-005 a circular reference in Memory does not crash the player runtime; the unserializable subtree does not persist', async ({ shard }) => {
		await shard.ownedRoom('p1');

		await shard.runPlayer('p1', code`
			Memory.preCirc = 'before';
			const obj = { label: 'inside' };
			obj.self = obj;
			Memory.circ = obj;
			Memory.postCirc = 'after';
			'ok'
		`);

		const result = await shard.runPlayer('p1', code`
			let circIsSelfReferencing = false;
			try {
				circIsSelfReferencing = Boolean(Memory.circ && Memory.circ.self === Memory.circ);
			} catch (e) {
				circIsSelfReferencing = 'threw:' + (e && e.message);
			}
			({
				runtimeAlive: true,
				circAbsent: !('circ' in Memory) || Memory.circ === null,
				circIsSelfReferencing,
				preCirc: Memory.preCirc,
				postCirc: Memory.postCirc,
			})
		`) as {
			runtimeAlive: boolean;
			circAbsent: boolean;
			circIsSelfReferencing: unknown;
			preCirc: unknown;
			postCirc: unknown;
		};

		expect(result.runtimeAlive).toBe(true);
		expect(result.circAbsent).toBe(true);
		expect(result.circIsSelfReferencing).toBe(false);
	});
});
