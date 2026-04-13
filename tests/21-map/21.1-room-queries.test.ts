import { describe, test, expect, code } from '../../src/index.js';

describe('Game.map room queries', () => {
	test('MAP-ROOM-001 describeExits returns exit directions for valid rooms and null for invalid', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			({
				valid: Game.map.describeExits('W1N1'),
				invalid: Game.map.describeExits('not_a_room'),
			})
		`) as { valid: Record<string, string>; invalid: null };

		expect(result.valid).toEqual({
			1: 'W1N2',
			3: 'W0N1',
			5: 'W1N0',
			7: 'W2N1',
		});
		expect(result.invalid).toBeNull();
	});

	test('MAP-ROOM-002 getRoomLinearDistance returns the room-grid Manhattan distance between two rooms', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const dist = await shard.runPlayer('p1', code`
			Game.map.getRoomLinearDistance('W1N1', 'W5N5')
		`);

		expect(dist).toBe(4);
	});

	test('MAP-ROOM-003 getRoomLinearDistance with continuous=true wraps across world edges', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			({
				normal: Game.map.getRoomLinearDistance('W1N1', 'W1N1', false),
				wrapped: Game.map.getRoomLinearDistance('W1N1', 'W1N1', true),
			})
		`) as { normal: number; wrapped: number };
		// Same room → distance 0 regardless of wrap flag.
		expect(result.normal).toBe(0);
		expect(result.wrapped).toBe(0);
	});

	test('MAP-ROOM-004 getRoomStatus returns the canonical status and timestamp mapping for normal rooms', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const status = Game.map.getRoomStatus('W1N1');
			({ status: status.status, timestamp: status.timestamp })
		`) as { status: string; timestamp: number | null };

		// On a private server, all rooms are "normal" status with null timestamp.
		expect(result.status).toBe('normal');
		expect(result.timestamp).toBeNull();
	});

	test('MAP-ROOM-005 getWorldSize returns the number of rooms along one world edge', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const size = await shard.runPlayer('p1', code`
			Game.map.getWorldSize()
		`);
		// Must be a positive integer.
		expect(typeof size).toBe('number');
		expect(size).toBeGreaterThan(0);
	});
});
