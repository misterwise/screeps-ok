import { describe, test, expect, code, MOVE } from '../../src/index.js';

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

	test('UNDOC-MEMJSON-005 a circular reference in Memory fails the tick: its intents and Memory writes are dropped, and the runtime survives', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE],
		});
		await shard.runPlayer('p1', code`Memory.kept = 'yes'; 'ok'`);

		await shard.expectRunPlayerError('p1', code`
			Memory.preCirc = 'before';
			const obj = { label: 'inside' };
			obj.self = obj;
			Memory.circ = obj;
			Game.getObjectById(${creepId}).move(TOP);
			'ok'
		`, 'runtime');

		const result = await shard.runPlayer('p1', code`
			({ circPresent: 'circ' in Memory, preCirc: Memory.preCirc ?? null, kept: Memory.kept ?? null })
		`);
		expect(result).toEqual({ circPresent: false, preCirc: null, kept: 'yes' });

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.pos.y).toBe(25);
	});
});
