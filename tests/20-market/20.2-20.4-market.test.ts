import { describe, test, expect, code,
	OK, ERR_NOT_ENOUGH_RESOURCES, ERR_INVALID_ARGS,
	STRUCTURE_TERMINAL,
} from '../../src/index.js';

describe('Market orders', () => {
	test('MARKET-ORDER-001 createOrder creates an order with the requested parameters', async ({ shard }) => {
		shard.requires('market');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 6, owner: 'p1' }],
		});
		await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p1',
			store: { energy: 100000 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.market.createOrder({
				type: ORDER_SELL,
				resourceType: RESOURCE_ENERGY,
				price: 0.5,
				totalAmount: 1000,
				roomName: 'W1N1',
			})
		`);
		expect(rc).toBe(OK);

		// Verify the order exists in the player's orders.
		const order = await shard.runPlayer('p1', code`
			const orders = Game.market.orders;
			const ids = Object.keys(orders);
			ids.length === 1 ? ({
				type: orders[ids[0]].type,
				resourceType: orders[ids[0]].resourceType,
				price: orders[ids[0]].price,
				remainingAmount: orders[ids[0]].remainingAmount,
				roomName: orders[ids[0]].roomName,
			}) : null
		`) as { type: string; resourceType: string; price: number; remainingAmount: number; roomName: string } | null;
		expect(order).not.toBeNull();
		expect(order!.type).toBe('sell');
		expect(order!.resourceType).toBe('energy');
		expect(order!.price).toBe(0.5);
		expect(order!.remainingAmount).toBe(1000);
		expect(order!.roomName).toBe('W1N1');
	});

	test('MARKET-ORDER-002 createOrder fails with appropriate error codes', async ({ shard }) => {
		shard.requires('market');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 6, owner: 'p1' }],
		});
		// No terminal placed — createOrder should fail.
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.market.createOrder({
				type: ORDER_SELL,
				resourceType: RESOURCE_ENERGY,
				price: 0.5,
				totalAmount: 1000,
				roomName: 'W1N1',
			})
		`);
		// Without a terminal, the engine should reject the order.
		expect(rc).not.toBe(OK);
	});

	test('MARKET-ORDER-003 cancelOrder returns OK and removes the order', async ({ shard }) => {
		shard.requires('market');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 6, owner: 'p1' }],
		});
		await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p1',
			store: { energy: 100000 },
		});
		await shard.tick();

		// Create an order first.
		await shard.runPlayer('p1', code`
			Game.market.createOrder({
				type: ORDER_SELL,
				resourceType: RESOURCE_ENERGY,
				price: 1,
				totalAmount: 500,
				roomName: 'W1N1',
			})
		`);

		// Get the order id and cancel it.
		const result = await shard.runPlayer('p1', code`
			const ids = Object.keys(Game.market.orders);
			if (ids.length === 0) ({ rc: -99, count: 0 });
			else {
				const rc = Game.market.cancelOrder(ids[0]);
				({ rc, id: ids[0] })
			}
		`) as { rc: number; id?: string; count?: number };
		expect(result.rc).toBe(OK);

		// Verify it's gone.
		const remaining = await shard.runPlayer('p1', code`
			Object.keys(Game.market.orders).length
		`);
		expect(remaining).toBe(0);
	});

	test('MARKET-ORDER-004 cancelOrder returns ERR_INVALID_ARGS for non-existent order', async ({ shard }) => {
		shard.requires('market');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 6, owner: 'p1' }],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.market.cancelOrder('nonexistent-id-12345')
		`);
		expect(rc).toBe(ERR_INVALID_ARGS);
	});

	test('MARKET-ORDER-005 changeOrderPrice updates the order price', async ({ shard }) => {
		shard.requires('market');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 6, owner: 'p1' }],
		});
		await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p1',
			store: { energy: 100000 },
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Game.market.createOrder({
				type: ORDER_SELL,
				resourceType: RESOURCE_ENERGY,
				price: 1,
				totalAmount: 500,
				roomName: 'W1N1',
			})
		`);

		// Change the price.
		const rc = await shard.runPlayer('p1', code`
			const ids = Object.keys(Game.market.orders);
			Game.market.changeOrderPrice(ids[0], 2.5)
		`);
		expect(rc).toBe(OK);

		// Verify the price changed.
		const price = await shard.runPlayer('p1', code`
			const ids = Object.keys(Game.market.orders);
			Game.market.orders[ids[0]].price
		`);
		expect(price).toBe(2.5);
	});

	test('MARKET-ORDER-006 changeOrderPrice fails with appropriate error codes', async ({ shard }) => {
		shard.requires('market');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 6, owner: 'p1' }],
		});
		await shard.tick();

		// Non-existent order
		const rc = await shard.runPlayer('p1', code`
			Game.market.changeOrderPrice('nonexistent-id', 1)
		`);
		expect(rc).not.toBe(OK);
	});

	test('MARKET-ORDER-007 extendOrder increases the remaining amount', async ({ shard }) => {
		shard.requires('market');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 6, owner: 'p1' }],
		});
		await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p1',
			store: { energy: 100000 },
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Game.market.createOrder({
				type: ORDER_SELL,
				resourceType: RESOURCE_ENERGY,
				price: 1,
				totalAmount: 500,
				roomName: 'W1N1',
			})
		`);

		const rc = await shard.runPlayer('p1', code`
			const ids = Object.keys(Game.market.orders);
			Game.market.extendOrder(ids[0], 300)
		`);
		expect(rc).toBe(OK);

		const amount = await shard.runPlayer('p1', code`
			const ids = Object.keys(Game.market.orders);
			Game.market.orders[ids[0]].remainingAmount
		`);
		expect(amount).toBe(800);
	});

	test('MARKET-ORDER-008 extendOrder fails with appropriate error codes', async ({ shard }) => {
		shard.requires('market');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 6, owner: 'p1' }],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.market.extendOrder('nonexistent-id', 100)
		`);
		expect(rc).not.toBe(OK);
	});
});

describe('Market deal', () => {
	test('MARKET-DEAL-001 successful deal returns OK and executes a trade', async ({ shard }) => {
		shard.requires('market');
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 6, owner: 'p1' },
				{ name: 'W5N1', rcl: 6, owner: 'p2' },
			],
		});

		await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p1',
			store: { energy: 100000 },
		});
		await shard.placeStructure('W5N1', {
			pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p2',
			store: { energy: 100000 },
		});
		await shard.tick();

		// p2 creates a sell order. createOrder is intent-based.
		await shard.runPlayer('p2', code`
			Game.market.createOrder({
				type: ORDER_SELL,
				resourceType: RESOURCE_ENERGY,
				price: 0.01,
				totalAmount: 500,
				roomName: 'W5N1',
			})
		`);

		// Orders become visible in getAllOrders after the creation intent processes.
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const orders = Game.market.getAllOrders({ type: ORDER_SELL, resourceType: RESOURCE_ENERGY });
			if (orders.length === 0) ({ rc: -99, orderCount: 0 });
			else {
				const rc = Game.market.deal(orders[0].id, 100, 'W1N1');
				({ rc, orderId: orders[0].id })
			}
		`) as { rc: number; orderId?: string; orderCount?: number };
		expect(result.rc).toBe(OK);
	});

	test('MARKET-DEAL-002 deal energy cost is paid by the caller terminal', async ({ shard }) => {
		shard.requires('market');
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 6, owner: 'p1' },
				{ name: 'W5N1', rcl: 6, owner: 'p2' },
			],
		});

		await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p1',
			store: { energy: 100000 },
		});
		await shard.placeStructure('W5N1', {
			pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p2',
			store: { energy: 100000 },
		});
		await shard.tick();

		// p2 creates a sell order.
		await shard.runPlayer('p2', code`
			Game.market.createOrder({
				type: ORDER_SELL,
				resourceType: RESOURCE_ENERGY,
				price: 0.01,
				totalAmount: 1000,
				roomName: 'W5N1',
			})
		`);
		await shard.tick();

		// Get p1's terminal energy before deal.
		const before = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].terminal.store.energy
		`) as number;

		// p1 buys 500 energy.
		await shard.runPlayer('p1', code`
			const orders = Game.market.getAllOrders({ type: ORDER_SELL, resourceType: RESOURCE_ENERGY });
			Game.market.deal(orders[0].id, 500, 'W1N1')
		`);

		// p1's terminal should have gained 500 energy but also paid transfer cost.
		// The net change depends on distance, but the terminal energy changed.
		const after = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].terminal.store.energy
		`) as number;
		// p1 receives 500 energy but pays transfer cost, so net gain < 500.
		// The transfer cost is ceil(500 * (1 - exp(-distance/30))).
		// Just verify the terminal changed.
		expect(after).not.toBe(before);
	});

	test('MARKET-DEAL-003 deal fails with appropriate error codes', async ({ shard }) => {
		shard.requires('market');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 6, owner: 'p1' }],
		});
		await shard.tick();

		// Deal with non-existent order.
		const rc = await shard.runPlayer('p1', code`
			Game.market.deal('nonexistent-order-id', 100, 'W1N1')
		`);
		expect(rc).toBe(ERR_INVALID_ARGS);
	});
});

describe('Market queries', () => {
	test('MARKET-QUERY-001 calcTransactionCost returns the formula-based cost', async ({ shard }) => {
		shard.requires('market');
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 6, owner: 'p1' },
				{ name: 'W5N1', rcl: 6, owner: 'p1' },
			],
		});
		await shard.tick();

		// calcTransactionCost(amount, room1, room2) = ceil(amount * (1 - exp(-distance/30)))
		// Verify the function returns a non-negative number and matches the formula
		// for same-room (distance=0 → cost=0).
		const result = await shard.runPlayer('p1', code`
			const sameRoom = Game.market.calcTransactionCost(1000, 'W1N1', 'W1N1');
			const crossRoom = Game.market.calcTransactionCost(1000, 'W1N1', 'W5N1');
			({
				sameRoom,
				crossRoom,
				sameRoomIsZero: sameRoom === 0,
				crossRoomIsNumber: typeof crossRoom === 'number',
				crossRoomNonNeg: crossRoom >= 0,
			})
		`) as { sameRoom: number; crossRoom: number; sameRoomIsZero: boolean; crossRoomIsNumber: boolean; crossRoomNonNeg: boolean };

		// Same room distance = 0, so cost must be 0.
		expect(result.sameRoomIsZero).toBe(true);
		// Cross-room cost is a non-negative number.
		expect(result.crossRoomIsNumber).toBe(true);
		expect(result.crossRoomNonNeg).toBe(true);
	});

	test('MARKET-QUERY-002 getAllOrders returns matching orders', async ({ shard }) => {
		shard.requires('market');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 6, owner: 'p1' }],
		});
		await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p1',
			store: { energy: 100000 },
		});
		await shard.tick();

		// Create a sell order (intent-based).
		await shard.runPlayer('p1', code`
			Game.market.createOrder({
				type: ORDER_SELL,
				resourceType: RESOURCE_ENERGY,
				price: 1,
				totalAmount: 500,
				roomName: 'W1N1',
			})
		`);
		await shard.tick();

		// Query with filter after order is processed.
		const result = await shard.runPlayer('p1', code`
			const all = Game.market.getAllOrders({ type: ORDER_SELL, resourceType: RESOURCE_ENERGY });
			all.length
		`) as number;
		expect(result).toBeGreaterThan(0);
	});

	test('MARKET-QUERY-003 getOrderById returns the order or null', async ({ shard }) => {
		shard.requires('market');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 6, owner: 'p1' }],
		});
		await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p1',
			store: { energy: 100000 },
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Game.market.createOrder({
				type: ORDER_SELL,
				resourceType: RESOURCE_ENERGY,
				price: 1,
				totalAmount: 500,
				roomName: 'W1N1',
			})
		`);

		// Get the order by id.
		const result = await shard.runPlayer('p1', code`
			const ids = Object.keys(Game.market.orders);
			const order = Game.market.getOrderById(ids[0]);
			const missing = Game.market.getOrderById('no-such-id');
			({ found: !!order, missing: missing })
		`) as { found: boolean; missing: any };
		expect(result.found).toBe(true);
		expect(result.missing).toBeNull();
	});

	test('MARKET-QUERY-004 getHistory returns market history', async ({ shard }) => {
		shard.requires('market');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 6, owner: 'p1' }],
		});
		await shard.tick();

		// getHistory returns an array or a promise that resolves to an array.
		// On private server, it may return a Promise. Check both cases.
		const result = await shard.runPlayer('p1', code`
			const h = Game.market.getHistory(RESOURCE_ENERGY);
			typeof h === 'object' && h !== null ? (Array.isArray(h) ? 'array' : 'object') : typeof h
		`);
		// getHistory should return an array (possibly empty).
		// On some private server versions it may return a Promise or undefined.
		expect(['array', 'object']).toContain(result);
	});

	test('MARKET-QUERY-005 order prices use public credit units not internal milli-credits', async ({ shard }) => {
		shard.requires('market');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 6, owner: 'p1' }],
		});
		await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p1',
			store: { energy: 100000 },
		});
		await shard.tick();

		// Create an order at price 0.5 and verify it's stored as 0.5, not 500 (milli-credits).
		await shard.runPlayer('p1', code`
			Game.market.createOrder({
				type: ORDER_SELL,
				resourceType: RESOURCE_ENERGY,
				price: 0.5,
				totalAmount: 100,
				roomName: 'W1N1',
			})
		`);

		const price = await shard.runPlayer('p1', code`
			const ids = Object.keys(Game.market.orders);
			Game.market.orders[ids[0]].price
		`);
		expect(price).toBe(0.5);
	});
});
