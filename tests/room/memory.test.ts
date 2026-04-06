import { describe, test, expect, code } from '../../src/index.js';

// xxscreeps simulate().player() uses runForUser (lightweight, no TickPayload)
// instead of runForPlayer (full runtime with TickPayload). Memory, RawMemory,
// and Game.flags are all populated from TickPayload during runtime
// initialization, so they are undefined in the simulate() player context.
//
// Tracked for upstream fix: simulate() needs a TickPayload-aware player mode.
// Once fixed, remove these skips.

describe('Memory', () => {
	test.skip('RAWMEMORY-001 RawMemory.set and get round-trip on the same tick', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			RawMemory.set('{"hello":"world"}');
			RawMemory.get()
		`);
		expect(result).toBe('{"hello":"world"}');
	});

	test.skip('MEMORY-003 Memory mutations are serialized back to RawMemory at tick end', async ({ shard }) => {
		await shard.ownedRoom('p1');

		// Write to Memory in tick N
		await shard.runPlayer('p1', code`
			Memory.testKey = 'testValue';
			'ok'
		`);
		await shard.tick();

		// Read RawMemory in tick N+1 — should contain the serialized value
		const raw = await shard.runPlayer('p1', code`
			RawMemory.get()
		`) as string;
		expect(raw).toContain('testKey');
		expect(raw).toContain('testValue');
	});

	test.skip('MEMORY-001 RawMemory.set before first Memory access replaces what Memory sees', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			RawMemory.set('{"injected":42}');
			Memory.injected
		`);
		expect(result).toBe(42);
	});

	test.skip('MEMORY-002 RawMemory.set after Memory access does not replace the parsed Memory', async ({ shard }) => {
		await shard.ownedRoom('p1');

		// First set up some memory
		await shard.runPlayer('p1', code`
			Memory.existing = 'original';
			'ok'
		`);
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			// Access Memory first (triggers parse)
			const before = Memory.existing;
			// Now set RawMemory to something different
			RawMemory.set('{"replaced":true}');
			// Memory should still show the original parsed value
			({ existing: Memory.existing, replaced: Memory.replaced })
		`) as { existing: string; replaced: unknown };
		expect(result.existing).toBe('original');
		expect(result.replaced).toBeUndefined();
	});
});
