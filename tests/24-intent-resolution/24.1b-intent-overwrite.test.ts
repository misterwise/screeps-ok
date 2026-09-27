import { describe, test, expect, code,
	OK, ERR_NOT_FOUND,
	MOVE, WORK, CARRY, ATTACK, RANGED_ATTACK, HEAL, CLAIM, TOUGH, TOP, BOTTOM, RIGHT, body,
	STRUCTURE_CONTAINER, STRUCTURE_RAMPART, STRUCTURE_ROAD,
	RESOURCE_ENERGY, RESOURCE_GHODIUM, RESOURCE_HYDROGEN, SAFE_MODE_COST,
} from '../../src/index.js';
import type { PlayerReturnValue } from '../../src/index.js';
import type { ShardFixture } from '../../src/fixture.js';
import { intentCancelCases, intentOverwriteCases, type IntentOrderMethod } from '../../src/matrices/intent-creep-orders.js';

// How the sandbox calls the method with a value: on the object with that id (or `value.id`), on that
// object with energy, with the value itself, on the room's controller, signing it with the value, or with no argument.
type CallKind = 'object' | 'energy' | 'value' | 'controller' | 'sign' | 'none';
// What a value's effect changes: an object's hits, site progress or energy; an object's tile; whether
// the actor stands on `value`'s tile; the actor's store of `value` (or `value.resource`); whether the
// actor says, or the controller's sign reads, `value`; the controller state the method changes; the actor's life.
type StateKind = 'hits' | 'progress' | 'energy' | 'pos' | 'at' | 'store' | 'saying' | 'sign' | 'controller' | 'alive';

interface OrderScenario {
	call: CallKind;
	state: StateKind;
	/**
	 * Places the actor and its targets: `a` is the call replaced or canceled, `b` the call replacing it.
	 * `followers` move toward the actor each call tick, which then moves `actorMove`.
	 */
	setup(shard: ShardFixture): Promise<{ actor: string; a: unknown; b?: unknown; followers?: string[]; actorMove?: number }>;
}

async function world(shard: ShardFixture) {
	await shard.createShard({
		players: ['p1', 'p2'],
		rooms: [
			{ name: 'W1N1', rcl: 2, owner: 'p1' },
			{ name: 'W2N1', rcl: 1, owner: 'p2' },
			{ name: 'W3N1' },
		],
	});
}

// An actor at (25,25) in p1's room with two targets placed by `place` beside it.
function pair(actorBody: string[], place: (shard: ShardFixture, pos: [number, number]) => Promise<string>,
	positions: [[number, number], [number, number]] = [[24, 24], [26, 26]], store?: Record<string, number>): OrderScenario['setup'] {
	return async shard => {
		await world(shard);
		const actor = await shard.placeCreep('W1N1', { pos: [25, 25], owner: 'p1', body: actorBody, store });
		const [a, b] = [await place(shard, positions[0]), await place(shard, positions[1])];
		await shard.tick();
		return { actor, a, b };
	};
}

// Two friendly creeps, each damaged by a hostile beside it, for the heals to mend.
function damaged(positions: [[number, number], [number, number]], attackers: [[number, number], [number, number]]): OrderScenario['setup'] {
	return async shard => {
		await world(shard);
		const actor = await shard.placeCreep('W1N1', { pos: [25, 25], owner: 'p1', body: [HEAL, MOVE] });
		const targets = [];
		for (const [i, pos] of positions.entries()) {
			targets.push(await shard.placeCreep('W1N1', { pos, owner: 'p1', body: [MOVE, MOVE] }));
			const attacker = await shard.placeCreep('W1N1', { pos: attackers[i], owner: 'p2', body: [ATTACK, MOVE] });
			await shard.tick();
			await shard.runPlayer('p2', code`Game.getObjectById(${attacker}).attack(Game.getObjectById(${targets[i]}))`);
		}
		return { actor, a: targets[0], b: targets[1] };
	};
}

// An actor beside a room's controller at (1,1).
function atController(room: string, actorBody: string[], store?: Record<string, number>): OrderScenario['setup'] {
	return async shard => {
		await world(shard);
		const actor = await shard.placeCreep(room, { pos: [2, 2], owner: 'p1', body: actorBody, store });
		await shard.tick();
		return { actor, a: 'first', b: 'second' };
	};
}

const hostile = (shard: ShardFixture, pos: [number, number]) => shard.placeCreep('W1N1', { pos, owner: 'p2', body: [TOUGH, MOVE] });
const container = (energy: number) => (shard: ShardFixture, pos: [number, number]) =>
	shard.placeStructure('W1N1', { pos, structureType: STRUCTURE_CONTAINER, hits: 1000, store: { [RESOURCE_ENERGY]: energy } });

const scenarios: Record<IntentOrderMethod, OrderScenario> = {
	move: {
		call: 'value', state: 'at',
		async setup(shard) {
			await world(shard);
			const actor = await shard.placeCreep('W1N1', { pos: [25, 25], owner: 'p1', body: [MOVE] });
			await shard.tick();
			return { actor, a: { value: TOP, x: 25, y: 24 }, b: { value: BOTTOM, x: 25, y: 26 } };
		},
	},
	pull: {
		// The actor steps right; a pulled creep with no MOVE part follows it into (25,25).
		call: 'object', state: 'pos',
		async setup(shard) {
			await world(shard);
			const actor = await shard.placeCreep('W1N1', { pos: [25, 25], owner: 'p1', body: [MOVE] });
			const a = await shard.placeCreep('W1N1', { pos: [25, 26], owner: 'p1', body: [WORK] });
			const b = await shard.placeCreep('W1N1', { pos: [24, 25], owner: 'p1', body: [WORK] });
			await shard.tick();
			return { actor, a, b, followers: [a, b], actorMove: RIGHT };
		},
	},
	attack: { call: 'object', state: 'hits', setup: pair([ATTACK, MOVE], hostile, [[25, 26], [26, 26]]) },
	rangedAttack: { call: 'object', state: 'hits', setup: pair([RANGED_ATTACK, MOVE], hostile, [[25, 27], [27, 27]]) },
	rangedMassAttack: { call: 'none', state: 'hits', setup: pair([RANGED_ATTACK, MOVE], hostile, [[25, 26], [26, 26]]) },
	heal: { call: 'object', state: 'hits', setup: damaged([[25, 26], [26, 26]], [[24, 27], [27, 27]]) },
	rangedHeal: { call: 'object', state: 'hits', setup: damaged([[25, 27], [27, 27]], [[24, 28], [28, 28]]) },
	harvest: { call: 'object', state: 'energy', setup: pair([WORK, CARRY, MOVE], (shard, pos) => shard.placeSource('W1N1', { pos })) },
	build: {
		call: 'object', state: 'progress',
		setup: pair([WORK, CARRY, MOVE], (shard, pos) => shard.placeSite('W1N1', { pos, owner: 'p1', structureType: STRUCTURE_ROAD }),
			undefined, { [RESOURCE_ENERGY]: 50 }),
	},
	repair: { call: 'object', state: 'hits', setup: pair([WORK, CARRY, MOVE], container(0), undefined, { [RESOURCE_ENERGY]: 50 }) },
	dismantle: {
		call: 'object', state: 'hits',
		setup: pair([WORK, MOVE], (shard, pos) => shard.placeStructure('W1N1', { pos, structureType: STRUCTURE_RAMPART, owner: 'p1', hits: 10000 })),
	},
	transfer: { call: 'energy', state: 'energy', setup: pair([CARRY, MOVE], container(0), undefined, { [RESOURCE_ENERGY]: 50 }) },
	withdraw: { call: 'energy', state: 'energy', setup: pair([CARRY, MOVE], container(100)) },
	pickup: {
		call: 'object', state: 'store',
		async setup(shard) {
			await world(shard);
			const actor = await shard.placeCreep('W1N1', { pos: [25, 25], owner: 'p1', body: [CARRY, MOVE] });
			const pile = (pos: [number, number], resourceType: string) =>
				shard.placeDroppedResource('W1N1', { pos, resourceType, amount: 100 });
			const a = { id: await pile([24, 24], RESOURCE_ENERGY), resource: RESOURCE_ENERGY };
			const b = { id: await pile([26, 26], RESOURCE_HYDROGEN), resource: RESOURCE_HYDROGEN };
			await shard.tick();
			return { actor, a, b };
		},
	},
	drop: {
		call: 'value', state: 'store',
		async setup(shard) {
			await world(shard);
			const actor = await shard.placeCreep('W1N1', {
				pos: [25, 25], owner: 'p1', body: [CARRY, CARRY, MOVE], store: { [RESOURCE_ENERGY]: 50, [RESOURCE_HYDROGEN]: 50 },
			});
			await shard.tick();
			return { actor, a: RESOURCE_ENERGY, b: RESOURCE_HYDROGEN };
		},
	},
	say: { call: 'value', state: 'saying', setup: atController('W1N1', [MOVE]) },
	signController: { call: 'sign', state: 'sign', setup: atController('W1N1', [MOVE]) },
	upgradeController: { call: 'controller', state: 'controller', setup: atController('W1N1', [WORK, CARRY, MOVE], { [RESOURCE_ENERGY]: 50 }) },
	claimController: { call: 'controller', state: 'controller', setup: atController('W3N1', [CLAIM, MOVE]) },
	reserveController: { call: 'controller', state: 'controller', setup: atController('W3N1', [CLAIM, MOVE]) },
	attackController: { call: 'controller', state: 'controller', setup: atController('W2N1', [CLAIM, MOVE]) },
	generateSafeMode: {
		call: 'controller', state: 'controller',
		setup: atController('W1N1', body(SAFE_MODE_COST / 50, CARRY, MOVE), { [RESOURCE_GHODIUM]: SAFE_MODE_COST }),
	},
	suicide: { call: 'none', state: 'alive', setup: atController('W1N1', [MOVE]) },
};

// One tick: read each probe's state, then (for a non-empty `calls`) make the calls, move the followers and
// the actor, and cancel the method's intent when `cancel` is set.
function orderTick(method: string, scenario: OrderScenario, spec: {
	actor: string; calls: unknown[]; probes: unknown[]; cancel: boolean; followers?: string[]; actorMove?: number;
}) {
	return code`
		const S = ${{ method, call: scenario.call, state: scenario.state, ...spec }};
		const actor = Game.getObjectById(S.actor);
		const object = v => Game.getObjectById(typeof v === 'object' ? v.id : v);
		const controller = () => actor.room.controller;
		const read = v => {
			switch (S.state) {
				case 'hits': return object(v).hits;
				case 'progress': return object(v).progress;
				case 'energy': { const o = object(v); return o.store ? o.store[RESOURCE_ENERGY] : o.energy; }
				case 'pos': return [object(v).pos.x, object(v).pos.y];
				case 'at': return actor.pos.x === v.x && actor.pos.y === v.y;
				case 'store': return actor.store[typeof v === 'object' ? v.resource : v];
				case 'saying': return actor.saying === v;
				case 'sign': return !!controller().sign && controller().sign.text === v;
				case 'alive': return actor !== null;
				case 'controller': {
					const c = controller();
					return {
						upgradeController: c.progress,
						claimController: c.my,
						reserveController: c.reservation ? c.reservation.ticksToEnd : null,
						attackController: c.upgradeBlocked ?? null,
						generateSafeMode: c.safeModeAvailable,
					}[S.method];
				}
			}
		};
		const call = v => {
			switch (S.call) {
				case 'object': return actor[S.method](object(v));
				case 'energy': return actor[S.method](object(v), RESOURCE_ENERGY);
				case 'value': return actor[S.method](typeof v === 'object' ? v.value : v);
				case 'controller': return actor[S.method](controller());
				case 'sign': return actor.signController(controller(), v);
				case 'none': return actor[S.method]();
			}
		};
		const states = S.probes.map(read);
		const rcs = S.calls.map(call);
		if (S.calls.length) {
			(S.followers ?? []).forEach(id => Game.getObjectById(id).move(actor));
			if (S.actorMove) actor.move(S.actorMove);
		}
		({ states, rcs, cancel: S.cancel ? actor.cancelOrder(S.method) : null })
	`;
}

type TickResult = { states: PlayerReturnValue[]; rcs: number[]; cancel: number | null };

describe('Intent overwrite and cancel', () => {
	for (const method of intentOverwriteCases) {
		test(`INTENT-CREEP-002:${method} a second same-tick call replaces the first`, async ({ shard }) => {
			const scenario = scenarios[method];
			const { actor, a, b, followers, actorMove } = await scenario.setup(shard);
			const probes = [a, b];
			const calls = await shard.runPlayer('p1', orderTick(method, scenario, { actor, calls: [a, b], probes, cancel: false, followers, actorMove })) as TickResult;
			expect(calls.rcs).toEqual([OK, OK]);
			const after = await shard.runPlayer('p1', orderTick(method, scenario, { actor, calls: [], probes, cancel: false })) as TickResult;
			// The first call's value shows no effect; the second's does.
			expect(after.states[0]).toEqual(calls.states[0]);
			expect(after.states[1]).not.toEqual(calls.states[1]);
		});
	}

	for (const method of intentCancelCases) {
		test(`INTENT-CREEP-003:${method} cancelOrder removes the queued intent`, async ({ shard }) => {
			const scenario = scenarios[method];
			const { actor, a, followers, actorMove } = await scenario.setup(shard);
			const tick = (cancel: boolean, calls: unknown[]) =>
				shard.runPlayer('p1', orderTick(method, scenario, { actor, calls, probes: [a], cancel, followers, actorMove })) as Promise<TickResult>;
			const canceled = await tick(true, [a]);
			expect(canceled.rcs).toEqual([OK]);
			expect(canceled.cancel).toBe(OK);
			// The same call uncanceled on the next tick shows the effect the cancel removed.
			const repeated = await tick(false, [a]);
			expect(repeated.states).toEqual(canceled.states);
			expect(repeated.rcs).toEqual([OK]);
			const after = await tick(false, []);
			expect(after.states).not.toEqual(repeated.states);
		});
	}

	test('INTENT-CREEP-003:notFound cancelOrder returns ERR_NOT_FOUND with nothing queued under the name', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', { pos: [25, 25], owner: 'p1', body: [ATTACK, MOVE] });
		const rc = await shard.runPlayer('p1', code`Game.getObjectById(${creepId}).cancelOrder('attack')`);
		expect(rc).toBe(ERR_NOT_FOUND);
	});

	test('INTENT-CREEP-003:moveTo cancelOrder(\'moveTo\') finds nothing: moveTo queues move', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', { pos: [25, 25], owner: 'p1', body: [MOVE] });
		const result = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			({ moveTo: creep.moveTo(25, 20), cancel: creep.cancelOrder('moveTo') })
		`);
		expect(result).toEqual({ moveTo: OK, cancel: ERR_NOT_FOUND });
		const creep = await shard.expectObject(creepId, 'creep');
		expect([creep.pos.x, creep.pos.y]).toEqual([25, 24]);
	});
});
