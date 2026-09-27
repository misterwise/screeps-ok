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

		// The canonical pattern's first tick reads Memory through its getter, as a bot bootstraps.
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
			({ raw: JSON.parse(RawMemory.get()), memory: { injected: Memory.injected, data: Memory.data, laterAdded: Memory.laterAdded } })
		`);
		const saved = { injected: true, data: 42, laterAdded: 'yes' };
		expect(result).toEqual({ raw: saved, memory: saved });
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

	// Read Memory (populating _parsed), mutate it, then clear _parsed in the same tick.
	const skipSaveForms = [
		{ key: 'delete', tick: code`Memory.seed; Memory.mutated = 'should-not-persist'; delete RawMemory._parsed; 'ok'` },
		{ key: 'assignUndefined', tick: code`Memory.seed; Memory.mutated = 'should-not-persist'; RawMemory._parsed = undefined; 'ok'` },
	];
	for (const { key, tick } of skipSaveForms) {
		test(`UNDOC-MEMHACK-011:${key} clearing RawMemory._parsed after access skips end-of-tick save`, async ({ shard }) => {
			await shard.ownedRoom('p1');

			// Tick 1: seed a baseline value to observe across the skip.
			await shard.runPlayer('p1', code`Memory.seed = 'baseline'; 'ok'`);

			// Tick 2: tick-end serialization checks `if (_parsed)`, so the mutation is dropped.
			await shard.runPlayer('p1', tick);

			// Tick 3: raw still holds tick 1's save, and Memory is a fresh parse of it.
			const result = await shard.runPlayer('p1', code`
				({ raw: JSON.parse(RawMemory.get()), seed: Memory.seed, mutated: Memory.mutated ?? null })
			`);
			expect(result).toEqual({ raw: { seed: 'baseline' }, seed: 'baseline', mutated: null });
		});
	}

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
