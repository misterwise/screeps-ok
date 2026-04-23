import { describe, test, expect, code } from '../../src/index.js';

describe('Undocumented API Surface — memhack', () => {
	test('UNDOC-MEMHACK-001 Memory descriptor at tick start has a getter, no setter, and is configurable', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const desc = await shard.runPlayer('p1', code`
			const d = Object.getOwnPropertyDescriptor(global, 'Memory');
			({
				hasDesc: d !== undefined,
				hasGetter: d && typeof d.get === 'function',
				hasSetter: d && typeof d.set === 'function',
				configurable: d && d.configurable === true,
			})
		`) as { hasDesc: boolean; hasGetter: boolean; hasSetter: boolean; configurable: boolean };

		expect(desc.hasDesc).toBe(true);
		expect(desc.hasGetter).toBe(true);
		expect(desc.hasSetter).toBe(false);
		expect(desc.configurable).toBe(true);
	});

	test('UNDOC-MEMHACK-002 plain global.Memory assignment before first access silently fails', async ({ shard }) => {
		await shard.ownedRoom('p1');

		await shard.runPlayer('p1', code`
			Memory.real = 'from-raw';
			'ok'
		`);

		const result = await shard.runPlayer('p1', code`
			global.Memory = { hacked: 'B' };
			({ hacked: Memory.hacked, real: Memory.real })
		`) as { hacked: unknown; real: unknown };

		expect(result.hacked).toBeUndefined();
		expect(result.real).toBe('from-raw');
	});

	test('UNDOC-MEMHACK-003 delete+assign global.Memory before first access bypasses JSON deserialization', async ({ shard }) => {
		await shard.ownedRoom('p1');

		await shard.runPlayer('p1', code`
			Memory.real = 'from-raw';
			'ok'
		`);

		const result = await shard.runPlayer('p1', code`
			const injected = { hacked: 'C' };
			delete global.Memory;
			global.Memory = injected;
			({
				hacked: Memory.hacked,
				real: Memory.real,
				identity: Memory === injected,
			})
		`) as { hacked: unknown; real: unknown; identity: boolean };

		expect(result.hacked).toBe('C');
		expect(result.real).toBeUndefined();
		expect(result.identity).toBe(true);
	});

	test('UNDOC-MEMHACK-004 first Memory access populates RawMemory._parsed as a reference to Memory', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const parsedBefore = RawMemory._parsed;
			const memRef = Memory;
			({
				parsedBefore: typeof parsedBefore,
				identity: RawMemory._parsed === memRef,
			})
		`) as { parsedBefore: string; identity: boolean };

		expect(result.parsedBefore).toBe('undefined');
		expect(result.identity).toBe(true);
	});

	test('UNDOC-MEMHACK-005 RawMemory._parsed assignment alone does NOT short-circuit deserialization', async ({ shard }) => {
		await shard.ownedRoom('p1');

		await shard.runPlayer('p1', code`
			Memory.real = 'from-raw';
			'ok'
		`);

		const result = await shard.runPlayer('p1', code`
			RawMemory._parsed = { hacked: 'A' };
			({ hacked: Memory.hacked, real: Memory.real })
		`) as { hacked: unknown; real: unknown };

		expect(result.hacked).toBeUndefined();
		expect(result.real).toBe('from-raw');
	});

	test('UNDOC-MEMHACK-006 mutations to delete+assign-replaced Memory with _parsed set persist to raw memory at tick end', async ({ shard }) => {
		await shard.ownedRoom('p1');

		// Bootstrap: the canonical memhack pattern's first tick reads Memory
		// normally (populating the engine's internal parsed-memory cache);
		// xxscreeps's tick-end serializer only picks up the `_parsed` object
		// if the engine has seen Memory accessed through its getter at least
		// once since module-level state was reset. Vanilla's tick-end
		// adapter safety-net papers over this, but real bot code always
		// bootstraps anyway — this test mirrors real usage.
		await shard.runPlayer('p1', code`
			Memory.bootstrap = 'seeded';
			'ok'
		`);

		await shard.runPlayer('p1', code`
			const injected = { injected: true, data: 42 };
			delete global.Memory;
			global.Memory = injected;
			RawMemory._parsed = injected;
			Memory.laterAdded = 'yes';
			'ok'
		`);

		const result = await shard.runPlayer('p1', code`
			({
				rawHasInjected: RawMemory.get().includes('"injected":true'),
				rawHasData: RawMemory.get().includes('"data":42'),
				rawHasLater: RawMemory.get().includes('"laterAdded":"yes"'),
				directInjected: Memory.injected,
				directData: Memory.data,
				directLater: Memory.laterAdded,
			})
		`) as {
			rawHasInjected: boolean;
			rawHasData: boolean;
			rawHasLater: boolean;
			directInjected: unknown;
			directData: unknown;
			directLater: unknown;
		};

		expect(result.rawHasInjected).toBe(true);
		expect(result.rawHasData).toBe(true);
		expect(result.rawHasLater).toBe(true);
		expect(result.directInjected).toBe(true);
		expect(result.directData).toBe(42);
		expect(result.directLater).toBe('yes');
	});
});
