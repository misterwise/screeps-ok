import { describe, test, expect, code,
	OK, ERR_INVALID_ARGS,
	STRUCTURE_TERMINAL, TERMINAL_COOLDOWN,
	MARKET_ORDER_LIFE_TIME, MARKET_FEE, MARKET_MAX_ORDERS, MARKET_MAX_DEALS_PER_TICK,
	RESOURCE_ENERGY, RESOURCE_HYDROGEN,
} from '../../src/index.js';
import type { ShardFixture } from '../../src/fixture.js';
import { marketDealValidationCases } from '../../src/matrices/market-deal-validation.js';
import {
	marketChangeOrderPriceValidationCases, marketCreateOrderValidationCases, marketExtendOrderValidationCases,
} from '../../src/matrices/market-order-validation.js';

const INITIAL_CREDITS = 10_000_000;

function publicFee(price: number, amount: number): number {
	const milliPrice = Math.round(price * 1000);
	return Math.ceil(milliPrice * amount * MARKET_FEE) / 1000;
}

function publicDealCost(price: number, amount: number): number {
	return Math.round(price * 1000) * amount / 1000;
}

async function createSingleMarketRoom(shard: ShardFixture, store: Record<string, number> = { energy: 100000 }): Promise<string> {
	shard.requires('market');
	await shard.createShard({
		players: ['p1'],
		rooms: [{ name: 'W1N1', rcl: 6, owner: 'p1' }],
	});
	const terminalId = await shard.placeStructure('W1N1', {
		pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p1', store,
	});
	await shard.tick();
	return terminalId;
}

async function createTwoPlayerMarketRooms(
	shard: ShardFixture,
	p1Store: Record<string, number> = { energy: 100000 },
	p2Store: Record<string, number> = { energy: 100000, H: 1000 },
): Promise<{ p1TerminalId: string; p2TerminalId: string }> {
	shard.requires('market');
	await shard.createShard({
		players: ['p1', 'p2'],
		rooms: [
			{ name: 'W1N1', rcl: 6, owner: 'p1' },
			{ name: 'W5N1', rcl: 6, owner: 'p2' },
		],
	});
	const p1TerminalId = await shard.placeStructure('W1N1', {
		pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p1', store: p1Store,
	});
	const p2TerminalId = await shard.placeStructure('W5N1', {
		pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p2', store: p2Store,
	});
	await shard.tick();
	return { p1TerminalId, p2TerminalId };
}

async function placeSellOrder(
	shard: ShardFixture,
	price = 2.5,
	totalAmount = 1000,
	resourceType = 'H',
): Promise<string> {
	const orderId = await shard.placeMarketOrder({
		owner: 'p2',
		type: 'sell',
		resourceType,
		price,
		totalAmount,
		roomName: 'W5N1',
		active: true,
	});
	await shard.tick();
	return orderId;
}

describe('Market orders', () => {
	test('MARKET-ORDER-001 createOrder creates orders with requested parameters and public credit units', async ({ shard }) => {
		await createSingleMarketRoom(shard);

		const create = await shard.runPlayer('p1', code`
			const sellRc = Game.market.createOrder({
				type: ORDER_SELL,
				resourceType: RESOURCE_ENERGY,
				price: 0.5,
				totalAmount: 100,
				roomName: 'W1N1',
			});
			const buyRc = Game.market.createOrder(ORDER_BUY, 'H', 2, 75, 'W1N1');
			({ sellRc, buyRc })
		`) as { sellRc: number; buyRc: number };

		expect(create).toEqual({ sellRc: OK, buyRc: OK });

		const view = await shard.runPlayer('p1', code`
			const orders = Object.values(Game.market.orders).map(o => ({
				type: o.type,
				resourceType: o.resourceType,
				price: o.price,
				remainingAmount: o.remainingAmount,
				totalAmount: o.totalAmount,
				roomName: o.roomName,
			})).sort((a, b) => a.type.localeCompare(b.type) || a.resourceType.localeCompare(b.resourceType));
			({ credits: Game.market.credits, orders })
		`) as {
			credits: number;
			orders: Array<{
				type: string;
				resourceType: string;
				price: number;
				remainingAmount: number;
				totalAmount: number;
				roomName: string;
			}>;
		};

		expect(view.orders).toEqual([
			{
				type: 'buy',
				resourceType: 'H',
				price: 2,
				remainingAmount: 75,
				totalAmount: 75,
				roomName: 'W1N1',
			},
			{
				type: 'sell',
				resourceType: 'energy',
				price: 0.5,
				remainingAmount: 100,
				totalAmount: 100,
				roomName: 'W1N1',
			},
		]);
		expect(view.credits).toBeCloseTo(
			INITIAL_CREDITS - publicFee(0.5, 100) - publicFee(2, 75),
			5,
		);
	});

	for (const row of marketCreateOrderValidationCases) {
		test(`MARKET-ORDER-002:${row.label} createOrder() validation returns the canonical code`, async ({ shard }) => {
			const blockers = shard.validationBlockers(row);
			await createSingleMarketRoom(shard);
			if (blockers.has('order-cap')) {
				for (let i = 0; i < MARKET_MAX_ORDERS; i++) {
					await shard.placeMarketOrder({
						owner: 'p1', type: 'sell', resourceType: RESOURCE_ENERGY, price: 1, totalAmount: 1, roomName: 'W1N1', active: false,
					});
				}
			}

			// A price whose fee is past the player's credits, whatever they hold.
			const rc = await shard.runPlayer('p1', code`
				Game.market.createOrder({
					type: ${blockers.has('invalid-type') ? 'trade' : 'sell'},
					resourceType: ${blockers.has('invalid-resource') ? 'not-a-resource' : RESOURCE_ENERGY},
					price: ${blockers.has('invalid-price')} ? 0
						: ${blockers.has('not-enough-credits')} ? (Game.market.credits + 1) / MARKET_FEE : 1,
					totalAmount: ${blockers.has('invalid-amount') ? 0 : 1},
					roomName: ${blockers.has('no-terminal') ? 'W9N9' : 'W1N1'},
				})
			`);
			expect(rc).toBe(row.expectedRc);
		});
	}

	test('MARKET-ORDER-003 cancelOrder returns OK and removes the order from owner and public queries', async ({ shard }) => {
		await createSingleMarketRoom(shard);
		const orderId = await shard.placeMarketOrder({
			owner: 'p1',
			type: 'sell',
			resourceType: 'energy',
			price: 1,
			totalAmount: 500,
			roomName: 'W1N1',
			active: true,
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`Game.market.cancelOrder(${orderId})`);
		expect(rc).toBe(OK);

		const view = await shard.runPlayer('p1', code`
			({
				ownOrderPresent: !!Game.market.orders[${orderId}],
				byId: Game.market.getOrderById(${orderId}),
				publicOrderPresent: Game.market.getAllOrders({ resourceType: RESOURCE_ENERGY })
					.some(o => o.id === ${orderId}),
			})
		`) as { ownOrderPresent: boolean; byId: unknown; publicOrderPresent: boolean };

		expect(view).toEqual({ ownOrderPresent: false, byId: null, publicOrderPresent: false });
	});

	test('MARKET-ORDER-004 cancelOrder returns ERR_INVALID_ARGS for a non-owned or missing order', async ({ shard }) => {
		await createTwoPlayerMarketRooms(shard);
		const otherOrderId = await placeSellOrder(shard);

		const result = await shard.runPlayer('p1', code`
			({
				otherPlayersOrder: Game.market.cancelOrder(${otherOrderId}),
				missingOrder: Game.market.cancelOrder('nonexistent-id-12345'),
			})
		`) as { otherPlayersOrder: number; missingOrder: number };

		expect(result).toEqual({
			otherPlayersOrder: ERR_INVALID_ARGS,
			missingOrder: ERR_INVALID_ARGS,
		});
	});

	test('MARKET-ORDER-005 changeOrderPrice updates the order price and charges only the additional fee', async ({ shard }) => {
		await createSingleMarketRoom(shard);
		const orderId = await shard.placeMarketOrder({
			owner: 'p1',
			type: 'sell',
			resourceType: 'energy',
			price: 1,
			totalAmount: 500,
			roomName: 'W1N1',
			active: true,
		});
		await shard.tick();

		const beforeCredits = await shard.runPlayer('p1', code`Game.market.credits`) as number;
		const rc = await shard.runPlayer('p1', code`Game.market.changeOrderPrice(${orderId}, 2.5)`);
		expect(rc).toBe(OK);

		const view = await shard.runPlayer('p1', code`
			const o = Game.market.orders[${orderId}];
			({ price: o.price, remainingAmount: o.remainingAmount, credits: Game.market.credits })
		`) as { price: number; remainingAmount: number; credits: number };

		expect(view.price).toBe(2.5);
		expect(view.remainingAmount).toBe(500);
		expect(view.credits).toBeCloseTo(beforeCredits - publicFee(2.5 - 1, 500), 5);
	});

	for (const row of marketChangeOrderPriceValidationCases) {
		test(`MARKET-ORDER-006:${row.label} changeOrderPrice() validation returns the canonical code`, async ({ shard }) => {
			const blockers = shard.validationBlockers(row);
			await createSingleMarketRoom(shard);
			const orderId = await shard.placeMarketOrder({
				owner: 'p1', type: 'sell', resourceType: RESOURCE_ENERGY, price: 1, totalAmount: 1000, roomName: 'W1N1', active: true,
			});
			await shard.tick();

			// A raise whose fee on the remaining amount is past the player's credits.
			const rc = await shard.runPlayer('p1', code`
				const order = Game.market.orders[${orderId}];
				const price = ${blockers.has('invalid-price')} ? 0
					: ${blockers.has('not-enough-credits')} ? order.price + (Game.market.credits + 1) / (order.remainingAmount * MARKET_FEE)
					: order.price + 1;
				Game.market.changeOrderPrice(${blockers.has('missing-order') ? 'nonexistent-id' : orderId}, price)
			`);
			expect(rc).toBe(row.expectedRc);
		});
	}

	test('MARKET-ORDER-007 extendOrder increases remaining and total amounts and charges the extension fee', async ({ shard }) => {
		await createSingleMarketRoom(shard);
		const orderId = await shard.placeMarketOrder({
			owner: 'p1',
			type: 'sell',
			resourceType: 'energy',
			price: 2,
			totalAmount: 500,
			roomName: 'W1N1',
			active: true,
		});
		await shard.tick();

		const beforeCredits = await shard.runPlayer('p1', code`Game.market.credits`) as number;
		const rc = await shard.runPlayer('p1', code`Game.market.extendOrder(${orderId}, 300)`);
		expect(rc).toBe(OK);

		const view = await shard.runPlayer('p1', code`
			const o = Game.market.orders[${orderId}];
			({
				remainingAmount: o.remainingAmount,
				totalAmount: o.totalAmount,
				credits: Game.market.credits,
			})
		`) as { remainingAmount: number; totalAmount: number; credits: number };

		expect(view.remainingAmount).toBe(800);
		expect(view.totalAmount).toBe(800);
		expect(view.credits).toBeCloseTo(beforeCredits - publicFee(2, 300), 5);
	});

	for (const row of marketExtendOrderValidationCases) {
		test(`MARKET-ORDER-008:${row.label} extendOrder() validation returns the canonical code`, async ({ shard }) => {
			const blockers = shard.validationBlockers(row);
			await createSingleMarketRoom(shard);
			const orderId = await shard.placeMarketOrder({
				owner: 'p1', type: 'sell', resourceType: RESOURCE_ENERGY, price: 1, totalAmount: 1, roomName: 'W1N1', active: true,
			});
			await shard.tick();

			// An added amount whose fee at the order's price is past the player's credits.
			const rc = await shard.runPlayer('p1', code`
				const order = Game.market.orders[${orderId}];
				const amount = ${blockers.has('invalid-amount')} ? 0
					: ${blockers.has('not-enough-credits')} ? Math.ceil((Game.market.credits + 1) / (order.price * MARKET_FEE))
					: 1;
				Game.market.extendOrder(${blockers.has('missing-order') ? 'nonexistent-id' : orderId}, amount)
			`);
			expect(rc).toBe(row.expectedRc);
		});
	}

	test('MARKET-ORDER-009 order expiry uses wall-clock createdTimestamp and removes expired orders deterministically', async ({ shard }) => {
		await createSingleMarketRoom(shard);

		const beforeCreate = Date.now();
		await shard.runPlayer('p1', code`
			Game.market.createOrder({
				type: ORDER_SELL,
				resourceType: RESOURCE_ENERGY,
				price: 0.5,
				totalAmount: 100,
				roomName: 'W1N1',
			})
		`);
		const afterCreate = Date.now();

		const created = await shard.runPlayer('p1', code`
			const id = Object.keys(Game.market.orders)[0];
			Game.market.orders[id].createdTimestamp
		`) as number;
		expect(created).toBeGreaterThanOrEqual(beforeCreate);
		expect(created).toBeLessThanOrEqual(afterCreate);

		const freshTimestamp = Date.now();
		const expiredTimestamp = freshTimestamp - MARKET_ORDER_LIFE_TIME - 1000;
		const freshId = await shard.placeMarketOrder({
			owner: 'p1',
			type: 'sell',
			resourceType: 'H',
			price: 1,
			totalAmount: 50,
			roomName: 'W1N1',
			createdTimestamp: freshTimestamp,
			active: true,
		});
		const expiredId = await shard.placeMarketOrder({
			owner: 'p1',
			type: 'sell',
			resourceType: 'H',
			price: 1,
			totalAmount: 50,
			roomName: 'W1N1',
			createdTimestamp: expiredTimestamp,
			active: true,
		});

		await shard.tick();

		const view = await shard.runPlayer('p1', code`
			const fresh = Game.market.orders[${freshId}];
			({
				freshPresent: !!fresh,
				freshTimestamp: fresh && fresh.createdTimestamp,
				expiredPresent: !!Game.market.orders[${expiredId}],
			})
		`) as { freshPresent: boolean; freshTimestamp: number; expiredPresent: boolean };

		expect(view).toEqual({
			freshPresent: true,
			freshTimestamp,
			expiredPresent: false,
		});
	});
});

describe('Market deal', () => {
	test('MARKET-DEAL-001 successful deal returns OK and executes the trade, credits, and transaction ledger', async ({ shard }) => {
		const { p1TerminalId, p2TerminalId } = await createTwoPlayerMarketRooms(shard);
		const orderId = await placeSellOrder(shard, 2.5, 1000);

		const deal = await shard.runPlayer('p1', code`
			const order = Game.market.getOrderById(${orderId});
			const beforeCredits = Game.market.credits;
			const rc = Game.market.deal(${orderId}, 100, 'W1N1');
			({ rc, orderRoom: order.roomName, beforeCredits })
		`) as { rc: number; orderRoom: string; beforeCredits: number };
		expect(deal.rc).toBe(OK);

		const p1Terminal = await shard.expectStructure(p1TerminalId, STRUCTURE_TERMINAL);
		const p2Terminal = await shard.expectStructure(p2TerminalId, STRUCTURE_TERMINAL);
		expect(p1Terminal.store.H).toBe(100);
		expect(p2Terminal.store.H).toBe(900);
		expect(p2Terminal.store.energy).toBe(100000);

		const ledgers = await shard.runPlayers({
			p1: code`
				({
					credits: Game.market.credits,
					incoming: Game.market.incomingTransactions.map(t => ({
						resourceType: t.resourceType,
						amount: t.amount,
						from: t.from,
						to: t.to,
						order: t.order,
						sender: t.sender && t.sender.username,
						recipient: t.recipient && t.recipient.username,
					})),
					outgoing: Game.market.outgoingTransactions,
				})
			`,
			p2: code`
				({
					credits: Game.market.credits,
					outgoing: Game.market.outgoingTransactions.map(t => ({
						resourceType: t.resourceType,
						amount: t.amount,
						from: t.from,
						to: t.to,
						order: t.order,
						sender: t.sender && t.sender.username,
						recipient: t.recipient && t.recipient.username,
					})),
					incoming: Game.market.incomingTransactions,
				})
			`,
		}) as {
			p1: { credits: number; incoming: any[]; outgoing: any[] };
			p2: { credits: number; outgoing: any[]; incoming: any[] };
		};

		expect(ledgers.p1.credits).toBeCloseTo(deal.beforeCredits - publicDealCost(2.5, 100), 5);
		expect(ledgers.p2.credits).toBeCloseTo(INITIAL_CREDITS + publicDealCost(2.5, 100), 5);
		expect(ledgers.p1.outgoing).toEqual([]);
		expect(ledgers.p2.incoming).toEqual([]);
		expect(ledgers.p1.incoming).toHaveLength(1);
		expect(ledgers.p2.outgoing).toHaveLength(1);
		expect(ledgers.p1.incoming[0]).toMatchObject({
			resourceType: 'H',
			amount: 100,
			from: 'W5N1',
			to: 'W1N1',
			order: { id: orderId, type: 'sell', price: 2.5 },
		});
		expect(ledgers.p2.outgoing[0]).toMatchObject(ledgers.p1.incoming[0]);
		expect(typeof ledgers.p1.incoming[0].sender).toBe('string');
		expect(typeof ledgers.p1.incoming[0].recipient).toBe('string');
	});

	test('MARKET-DEAL-002 deal energy cost is paid by the caller terminal', async ({ shard }) => {
		const { p1TerminalId, p2TerminalId } = await createTwoPlayerMarketRooms(shard);
		const orderId = await placeSellOrder(shard, 1, 1000, 'energy');

		const before = {
			p1: await shard.expectStructure(p1TerminalId, STRUCTURE_TERMINAL),
			p2: await shard.expectStructure(p2TerminalId, STRUCTURE_TERMINAL),
		};
		const deal = await shard.runPlayer('p1', code`
			const transferCost = Game.market.calcTransactionCost(500, 'W1N1', 'W5N1');
			const rc = Game.market.deal(${orderId}, 500, 'W1N1');
			({ rc, transferCost })
		`) as { rc: number; transferCost: number };
		expect(deal.rc).toBe(OK);

		const after = {
			p1: await shard.expectStructure(p1TerminalId, STRUCTURE_TERMINAL),
			p2: await shard.expectStructure(p2TerminalId, STRUCTURE_TERMINAL),
		};

		expect(after.p1.store.energy).toBe(before.p1.store.energy + 500 - deal.transferCost);
		expect(after.p2.store.energy).toBe(before.p2.store.energy - 500);
		expect(after.p2.store.H).toBe(before.p2.store.H);
	});

	test('MARKET-DEAL-004 partial deal reduces the target order remaining amount and public amount', async ({ shard }) => {
		await createTwoPlayerMarketRooms(shard);
		const orderId = await placeSellOrder(shard, 1, 1000);

		const rc = await shard.runPlayer('p1', code`Game.market.deal(${orderId}, 300, 'W1N1')`);
		expect(rc).toBe(OK);

		const view = await shard.runPlayers({
			p1: code`
				const publicOrder = Game.market.getOrderById(${orderId});
				({
					publicRemaining: publicOrder.remainingAmount,
					publicAmount: publicOrder.amount,
					terminalH: Game.rooms['W1N1'].terminal.store.H,
				})
			`,
			p2: code`
				const ownerOrder = Game.market.orders[${orderId}];
				({
					remainingAmount: ownerOrder.remainingAmount,
					amount: ownerOrder.amount,
					terminalH: Game.rooms['W5N1'].terminal.store.H,
				})
			`,
		}) as {
			p1: { publicRemaining: number; publicAmount: number; terminalH: number };
			p2: { remainingAmount: number; amount: number; terminalH: number };
		};

		expect(view.p1).toEqual({ publicRemaining: 700, publicAmount: 700, terminalH: 300 });
		expect(view.p2).toEqual({ remainingAmount: 700, amount: 700, terminalH: 700 });
	});

	test('MARKET-DEAL-005 deal that fills the order sets remainingAmount to 0 and removes it from public queries', async ({ shard }) => {
		await createTwoPlayerMarketRooms(shard);
		const orderId = await placeSellOrder(shard, 1, 500);

		const rc = await shard.runPlayer('p1', code`Game.market.deal(${orderId}, 500, 'W1N1')`);
		expect(rc).toBe(OK);

		const view = await shard.runPlayers({
			p1: code`
				({
					byId: Game.market.getOrderById(${orderId}),
					publicPresent: Game.market.getAllOrders({ resourceType: 'H' }).some(o => o.id === ${orderId}),
				})
			`,
			p2: code`
				const ownerOrder = Game.market.orders[${orderId}];
				({
					remainingAmount: ownerOrder.remainingAmount,
					amount: ownerOrder.amount,
					active: ownerOrder.active,
				})
			`,
		}) as {
			p1: { byId: unknown; publicPresent: boolean };
			p2: { remainingAmount: number; amount: number; active: boolean };
		};

		expect(view.p1).toEqual({ byId: null, publicPresent: false });
		expect(view.p2).toEqual({ remainingAmount: 0, amount: 0, active: false });
	});

	for (const row of marketDealValidationCases) {
		test(`MARKET-DEAL-003:${row.label} deal() validation returns the canonical code`, async ({ shard }) => {
			shard.requires('market');
			const blockers = shard.validationBlockers(row);
			// p1 deals into W1N1; W2N1's terminal makes the deals that fill the cap; p2 trades from W5N1.
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [
					{ name: 'W1N1', rcl: 6, owner: 'p1' },
					{ name: 'W2N1', rcl: 6, owner: 'p1' },
					{ name: 'W5N1', rcl: 6, owner: 'p2' },
				],
			});
			if (!blockers.has('no-terminal')) {
				await shard.placeStructure('W1N1', {
					pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p1',
					store: { [RESOURCE_ENERGY]: blockers.has('terminal-energy') ? 0 : 100000 },
					...(blockers.has('cooldown') ? { cooldown: TERMINAL_COOLDOWN } : {}),
				});
			}
			await shard.placeStructure('W2N1', {
				pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p1', store: { [RESOURCE_ENERGY]: 100000 },
			});
			await shard.placeStructure('W5N1', {
				pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p2',
				store: { [RESOURCE_ENERGY]: 100000, [RESOURCE_HYDROGEN]: 1000 },
			});
			await shard.tick();
			const credits = await shard.runPlayer('p1', code`Game.market.credits`) as number;
			// A buy order wants hydrogen p1 doesn't hold; one unit of a sell order costs more than p1's credits.
			const orderId = await shard.placeMarketOrder({
				owner: 'p2',
				type: blockers.has('traded-resource') ? 'buy' : 'sell',
				resourceType: RESOURCE_HYDROGEN,
				price: blockers.has('not-enough-credits') ? credits + 1 : 1,
				totalAmount: 100,
				roomName: 'W5N1',
				active: true,
			});
			const capOrderId = await shard.placeMarketOrder({
				owner: 'p2', type: 'sell', resourceType: RESOURCE_HYDROGEN, price: 1, totalAmount: 100, roomName: 'W5N1', active: true,
			});
			await shard.tick();

			const result = await shard.runPlayer('p1', code`
				const cap = [];
				for (let i = 0; i < ${blockers.has('deal-cap') ? MARKET_MAX_DEALS_PER_TICK : 0}; i++) {
					cap.push(Game.market.deal(${capOrderId}, 1, 'W2N1'));
				}
				const id = ${blockers.has('missing-order') ? 'nonexistent-order-id' : orderId};
				const amount = ${blockers.has('invalid-amount') ? 0 : 1};
				({ cap, rc: ${blockers.has('no-target-room')} ? Game.market.deal(id, amount) : Game.market.deal(id, amount, 'W1N1') })
			`);
			expect(result).toEqual({
				cap: blockers.has('deal-cap') ? Array(MARKET_MAX_DEALS_PER_TICK).fill(OK) : [],
				rc: row.expectedRc,
			});
		});
	}
});

describe('Market queries', () => {
	test('MARKET-QUERY-001 calcTransactionCost returns the formula-based cost', async ({ shard }) => {
		shard.requires('marketBasics');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 6, owner: 'p1' }],
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const sameRoom = Game.market.calcTransactionCost(1000, 'W1N1', 'W1N1');
			const distance = Game.map.getRoomLinearDistance('W1N1', 'W2N1', true);
			const expectedCrossRoom = Math.ceil(1000 * (1 - Math.exp(-distance / 30)));
			const crossRoom = Game.market.calcTransactionCost(1000, 'W1N1', 'W2N1');
			({ sameRoom, distance, expectedCrossRoom, crossRoom })
		`) as { sameRoom: number; distance: number; expectedCrossRoom: number; crossRoom: number };

		expect(result.sameRoom).toBe(0);
		expect(result.distance).toBe(1);
		expect(result.crossRoom).toBe(result.expectedCrossRoom);
	});

	test('MARKET-QUERY-002 getAllOrders returns only active orders matching the supplied filter', async ({ shard }) => {
		await createTwoPlayerMarketRooms(shard, { energy: 100000 }, { energy: 10000, H: 1000 });
		const energySellId = await shard.placeMarketOrder({
			owner: 'p2',
			type: 'sell',
			resourceType: 'energy',
			price: 1,
			totalAmount: 500,
			roomName: 'W5N1',
			active: true,
		});
		const hSellId = await shard.placeMarketOrder({
			owner: 'p2',
			type: 'sell',
			resourceType: 'H',
			price: 1,
			totalAmount: 500,
			roomName: 'W5N1',
			active: true,
		});
		const energyBuyId = await shard.placeMarketOrder({
			owner: 'p2',
			type: 'buy',
			resourceType: 'energy',
			price: 1,
			totalAmount: 300,
			roomName: 'W5N1',
			active: true,
		});
		const inactiveEnergySellId = await shard.placeMarketOrder({
			owner: 'p2',
			type: 'sell',
			resourceType: 'energy',
			price: 1,
			totalAmount: 500,
			roomName: 'W9N9',
			active: false,
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const allIds = Game.market.getAllOrders().map(o => o.id).sort();
			const filtered = Game.market.getAllOrders({ type: ORDER_SELL, resourceType: RESOURCE_ENERGY })
				.map(o => ({ id: o.id, type: o.type, resourceType: o.resourceType, price: o.price, remainingAmount: o.remainingAmount }));
			({ allIds, filtered })
		`) as {
			allIds: string[];
			filtered: Array<{ id: string; type: string; resourceType: string; price: number; remainingAmount: number }>;
		};

		expect(result.allIds).toEqual([energyBuyId, energySellId, hSellId].sort());
		expect(result.allIds).not.toContain(inactiveEnergySellId);
		expect(result.filtered).toEqual([
			{
				id: energySellId,
				type: 'sell',
				resourceType: 'energy',
				price: 1,
				remainingAmount: 500,
			},
		]);
	});

	test('MARKET-QUERY-003 getOrderById returns public active orders, owner orders, or null', async ({ shard }) => {
		await createTwoPlayerMarketRooms(shard);
		const publicOrderId = await placeSellOrder(shard, 1.25, 400);
		const ownerOnlyOrderId = await shard.placeMarketOrder({
			owner: 'p1',
			type: 'sell',
			resourceType: 'energy',
			price: 0.75,
			totalAmount: 50,
			roomName: 'W9N9',
			active: false,
		});
		await shard.tick();

		const result = await shard.runPlayers({
			p1: code`
				const publicOrder = Game.market.getOrderById(${publicOrderId});
				const ownInactive = Game.market.getOrderById(${ownerOnlyOrderId});
				const missing = Game.market.getOrderById('no-such-id');
				({
					publicOrder: {
						id: publicOrder.id,
						type: publicOrder.type,
						resourceType: publicOrder.resourceType,
						price: publicOrder.price,
						remainingAmount: publicOrder.remainingAmount,
						roomName: publicOrder.roomName,
					},
					ownInactive: {
						id: ownInactive.id,
						type: ownInactive.type,
						resourceType: ownInactive.resourceType,
						price: ownInactive.price,
						remainingAmount: ownInactive.remainingAmount,
						roomName: ownInactive.roomName,
					},
					missing,
				})
			`,
			p2: code`
				({
					ownOrderPresent: !!Game.market.getOrderById(${publicOrderId}),
					otherInactive: Game.market.getOrderById(${ownerOnlyOrderId}),
				})
			`,
		}) as {
			p1: {
				publicOrder: Record<string, unknown>;
				ownInactive: Record<string, unknown>;
				missing: unknown;
			};
			p2: { ownOrderPresent: boolean; otherInactive: unknown };
		};

		expect(result.p1.publicOrder).toEqual({
			id: publicOrderId,
			type: 'sell',
			resourceType: 'H',
			price: 1.25,
			remainingAmount: 400,
			roomName: 'W5N1',
		});
		expect(result.p1.ownInactive).toEqual({
			id: ownerOnlyOrderId,
			type: 'sell',
			resourceType: 'energy',
			price: 0.75,
			remainingAmount: 50,
			roomName: 'W9N9',
		});
		expect(result.p1.missing).toBeNull();
		expect(result.p2).toEqual({ ownOrderPresent: true, otherInactive: null });
	});

	test('MARKET-QUERY-004 getHistory returns scoped history containers deterministically', async ({ shard }) => {
		shard.requires('market');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 6, owner: 'p1' }],
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			({
				all: Game.market.getHistory(),
			})
		`) as { all: unknown[] };

		expect(result.all).toEqual([]);
	});

	test('MARKET-QUERY-006 getHistory invalid resources and valid resources with no history return empty arrays', async ({ shard }) => {
		await createSingleMarketRoom(shard);

		const result = await shard.runPlayer('p1', code`
			const invalid = Game.market.getHistory('not-a-resource');
			const emptyEnergy = Game.market.getHistory(RESOURCE_ENERGY);
			({
				invalidIsArray: Array.isArray(invalid),
				invalidLength: Array.isArray(invalid) ? invalid.length : -1,
				emptyEnergyIsArray: Array.isArray(emptyEnergy),
				emptyEnergyLength: Array.isArray(emptyEnergy) ? emptyEnergy.length : -1,
			})
		`) as {
			invalidIsArray: boolean;
			invalidLength: number;
			emptyEnergyIsArray: boolean;
			emptyEnergyLength: number;
		};

		expect(result).toEqual({
			invalidIsArray: true,
			invalidLength: 0,
			emptyEnergyIsArray: true,
			emptyEnergyLength: 0,
		});
	});

	test('MARKET-QUERY-007 getAllOrders invalid resource filter returns an empty array', async ({ shard }) => {
		shard.requires('marketBasics');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 6, owner: 'p1' }],
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const orders = Game.market.getAllOrders({ resourceType: 'not-a-resource' });
			({
				isArray: Array.isArray(orders),
				length: orders.length,
			})
		`) as { isArray: boolean; length: number };

		expect(result).toEqual({ isArray: true, length: 0 });
	});

	test('MARKET-QUERY-005 order prices and market credits use public units, not internal milli-credits', async ({ shard }) => {
		await createSingleMarketRoom(shard);

		const before = await shard.runPlayer('p1', code`Game.market.credits`) as number;
		const rc = await shard.runPlayer('p1', code`
			Game.market.createOrder({
				type: ORDER_SELL,
				resourceType: RESOURCE_ENERGY,
				price: 0.5,
				totalAmount: 100,
				roomName: 'W1N1',
			})
		`);
		expect(rc).toBe(OK);

		const view = await shard.runPlayer('p1', code`
			const id = Object.keys(Game.market.orders)[0];
			({
				price: Game.market.orders[id].price,
				credits: Game.market.credits,
			})
		`) as { price: number; credits: number };

		expect(before).toBe(INITIAL_CREDITS);
		expect(view.price).toBe(0.5);
		expect(view.credits).toBeCloseTo(INITIAL_CREDITS - publicFee(0.5, 100), 5);
	});
});
