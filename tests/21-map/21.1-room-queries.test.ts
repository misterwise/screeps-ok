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

	test('MAP-ROOM-004:normal getRoomStatus returns {status:"normal", timestamp:null} for an in-world room with no admin status set', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const status = Game.map.getRoomStatus('W1N1');
			({ status: status.status, timestamp: status.timestamp })
		`) as { status: string; timestamp: number | null };

		expect(result.status).toBe('normal');
		expect(result.timestamp).toBeNull();
	});

	// Route planners avoid 'closed' rooms; a normal room misreported as closed
	// because the caller lacks vision blocks scouting into unseen neighbours.
	test('MAP-ROOM-004:normalUnseen getRoomStatus returns {status:"normal"} for an in-world room the caller has no vision of', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 3, owner: 'p1' },
				{ name: 'W3N3' }, // in-world, neutral, p1 has no presence there
			],
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			(function () {
				return [
					Game.rooms['W3N3'] ? 'visible' : 'no-vision',
					Game.map.getRoomStatus('W3N3').status,
				];
			})()
		`);
		expect(result).toEqual(['no-vision', 'normal']);
	});

	test('MAP-ROOM-004:adminClosed getRoomStatus returns {status:"closed"} for an admin-closed in-world room', async ({ shard }) => {
		shard.requires('roomStatus');
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 8, owner: 'p1' },
				{ name: 'W2N1', status: 'closed' },
			],
		});

		const result = await shard.runPlayer('p1', code`
			const status = Game.map.getRoomStatus('W2N1');
			({ status: status.status, timestamp: status.timestamp })
		`) as { status: string; timestamp: number };

		expect(result.status).toBe('closed');
		expect(typeof result.timestamp).toBe('number');
		expect(result.timestamp).toBeGreaterThan(0);
	});

	test('MAP-ROOM-004:novice getRoomStatus returns {status:"novice", timestamp:<number>} for a novice-area room', async ({ shard }) => {
		shard.requires('roomStatus');
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 8, owner: 'p1' },
				{ name: 'W2N1', status: 'novice' },
			],
		});

		const result = await shard.runPlayer('p1', code`
			const status = Game.map.getRoomStatus('W2N1');
			({ status: status.status, timestamp: status.timestamp })
		`) as { status: string; timestamp: number };

		expect(result.status).toBe('novice');
		expect(typeof result.timestamp).toBe('number');
		expect(result.timestamp).toBeGreaterThan(0);
	});

	test('MAP-ROOM-004:respawn getRoomStatus returns {status:"respawn", timestamp:<number>} for a respawn-area room', async ({ shard }) => {
		shard.requires('roomStatus');
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 8, owner: 'p1' },
				{ name: 'W2N1', status: 'respawn' },
			],
		});

		const result = await shard.runPlayer('p1', code`
			const status = Game.map.getRoomStatus('W2N1');
			({ status: status.status, timestamp: status.timestamp })
		`) as { status: string; timestamp: number };

		expect(result.status).toBe('respawn');
		expect(typeof result.timestamp).toBe('number');
		expect(result.timestamp).toBeGreaterThan(0);
	});

	test('MAP-ROOM-004:offWorld getRoomStatus returns {status:"closed", timestamp:null} for a valid-format room name that does not exist on the world', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const status = Game.map.getRoomStatus('W99N99');
			({ statusType: typeof status, status: status && status.status, timestamp: status && status.timestamp })
		`) as { statusType: string; status: string | undefined; timestamp: number | null | undefined };

		expect(result.statusType).toBe('object');
		expect(result.status).toBe('closed');
		expect(result.timestamp).toBeNull();
	});

	test('MAP-ROOM-004:invalid getRoomStatus returns undefined for an invalid-format room name', async ({ shard }) => {
		await shard.ownedRoom('p1');

		// typeof is evaluated in the sandbox so the undefined return survives
		// serialization (a bare undefined would JSON-encode to null).
		const result = await shard.runPlayer('p1', code`
			({ type: typeof Game.map.getRoomStatus('not_a_room') })
		`) as { type: string };

		expect(result.type).toBe('undefined');
	});

	test('MAP-ROOM-006 getRoomStatus returns undefined for non-string arguments', async ({ shard }) => {
		await shard.ownedRoom('p1');

		// undefined doesn't survive JSON across the boundary, so map each result
		// to a tag string. All three short-circuit on the format regex before any
		// room-status lookup, so no roomStatus capability is needed.
		const result = await shard.runPlayer('p1', code`
			[undefined, null, 123].map(a => Game.map.getRoomStatus(a) === undefined ? 'undefined' : 'value')
		`) as string[];

		expect(result).toEqual(['undefined', 'undefined', 'undefined']);
	});

	test('MAP-ROOM-005 getWorldSize equals the inclusive room-coordinate span', async ({ shard }) => {
		shard.requires('liveWorldSize');
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			// BFS the map graph from the owned room, then assert getWorldSize
			// equals the inclusive rx/ry span. Off-by-one in width/height
			// arithmetic surfaces as size === span - 1.
			const visited = new Set();
			const queue = ['W1N1'];
			while (queue.length) {
				const name = queue.shift();
				if (visited.has(name)) continue;
				visited.add(name);
				const exits = Game.map.describeExits(name);
				if (exits) for (const k in exits) queue.push(exits[k]);
			}
			const xs = [], ys = [];
			for (const name of visited) {
				const match = /^([WE])(\\d+)([NS])(\\d+)$/.exec(name);
				if (!match) continue;
				const [, h, x, v, y] = match;
				xs.push(h === 'W' ? -1 - +x : +x);
				ys.push(v === 'N' ? -1 - +y : +y);
			}
			({
				size: Game.map.getWorldSize(),
				span: Math.max(
					Math.max(...xs) - Math.min(...xs) + 1,
					Math.max(...ys) - Math.min(...ys) + 1,
				),
			})
		`) as { size: number; span: number };

		expect(result.size).toBe(result.span);
	});
});
