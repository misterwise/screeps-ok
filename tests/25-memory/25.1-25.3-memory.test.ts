import { describe, test, expect, code, MOVE, FIND_HOSTILE_CREEPS } from '../../src/index.js';

describe('Memory', () => {
	test('MEMORY-001 RawMemory.set before first Memory access replaces what Memory sees', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			RawMemory.set('{"injected":42}');
			Memory.injected
		`);
		expect(result).toBe(42);
	});

	test('MEMORY-002 RawMemory.set after Memory access does not replace the parsed Memory', async ({ shard }) => {
		await shard.ownedRoom('p1');

		// First set up some memory
		await shard.runPlayer('p1', code`
			Memory.existing = 'original';
			'ok'
		`);

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

	test('MEMORY-003 Memory mutations are serialized back to RawMemory at tick end', async ({ shard }) => {
		await shard.ownedRoom('p1');

		// Write to Memory in tick N
		await shard.runPlayer('p1', code`
			Memory.testKey = 'testValue';
			'ok'
		`);

		// Read RawMemory on next tick — should contain the serialized value
		const raw = await shard.runPlayer('p1', code`
			RawMemory.get()
		`) as string;
		expect(raw).toContain('testKey');
		expect(raw).toContain('testValue');
	});

	test('MEMORY-004 RawMemory.set throws when raw memory exceeds 2 MB', async ({ shard }) => {
		await shard.ownedRoom('p1');

		// Try to set a string larger than 2 MB.
		const result = await shard.runPlayer('p1', code`
			try {
				RawMemory.set('x'.repeat(2 * 1024 * 1024 + 1));
				'no-error'
			} catch (e) {
				'threw'
			}
		`);
		expect(result).toBe('threw');
	});
});

describe('RawMemory', () => {
	test('RAWMEMORY-001 RawMemory.set and get round-trip on the same tick', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			RawMemory.set('{"hello":"world"}');
			RawMemory.get()
		`);
		expect(result).toBe('{"hello":"world"}');
	});

	test('RAWMEMORY-002 segment limits match canonical constants', async ({ shard }) => {
		await shard.ownedRoom('p1');

		// The engine enforces: max 10 active segments, segment ids 0-99,
		// each segment up to 100 KB.
		// Verify setActiveSegments accepts up to 10 ids.
		const result = await shard.runPlayer('p1', code`
			try {
				RawMemory.setActiveSegments([0,1,2,3,4,5,6,7,8,9]);
				'ok-10'
			} catch (e) {
				'error-10'
			}
		`);
		expect(result).toBe('ok-10');

		// Verify setActiveSegments rejects more than 10 ids.
		const result11 = await shard.runPlayer('p1', code`
			try {
				RawMemory.setActiveSegments([0,1,2,3,4,5,6,7,8,9,10]);
				'ok-11'
			} catch (e) {
				'error-11'
			}
		`);
		expect(result11).toBe('error-11');
	});

	test('RAWMEMORY-003 setActiveSegments makes those segments active on the next tick', async ({ shard }) => {
		await shard.ownedRoom('p1');

		// Request segment 5
		await shard.runPlayer('p1', code`
			RawMemory.setActiveSegments([5]);
			'ok'
		`);

		// On next tick, segment 5 should be in RawMemory.segments
		const result = await shard.runPlayer('p1', code`
			5 in RawMemory.segments
		`);
		expect(result).toBe(true);
	});

	test('RAWMEMORY-004 RawMemory.segments[id] exposes content of active segments', async ({ shard }) => {
		await shard.ownedRoom('p1');

		// Activate segment 0 and write to it.
		await shard.runPlayer('p1', code`
			RawMemory.setActiveSegments([0]);
			'ok'
		`);

		// Write content to segment 0
		await shard.runPlayer('p1', code`
			RawMemory.segments[0] = 'test-data';
			'ok'
		`);

		// Next tick, activate segment 0 again and read it.
		await shard.runPlayer('p1', code`
			RawMemory.setActiveSegments([0]);
			'ok'
		`);

		const content = await shard.runPlayer('p1', code`
			RawMemory.segments[0]
		`);
		expect(content).toBe('test-data');
	});
	test('RAWMEMORY-005 writing to segments[id] persists the new content to the next tick', async ({ shard }) => {
		await shard.ownedRoom('p1');

		// Activate segment 2 and write content.
		await shard.runPlayer('p1', code`
			RawMemory.setActiveSegments([2]);
			'ok'
		`);
		await shard.runPlayer('p1', code`
			RawMemory.segments[2] = 'persisted-value';
			'ok'
		`);

		// Re-activate segment 2 on a fresh tick and read back.
		await shard.runPlayer('p1', code`
			RawMemory.setActiveSegments([2]);
			'ok'
		`);
		const content = await shard.runPlayer('p1', code`
			RawMemory.segments[2]
		`);
		expect(content).toBe('persisted-value');
	});
});

describe('Foreign segments', () => {
	test('RAWMEMORY-FOREIGN-001 setActiveForeignSegment does not replace foreignSegment same tick', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});

		// Place a p2 creep in p1's room so p1 can discover p2's username.
		await shard.placeCreep('W1N1', { pos: [10, 10], owner: 'p2', body: [MOVE] });
		await shard.tick();

		// p2 publishes segment 0
		await shard.runPlayer('p2', code`
			RawMemory.setActiveSegments([0]);
			'ok'
		`);
		await shard.runPlayer('p2', code`
			RawMemory.segments[0] = 'p2-data';
			RawMemory.setPublicSegments([0]);
			RawMemory.setDefaultPublicSegment(0);
			'ok'
		`);

		// p1 requests p2's foreign segment using p2's engine username.
		const result = await shard.runPlayer('p1', code`
			const hostile = Game.rooms['W1N1'].find(FIND_HOSTILE_CREEPS)[0];
			const p2name = hostile.owner.username;
			RawMemory.setActiveForeignSegment(p2name);
			RawMemory.foreignSegment ? 'available' : 'not-available'
		`);
		// Should NOT be available same tick.
		expect(result).toBe('not-available');
	});

	test('RAWMEMORY-FOREIGN-002 foreignSegment exposes username, id, and data', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});

		await shard.placeCreep('W1N1', { pos: [10, 10], owner: 'p2', body: [MOVE] });
		await shard.tick();

		// p2 publishes segment 1 with content.
		await shard.runPlayer('p2', code`
			RawMemory.setActiveSegments([1]);
			'ok'
		`);
		await shard.runPlayer('p2', code`
			RawMemory.segments[1] = 'shared-data';
			RawMemory.setPublicSegments([1]);
			RawMemory.setDefaultPublicSegment(1);
			'ok'
		`);

		// p1 requests p2's foreign segment using engine username.
		await shard.runPlayer('p1', code`
			const hostile = Game.rooms['W1N1'].find(FIND_HOSTILE_CREEPS)[0];
			RawMemory.setActiveForeignSegment(hostile.owner.username);
			'ok'
		`);

		// Foreign segment becomes available after the request is processed.
		const result = await shard.runPlayer('p1', code`
			const fs = RawMemory.foreignSegment;
			fs ? ({ username: fs.username, id: fs.id, data: fs.data }) : null
		`) as { username: string; id: number; data: string } | null;
		expect(result).not.toBeNull();
		expect(result!.id).toBe(1);
		expect(result!.data).toBe('shared-data');
	});

	test('RAWMEMORY-FOREIGN-003 setPublicSegments controls which segments are exposed', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});

		await shard.placeCreep('W1N1', { pos: [10, 10], owner: 'p2', body: [MOVE] });
		await shard.tick();

		// p2 publishes only segment 5.
		await shard.runPlayer('p2', code`
			RawMemory.setActiveSegments([0, 5]);
			'ok'
		`);
		await shard.runPlayer('p2', code`
			RawMemory.segments[0] = 'private';
			RawMemory.segments[5] = 'public';
			RawMemory.setPublicSegments([5]);
			RawMemory.setDefaultPublicSegment(5);
			'ok'
		`);

		// p1 requests p2's default segment.
		await shard.runPlayer('p1', code`
			const hostile = Game.rooms['W1N1'].find(FIND_HOSTILE_CREEPS)[0];
			RawMemory.setActiveForeignSegment(hostile.owner.username);
			'ok'
		`);

		// Should get segment 5 (the public one).
		const result = await shard.runPlayer('p1', code`
			const fs = RawMemory.foreignSegment;
			fs ? ({ id: fs.id, data: fs.data }) : null
		`) as { id: number; data: string } | null;
		expect(result).not.toBeNull();
		expect(result!.id).toBe(5);
		expect(result!.data).toBe('public');
	});

	test('RAWMEMORY-FOREIGN-004 setDefaultPublicSegment sets the default for foreign readers', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});

		await shard.placeCreep('W1N1', { pos: [10, 10], owner: 'p2', body: [MOVE] });
		await shard.tick();

		// p2 publishes segments 3 and 7, default = 7.
		await shard.runPlayer('p2', code`
			RawMemory.setActiveSegments([3, 7]);
			'ok'
		`);
		await shard.runPlayer('p2', code`
			RawMemory.segments[3] = 'seg3';
			RawMemory.segments[7] = 'seg7';
			RawMemory.setPublicSegments([3, 7]);
			RawMemory.setDefaultPublicSegment(7);
			'ok'
		`);

		// p1 requests p2 without specifying id — should get default (7).
		await shard.runPlayer('p1', code`
			const hostile = Game.rooms['W1N1'].find(FIND_HOSTILE_CREEPS)[0];
			RawMemory.setActiveForeignSegment(hostile.owner.username);
			'ok'
		`);

		const result = await shard.runPlayer('p1', code`
			const fs = RawMemory.foreignSegment;
			fs ? ({ id: fs.id, data: fs.data }) : null
		`) as { id: number; data: string } | null;
		expect(result).not.toBeNull();
		expect(result!.id).toBe(7);
		expect(result!.data).toBe('seg7');
	});

	test('RAWMEMORY-FOREIGN-005 foreign segment request persists across ticks', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});

		await shard.placeCreep('W1N1', { pos: [10, 10], owner: 'p2', body: [MOVE] });
		await shard.tick();

		// p2 publishes segment 2.
		await shard.runPlayer('p2', code`
			RawMemory.setActiveSegments([2]);
			'ok'
		`);
		await shard.runPlayer('p2', code`
			RawMemory.segments[2] = 'persistent';
			RawMemory.setPublicSegments([2]);
			RawMemory.setDefaultPublicSegment(2);
			'ok'
		`);

		// p1 requests p2's foreign segment.
		await shard.runPlayer('p1', code`
			const hostile = Game.rooms['W1N1'].find(FIND_HOSTILE_CREEPS)[0];
			RawMemory.setActiveForeignSegment(hostile.owner.username);
			'ok'
		`);

		// First read: foreign segment is available.
		const first = await shard.runPlayer('p1', code`
			const fs = RawMemory.foreignSegment;
			fs ? fs.data : null
		`);
		expect(first).toBe('persistent');

		// Second read on the next tick WITHOUT re-issuing setActiveForeignSegment:
		// the request persists.
		const second = await shard.runPlayer('p1', code`
			const fs = RawMemory.foreignSegment;
			fs ? fs.data : null
		`);
		expect(second).toBe('persistent');
	});

	test('RAWMEMORY-FOREIGN-006 setActiveForeignSegment(null) clears the pending request', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});

		await shard.placeCreep('W1N1', { pos: [10, 10], owner: 'p2', body: [MOVE] });
		await shard.tick();

		// p2 publishes segment 1. (Segment id 0 is intentionally avoided —
		// vanilla treats `activeForeignSegment.id === 0` as falsy and never
		// fetches it, so a non-zero id is required to exercise delivery.)
		await shard.runPlayer('p2', code`
			RawMemory.setActiveSegments([1]);
			'ok'
		`);
		await shard.runPlayer('p2', code`
			RawMemory.segments[1] = 'p2-data';
			RawMemory.setPublicSegments([1]);
			RawMemory.setDefaultPublicSegment(1);
			'ok'
		`);

		// p1 requests, then confirms delivery.
		await shard.runPlayer('p1', code`
			const hostile = Game.rooms['W1N1'].find(FIND_HOSTILE_CREEPS)[0];
			RawMemory.setActiveForeignSegment(hostile.owner.username);
			'ok'
		`);
		const delivered = await shard.runPlayer('p1', code`
			const fs = RawMemory.foreignSegment;
			fs ? fs.data : null
		`);
		expect(delivered).toBe('p2-data');

		// p1 clears the pending request.
		await shard.runPlayer('p1', code`
			RawMemory.setActiveForeignSegment(null);
			'ok'
		`);

		// Next tick: foreignSegment is undefined (checked inside player code
		// because the JSON transport normalizes undefined to null).
		const cleared = await shard.runPlayer('p1', code`
			RawMemory.foreignSegment === undefined ? 'undefined' : 'defined'
		`);
		expect(cleared).toBe('undefined');
	});

	test('RAWMEMORY-FOREIGN-007 setActiveForeignSegment with unknown username fails gracefully', async ({ shard }) => {
		await shard.ownedRoom('p1');

		// Random suffix avoids accidental NPC-username collisions (Invader,
		// Source Keeper, etc.).
		const fakeName = `DoesNotExist-${Math.random().toString(36).slice(2, 6)}`;

		// Calling with an unknown username must not throw.
		const called = await shard.runPlayer('p1', code`
			try {
				RawMemory.setActiveForeignSegment(${fakeName});
				'ok'
			} catch (e) {
				'threw'
			}
		`);
		expect(called).toBe('ok');

		// Next tick: foreignSegment is undefined (no delivery, no crash).
		const result = await shard.runPlayer('p1', code`
			RawMemory.foreignSegment === undefined ? 'undefined' : 'defined'
		`);
		expect(result).toBe('undefined');
	});

	test('RAWMEMORY-FOREIGN-008 revocation via setPublicSegments takes effect next tick', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});

		await shard.placeCreep('W1N1', { pos: [10, 10], owner: 'p2', body: [MOVE] });
		await shard.tick();

		// p2 publishes segment 4.
		await shard.runPlayer('p2', code`
			RawMemory.setActiveSegments([4]);
			'ok'
		`);
		await shard.runPlayer('p2', code`
			RawMemory.segments[4] = 'revocable';
			RawMemory.setPublicSegments([4]);
			RawMemory.setDefaultPublicSegment(4);
			'ok'
		`);

		// p1 requests, confirms delivery.
		await shard.runPlayer('p1', code`
			const hostile = Game.rooms['W1N1'].find(FIND_HOSTILE_CREEPS)[0];
			RawMemory.setActiveForeignSegment(hostile.owner.username);
			'ok'
		`);
		const delivered = await shard.runPlayer('p1', code`
			const fs = RawMemory.foreignSegment;
			fs ? fs.data : null
		`);
		expect(delivered).toBe('revocable');

		// p2 revokes segment 4 by replacing the public set with a different id.
		// (A literal `setPublicSegments([])` is a no-op in vanilla — the
		// runtime emits an empty string, which the intent processor's
		// truthy-check discards — so we remove the id by swapping the set
		// instead.)
		await shard.runPlayer('p2', code`
			RawMemory.setPublicSegments([9]);
			'ok'
		`);

		// p1 reads again without re-issuing setActiveForeignSegment.
		// Authorization has been withdrawn → undefined.
		const revoked = await shard.runPlayer('p1', code`
			RawMemory.foreignSegment === undefined ? 'undefined' : 'defined'
		`);
		expect(revoked).toBe('undefined');
	});

	test('RAWMEMORY-FOREIGN-009 explicit id without a matching public grant yields undefined', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});

		await shard.placeCreep('W1N1', { pos: [10, 10], owner: 'p2', body: [MOVE] });
		await shard.tick();

		// p2 publishes segment 7 only — deliberately no setDefaultPublicSegment,
		// so the default-fallback path is not exercised.
		await shard.runPlayer('p2', code`
			RawMemory.setActiveSegments([7]);
			'ok'
		`);
		await shard.runPlayer('p2', code`
			RawMemory.segments[7] = 'seg7';
			RawMemory.setPublicSegments([7]);
			'ok'
		`);

		// p1 requests segment 5, which p2 has NOT published.
		await shard.runPlayer('p1', code`
			const hostile = Game.rooms['W1N1'].find(FIND_HOSTILE_CREEPS)[0];
			RawMemory.setActiveForeignSegment(hostile.owner.username, 5);
			'ok'
		`);

		const result = await shard.runPlayer('p1', code`
			RawMemory.foreignSegment === undefined ? 'undefined' : 'defined'
		`);
		expect(result).toBe('undefined');
	});
});
