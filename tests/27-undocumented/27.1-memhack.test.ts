import { describe, test, expect, code, MOVE, STRUCTURE_SPAWN } from '../../src/index.js';

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

	test('UNDOC-MEMHACK-007 creep.memory first access pins the in-tick object while RawMemory.set wins next tick', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE], name: 'worker',
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Memory.creeps = { worker: { existing: 'creep-old' } };
			'ok'
		`);

		const sameTick = await shard.runPlayer('p1', code`
			const creep = Game.creeps['worker'];
			const before = creep.memory.existing;
			creep.memory.preSetMutation = 'lost-before-set';
			RawMemory.set('{"creeps":{"worker":{"fromRaw":true}}}');
			const afterExisting = creep.memory.existing;
			const afterRaw = creep.memory.fromRaw;
			creep.memory.postSetMutation = 'lost-after-set';
			({
				before,
				afterExisting,
				afterRaw,
				raw: RawMemory.get(),
			})
		`) as {
			before: unknown;
			afterExisting: unknown;
			afterRaw: unknown;
			raw: string;
		};

		expect(sameTick.before).toBe('creep-old');
		expect(sameTick.afterExisting).toBe('creep-old');
		expect(sameTick.afterRaw).toBeUndefined();
		expect(sameTick.raw).toBe('{"creeps":{"worker":{"fromRaw":true}}}');

		const nextTick = await shard.runPlayer('p1', code`
			const creep = Game.creeps['worker'];
			const raw = RawMemory.get();
			({
				existing: creep.memory.existing,
				fromRaw: creep.memory.fromRaw,
				preSetMutation: creep.memory.preSetMutation,
				postSetMutation: creep.memory.postSetMutation,
				raw,
			})
		`) as {
			existing: unknown;
			fromRaw: unknown;
			preSetMutation: unknown;
			postSetMutation: unknown;
			raw: string;
		};

		expect(nextTick.existing).toBeUndefined();
		expect(nextTick.fromRaw).toBe(true);
		expect(nextTick.preSetMutation).toBeUndefined();
		expect(nextTick.postSetMutation).toBeUndefined();
		expect(nextTick.raw).toBe('{"creeps":{"worker":{"fromRaw":true}}}');
	});

	test('UNDOC-MEMHACK-008 flag.memory first access pins the in-tick object while RawMemory.set wins next tick', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].createFlag(20, 20, 'banner');
			'ok'
		`);

		await shard.runPlayer('p1', code`
			Memory.flags = { banner: { existing: 'flag-old' } };
			'ok'
		`);

		const sameTick = await shard.runPlayer('p1', code`
			const flag = Game.flags['banner'];
			const before = flag.memory.existing;
			flag.memory.preSetMutation = 'lost-before-set';
			RawMemory.set('{"flags":{"banner":{"fromRaw":true}}}');
			const afterExisting = flag.memory.existing;
			const afterRaw = flag.memory.fromRaw;
			flag.memory.postSetMutation = 'lost-after-set';
			({
				before,
				afterExisting,
				afterRaw,
				raw: RawMemory.get(),
			})
		`) as {
			before: unknown;
			afterExisting: unknown;
			afterRaw: unknown;
			raw: string;
		};

		expect(sameTick.before).toBe('flag-old');
		expect(sameTick.afterExisting).toBe('flag-old');
		expect(sameTick.afterRaw).toBeUndefined();
		expect(sameTick.raw).toBe('{"flags":{"banner":{"fromRaw":true}}}');

		const nextTick = await shard.runPlayer('p1', code`
			const flag = Game.flags['banner'];
			const raw = RawMemory.get();
			({
				existing: flag.memory.existing,
				fromRaw: flag.memory.fromRaw,
				preSetMutation: flag.memory.preSetMutation,
				postSetMutation: flag.memory.postSetMutation,
				raw,
			})
		`) as {
			existing: unknown;
			fromRaw: unknown;
			preSetMutation: unknown;
			postSetMutation: unknown;
			raw: string;
		};

		expect(nextTick.existing).toBeUndefined();
		expect(nextTick.fromRaw).toBe(true);
		expect(nextTick.preSetMutation).toBeUndefined();
		expect(nextTick.postSetMutation).toBeUndefined();
		expect(nextTick.raw).toBe('{"flags":{"banner":{"fromRaw":true}}}');
	});

	test('UNDOC-MEMHACK-009 room.memory first access pins the in-tick object while RawMemory.set wins next tick', async ({ shard }) => {
		await shard.ownedRoom('p1');

		await shard.runPlayer('p1', code`
			Memory.rooms = { W1N1: { existing: 'room-old' } };
			'ok'
		`);

		const sameTick = await shard.runPlayer('p1', code`
			const room = Game.rooms['W1N1'];
			const before = room.memory.existing;
			room.memory.preSetMutation = 'lost-before-set';
			RawMemory.set('{"rooms":{"W1N1":{"fromRaw":true}}}');
			const afterExisting = room.memory.existing;
			const afterRaw = room.memory.fromRaw;
			room.memory.postSetMutation = 'lost-after-set';
			({
				before,
				afterExisting,
				afterRaw,
				raw: RawMemory.get(),
			})
		`) as {
			before: unknown;
			afterExisting: unknown;
			afterRaw: unknown;
			raw: string;
		};

		expect(sameTick.before).toBe('room-old');
		expect(sameTick.afterExisting).toBe('room-old');
		expect(sameTick.afterRaw).toBeUndefined();
		expect(sameTick.raw).toBe('{"rooms":{"W1N1":{"fromRaw":true}}}');

		const nextTick = await shard.runPlayer('p1', code`
			const room = Game.rooms['W1N1'];
			const raw = RawMemory.get();
			({
				existing: room.memory.existing,
				fromRaw: room.memory.fromRaw,
				preSetMutation: room.memory.preSetMutation,
				postSetMutation: room.memory.postSetMutation,
				raw,
			})
		`) as {
			existing: unknown;
			fromRaw: unknown;
			preSetMutation: unknown;
			postSetMutation: unknown;
			raw: string;
		};

		expect(nextTick.existing).toBeUndefined();
		expect(nextTick.fromRaw).toBe(true);
		expect(nextTick.preSetMutation).toBeUndefined();
		expect(nextTick.postSetMutation).toBeUndefined();
		expect(nextTick.raw).toBe('{"rooms":{"W1N1":{"fromRaw":true}}}');
	});

	test('UNDOC-MEMHACK-011 access then delete RawMemory._parsed skips end-of-tick save', async ({ shard }) => {
		await shard.ownedRoom('p1');

		// Tick 1: seed a baseline value to observe across the skip.
		await shard.runPlayer('p1', code`
			Memory.seed = 'baseline';
			'ok'
		`);

		// Tick 2: read Memory (populates _parsed), mutate, then delete _parsed.
		// Tick-end serialization checks `if (_parsed)` — falsy means no save,
		// so the mutation is dropped and tick 1's raw is preserved.
		await shard.runPlayer('p1', code`
			Memory.seed;
			Memory.mutated = 'should-not-persist';
			delete RawMemory._parsed;
			'ok'
		`);

		// Tick 3: raw still reflects tick 1's saved value, AND `Memory` reflects
		// a fresh parse of that raw — the mutation never persisted. The
		// `Memory.x` assertions implicitly require cross-tick re-parse, which
		// vanilla guarantees; xxscreeps's parsed-`json` cache violates it (see
		// `memory-parsed-json-not-refreshed-across-ticks`).
		const result = await shard.runPlayer('p1', code`
			({ raw: RawMemory.get(), seed: Memory.seed, mutated: Memory.mutated })
		`) as { raw: string; seed: unknown; mutated: unknown };

		expect(result.seed).toBe('baseline');
		expect(result.mutated).toBeUndefined();
		const parsed = JSON.parse(result.raw) as Record<string, unknown>;
		expect(parsed.seed).toBe('baseline');
		expect(parsed.mutated).toBeUndefined();
	});

	test('UNDOC-MEMHACK-012 first Memory access flips the descriptor from getter to value', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			Memory;
			const desc = Object.getOwnPropertyDescriptor(global, 'Memory');
			({
				hasDesc: desc !== undefined,
				hasValue: desc && 'value' in desc,
				hasGetter: desc && typeof desc.get === 'function',
				hasSetter: desc && typeof desc.set === 'function',
				configurable: desc && desc.configurable === true,
				enumerable: desc && desc.enumerable === true,
				valueIsObject: desc && typeof desc.value === 'object' && desc.value !== null,
			})
		`) as {
			hasDesc: boolean;
			hasValue: boolean;
			hasGetter: boolean;
			hasSetter: boolean;
			configurable: boolean;
			enumerable: boolean;
			valueIsObject: boolean;
		};

		expect(result.hasDesc).toBe(true);
		expect(result.hasValue).toBe(true);
		expect(result.hasGetter).toBe(false);
		expect(result.hasSetter).toBe(false);
		expect(result.configurable).toBe(true);
		expect(result.enumerable).toBe(true);
		expect(result.valueIsObject).toBe(true);
	});

	test('UNDOC-MEMHACK-010 spawn.memory first access pins the in-tick object while RawMemory.set wins next tick', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeStructure('W1N1', {
			pos: [25, 25], owner: 'p1', structureType: STRUCTURE_SPAWN,
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			const spawn = Object.values(Game.spawns)[0];
			Memory.spawns = { [spawn.name]: { existing: 'spawn-old' } };
			'ok'
		`);

		const sameTick = await shard.runPlayer('p1', code`
			const spawn = Object.values(Game.spawns)[0];
			const before = spawn.memory.existing;
			spawn.memory.preSetMutation = 'lost-before-set';
			RawMemory.set(JSON.stringify({ spawns: { [spawn.name]: { fromRaw: true } } }));
			const afterExisting = spawn.memory.existing;
			const afterRaw = spawn.memory.fromRaw;
			spawn.memory.postSetMutation = 'lost-after-set';
			({
				name: spawn.name,
				before,
				afterExisting,
				afterRaw,
				raw: RawMemory.get(),
			})
		`) as {
			name: string;
			before: unknown;
			afterExisting: unknown;
			afterRaw: unknown;
			raw: string;
		};

		expect(sameTick.before).toBe('spawn-old');
		expect(sameTick.afterExisting).toBe('spawn-old');
		expect(sameTick.afterRaw).toBeUndefined();
		expect(JSON.parse(sameTick.raw)).toEqual({
			spawns: { [sameTick.name]: { fromRaw: true } },
		});

		const nextTick = await shard.runPlayer('p1', code`
			const spawn = Object.values(Game.spawns)[0];
			const raw = RawMemory.get();
			({
				existing: spawn.memory.existing,
				fromRaw: spawn.memory.fromRaw,
				preSetMutation: spawn.memory.preSetMutation,
				postSetMutation: spawn.memory.postSetMutation,
				raw,
			})
		`) as {
			existing: unknown;
			fromRaw: unknown;
			preSetMutation: unknown;
			postSetMutation: unknown;
			raw: string;
		};

		expect(nextTick.existing).toBeUndefined();
		expect(nextTick.fromRaw).toBe(true);
		expect(nextTick.preSetMutation).toBeUndefined();
		expect(nextTick.postSetMutation).toBeUndefined();
		expect(JSON.parse(nextTick.raw)).toEqual({
			spawns: { [sameTick.name]: { fromRaw: true } },
		});
	});
});
