import { describe, test, expect, code,
	OK, PWR_GENERATE_OPS, RESOURCE_HYDROGEN, STRUCTURE_POWER_SPAWN, STRUCTURE_TERMINAL,
} from '../../src/index.js';
import type { PlayerCode } from '../../src/index.js';
import type { ShardFixture } from '../../src/fixture.js';
import { INTENT_LIMIT_PER_TICK, intentLimitCases, type IntentLimitCase } from '../../src/matrices/intent-limits.js';

const ORDER_PRICE = 1;
const ORDER_AMOUNT = 100;
const POWER_CREEPS = ['A', 'B', 'C'];

// The calls in order: the fillers, the capped call, then the call past the cap.
function callList(filler: (i: number) => unknown, capped: unknown, past: unknown): unknown[] {
	return [...Array.from({ length: INTENT_LIMIT_PER_TICK - 1 }, (_, i) => filler(i)), capped, past];
}

// Three of p1's sell orders in W1N1, stocked so they stay active.
async function placeOrders(shard: ShardFixture): Promise<string[]> {
	shard.requires('market');
	await shard.createShard({ players: ['p1'], rooms: [{ name: 'W1N1', rcl: 6, owner: 'p1' }] });
	await shard.placeStructure('W1N1', {
		pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p1',
		store: { [RESOURCE_HYDROGEN]: ORDER_AMOUNT * 3 },
	});
	const ids: string[] = [];
	for (let i = 0; i < 3; i++) {
		ids.push(await shard.placeMarketOrder({
			owner: 'p1', type: 'sell', resourceType: RESOURCE_HYDROGEN,
			price: ORDER_PRICE, totalAmount: ORDER_AMOUNT, roomName: 'W1N1',
		}));
	}
	await shard.tick();
	return ids;
}

// p1's unspawned power creeps A, B and C, one owned RCL 8 room each.
async function createPowerCreeps(shard: ShardFixture): Promise<string[]> {
	shard.requires('powerCreeps');
	shard.requires('powerCreepAccountApi');
	const rooms = ['W1N1', 'W2N1', 'W3N1'];
	await shard.createShard({ players: ['p1'], rooms: rooms.map(name => ({ name, rcl: 8, owner: 'p1' })) });
	await shard.tick();
	const rcs = await shard.runPlayer('p1', code`
		${POWER_CREEPS}.map(name => PowerCreep.create(name, POWER_CLASS.OPERATOR))
	`);
	expect(rcs).toEqual(POWER_CREEPS.map(() => OK));
	return rooms;
}

interface LimitScenario {
	/** The call list and the capped and past-the-cap calls' targets to read. */
	setup(shard: ShardFixture): Promise<{ calls: unknown[]; targets: unknown[] }>;
	/** Makes the calls in order and returns their codes. */
	call(calls: unknown[]): PlayerCode;
	/** Each target's state the tick after the calls. */
	read(targets: unknown[]): PlayerCode;
	before: unknown;
	after: unknown;
}

const scenarios: Record<IntentLimitCase['label'], LimitScenario> = {
	cancelOrder: {
		async setup(shard) {
			const [a, b, c] = await placeOrders(shard);
			return { calls: callList(() => a, b, c), targets: [b, c] };
		},
		call: calls => code`${calls}.map(id => Game.market.cancelOrder(id))`,
		read: targets => code`${targets}.map(id => id in Game.market.orders)`,
		before: true,
		after: false,
	},
	changeOrderPrice: {
		async setup(shard) {
			const [a, b, c] = await placeOrders(shard);
			return { calls: callList(() => a, b, c), targets: [b, c] };
		},
		// A cut, which charges no fee.
		call: calls => code`${calls}.map(id => Game.market.changeOrderPrice(id, ${ORDER_PRICE / 2}))`,
		read: targets => code`${targets}.map(id => Game.market.orders[id].price)`,
		before: ORDER_PRICE,
		after: ORDER_PRICE / 2,
	},
	extendOrder: {
		async setup(shard) {
			const [a, b, c] = await placeOrders(shard);
			return { calls: callList(() => a, b, c), targets: [b, c] };
		},
		call: calls => code`${calls}.map(id => Game.market.extendOrder(id, 1))`,
		read: targets => code`${targets}.map(id => Game.market.orders[id].remainingAmount)`,
		before: ORDER_AMOUNT,
		after: ORDER_AMOUNT + 1,
	},
	createPowerCreep: {
		async setup(shard) {
			shard.requires('powerCreeps');
			shard.requires('powerCreepAccountApi');
			await shard.createShard({ players: ['p1'], rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }] });
			await shard.tick();
			return { calls: callList(i => `A${i}`, 'B', 'C'), targets: ['B', 'C'] };
		},
		call: calls => code`${calls}.map(name => PowerCreep.create(name, POWER_CLASS.OPERATOR))`,
		read: targets => code`${targets}.map(name => name in Game.powerCreeps)`,
		before: false,
		after: true,
	},
	spawnPowerCreep: {
		async setup(shard) {
			const rooms = await createPowerCreeps(shard);
			// A power spawn spawns one power creep a tick, so each target has its own.
			const spawns: string[] = [];
			for (const room of rooms) {
				spawns.push(await shard.placeStructure(room, { pos: [25, 25], structureType: STRUCTURE_POWER_SPAWN, owner: 'p1' }));
			}
			await shard.tick();
			const [a, b, c] = POWER_CREEPS.map((name, i) => [name, spawns[i]]);
			return { calls: callList(() => a, b, c), targets: ['B', 'C'] };
		},
		call: calls => code`${calls}.map(([name, id]) => Game.powerCreeps[name].spawn(Game.getObjectById(id)))`,
		read: targets => code`${targets}.map(name => Game.powerCreeps[name].room !== undefined)`,
		before: false,
		after: true,
	},
	suicidePowerCreep: {
		async setup(shard) {
			shard.requires('powerCreeps');
			await shard.createShard({ players: ['p1'], rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }] });
			for (const [i, name] of POWER_CREEPS.entries()) {
				await shard.placePowerCreep('W1N1', { pos: [20 + 5 * i, 25], owner: 'p1', name, powers: {} });
			}
			await shard.tick();
			return { calls: callList(() => 'A', 'B', 'C'), targets: ['B', 'C'] };
		},
		call: calls => code`${calls}.map(name => Game.powerCreeps[name].suicide())`,
		read: targets => code`${targets}.map(name => Game.powerCreeps[name].room !== undefined)`,
		before: true,
		after: false,
	},
	deletePowerCreep: {
		async setup(shard) {
			await createPowerCreeps(shard);
			return { calls: callList(() => 'A', 'B', 'C'), targets: ['B', 'C'] };
		},
		call: calls => code`${calls}.map(name => Game.powerCreeps[name].delete())`,
		// The deletion time is wall-clock, so only its presence is the effect.
		read: targets => code`${targets}.map(name => Game.powerCreeps[name].deleteTime !== undefined)`,
		before: false,
		after: true,
	},
	upgradePowerCreep: {
		async setup(shard) {
			await createPowerCreeps(shard);
			return { calls: callList(() => 'A', 'B', 'C'), targets: ['B', 'C'] };
		},
		call: calls => code`${calls}.map(name => Game.powerCreeps[name].upgrade(${PWR_GENERATE_OPS}))`,
		read: targets => code`${targets}.map(name => Game.powerCreeps[name].level)`,
		before: 0,
		after: 1,
	},
	renamePowerCreep: {
		async setup(shard) {
			await createPowerCreeps(shard);
			return { calls: callList(i => ['A', `A${i}`], ['B', 'B2'], ['C', 'C2']), targets: ['B2', 'C2'] };
		},
		call: calls => code`${calls}.map(([name, newName]) => Game.powerCreeps[name].rename(newName))`,
		read: targets => code`${targets}.map(name => name in Game.powerCreeps)`,
		before: false,
		after: true,
	},
};

async function callPastCap(shard: ShardFixture, row: IntentLimitCase) {
	const scenario = scenarios[row.label];
	const { calls, targets } = await scenario.setup(shard);
	const rcs = await shard.runPlayer('p1', scenario.call(calls)) as number[];
	const [capped, past] = await shard.runPlayer('p1', scenario.read(targets)) as unknown[];
	return { rcs, capped, past, scenario };
}

describe('Per-tick intent limits', () => {
	for (const row of intentLimitCases) {
		test(`INTENT-LIMIT-001:${row.label} the capped call in a tick takes effect`, async ({ shard }) => {
			const { rcs, capped, scenario } = await callPastCap(shard, row);
			expect(rcs.slice(0, INTENT_LIMIT_PER_TICK)).toEqual(Array(INTENT_LIMIT_PER_TICK).fill(OK));
			expect(capped).toEqual(scenario.after);
		});

		test(`INTENT-LIMIT-002:${row.label} a call past the cap returns OK and takes no effect`, async ({ shard }) => {
			const { rcs, capped, past, scenario } = await callPastCap(shard, row);
			// The capped call, the same call on another target, took effect.
			expect(capped).toEqual(scenario.after);
			expect(rcs[INTENT_LIMIT_PER_TICK]).toBe(OK);
			expect(past).toEqual(scenario.before);
		});
	}
});
