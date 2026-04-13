import { describe, test, expect, code,
	ERR_NO_PATH, ERR_INVALID_ARGS,
	FIND_EXIT_TOP,
} from '../../src/index.js';

describe('Game.map route finding', () => {
	test('MAP-ROUTE-001 findRoute returns an array of {exit, room} steps', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W1N2', rcl: 1, owner: 'p1' },
			],
		});

		const route = await shard.runPlayer('p1', code`
			Game.map.findRoute('W1N1', 'W1N2')
		`) as Array<{ exit: number; room: string }>;
		expect(Array.isArray(route)).toBe(true);
		expect(route.length).toBeGreaterThanOrEqual(1);
		expect(route[0]).toHaveProperty('exit');
		expect(route[0]).toHaveProperty('room');
	});

	test('MAP-ROUTE-002 findRoute returns ERR_NO_PATH for an invalid room name', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			Game.map.findRoute('W1N1', 'not_a_room')
		`);
		expect(result).toBe(ERR_NO_PATH);
	});

	test('MAP-ROUTE-003 findRoute with routeCallback excluding rooms via Infinity', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W1N2', rcl: 1, owner: 'p1' },
			],
		});

		// Block the only direct route through W1N2 by returning Infinity.
		const result = await shard.runPlayer('p1', code`
			Game.map.findRoute('W1N1', 'W1N2', {
				routeCallback: (roomName) => roomName === 'W1N2' ? Infinity : 1
			})
		`);
		expect(result).toBe(ERR_NO_PATH);
	});

	test('MAP-ROUTE-004 findExit returns the first route step exit constant', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W1N2', rcl: 1, owner: 'p1' },
			],
		});

		const exit = await shard.runPlayer('p1', code`
			Game.map.findExit('W1N1', 'W1N2')
		`);
		// W1N2 is north of W1N1 → exit should be FIND_EXIT_TOP (1).
		expect(exit).toBe(FIND_EXIT_TOP);
	});

	test('MAP-ROUTE-005 findExit returns ERR_NO_PATH when no route exists and ERR_INVALID_ARGS for same room', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const noPath = await shard.runPlayer('p1', code`
			Game.map.findExit('W1N1', 'not_a_room')
		`);
		expect(noPath).toBe(ERR_NO_PATH);

		const sameRoom = await shard.runPlayer('p1', code`
			Game.map.findExit('W1N1', 'W1N1')
		`);
		expect(sameRoom).toBe(ERR_INVALID_ARGS);
	});
});
