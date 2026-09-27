import { describe, test, expect, code,
	OK, MOVE, WORK, CARRY, ATTACK, RANGED_ATTACK, HEAL, CLAIM,
	STRUCTURE_CONTAINER, STRUCTURE_ROAD, STRUCTURE_RAMPART,
	RANGED_ATTACK_POWER, RESOURCE_ENERGY, RESOURCE_SILICON,
} from '../../src/index.js';
import type { ShardFixture } from '../../src/fixture.js';
import { intentCreepPriorityCases } from '../../src/matrices/intent-creep-priority.js';

// One actor with every part a method needs, and room for a harvest.
const ACTOR_BODY = [WORK, CARRY, CARRY, ATTACK, RANGED_ATTACK, HEAL, CLAIM, MOVE];

type Pos = [number, number];

// Where the actor and each method's target stand. `attackController` needs a hostile controller,
// so its pairs run in p2's room around the controller at (1,1); there a source refuses harvest
// (game/creeps.js:358-362), so its harvest target is a deposit.
interface Layout {
	room: string;
	actor: Pos;
	targets: Record<string, Pos>;
	// A p2 attacker beside each heal target, to damage it first.
	attackers: Record<'heal' | 'rangedHeal', Pos>;
}

const home: Layout = {
	room: 'W1N1',
	actor: [25, 25],
	targets: {
		attack: [25, 26], rangedAttack: [26, 26], rangedMassAttack: [24, 26],
		heal: [25, 24], rangedHeal: [23, 23],
		build: [26, 25], repair: [24, 25], dismantle: [26, 24], harvest: [24, 24],
	},
	attackers: { heal: [25, 23], rangedHeal: [22, 22] },
};

const rival: Layout = {
	room: 'W2N1',
	actor: [2, 2],
	targets: {
		attack: [3, 2], heal: [2, 3], rangedHeal: [4, 4],
		build: [3, 1], repair: [1, 3], dismantle: [3, 3], harvest: [1, 2],
	},
	attackers: { heal: [1, 4], rangedHeal: [5, 5] },
};

// Places the method's target in the layout's room; null for the controller, which is already there.
async function placeTarget(shard: ShardFixture, layout: Layout, method: string): Promise<string | null> {
	const pos = layout.targets[method];
	switch (method) {
		case 'attack': case 'rangedAttack': case 'rangedMassAttack':
			return shard.placeCreep(layout.room, { pos, owner: 'p2', body: [MOVE, MOVE, MOVE] });
		case 'heal': case 'rangedHeal':
			return shard.placeCreep(layout.room, { pos, owner: 'p1', body: [MOVE, MOVE, MOVE, MOVE] });
		case 'build':
			return shard.placeSite(layout.room, { pos, owner: 'p1', structureType: STRUCTURE_ROAD });
		case 'repair':
			return shard.placeStructure(layout.room, { pos, structureType: STRUCTURE_CONTAINER, hits: 1000 });
		case 'dismantle':
			return shard.placeStructure(layout.room, { pos, structureType: STRUCTURE_RAMPART, owner: layout === home ? 'p1' : 'p2', hits: 10000 });
		case 'harvest':
			return layout === home
				? shard.placeSource(layout.room, { pos })
				: shard.placeObject(layout.room, 'deposit', { pos, depositType: RESOURCE_SILICON });
		case 'attackController':
			return null;
		default:
			throw new Error(`no target for ${method}`);
	}
}

describe('Intent creep priority', () => {
	for (const { blocker, blocked } of intentCreepPriorityCases) {
		test(`INTENT-CREEP-001:${blocker}Blocks${blocked[0].toUpperCase()}${blocked.slice(1)} ${blocker} blocks ${blocked}`, async ({ shard }) => {
			const layout = blocker === 'attackController' || blocked === 'attackController' ? rival : home;
			if (layout === rival && blocked === 'harvest') shard.requires('deposit');
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [
					{ name: 'W1N1', rcl: 1, owner: 'p1' },
					{ name: 'W2N1', rcl: 1, owner: 'p2' },
				],
			});
			const actorId = await shard.placeCreep(layout.room, {
				pos: layout.actor, owner: 'p1', body: ACTOR_BODY, store: { [RESOURCE_ENERGY]: 50 },
			});
			const blockerId = await placeTarget(shard, layout, blocker);
			const blockedId = await placeTarget(shard, layout, blocked);

			// A heal needs a damaged target.
			const isHeal = (method: string): method is 'heal' | 'rangedHeal' => method === 'heal' || method === 'rangedHeal';
			const healed = [blocker, blocked].flatMap((method, i) => isHeal(method) ? [{ method, id: [blockerId, blockedId][i]! }] : []);
			const attackerIds: string[] = [];
			for (const { method } of healed) {
				attackerIds.push(await shard.placeCreep(layout.room, { pos: layout.attackers[method], owner: 'p2', body: [ATTACK, MOVE] }));
			}
			await shard.tick();
			if (healed.length > 0) {
				await shard.runPlayer('p2', code`
					${healed.map(({ id }, i) => [attackerIds[i], id])}.forEach(([attacker, target]) =>
						Game.getObjectById(attacker).attack(Game.getObjectById(target)))
				`);
			}

			// What each method changes: hits, a site's progress, a source's energy, the actor's deposit
			// harvest, or the controller's upgradeBlocked. Read at the start of the calls' tick, then after it.
			const pairTick = (callBoth: boolean) => code`
				const actor = Game.getObjectById(${actorId});
				const state = (method, id) => {
					if (method === 'attackController') return actor.room.controller.upgradeBlocked ?? null;
					if (method === 'harvest' && ${layout === rival}) return actor.store[RESOURCE_SILICON];
					const target = Game.getObjectById(id);
					return method === 'build' ? target.progress : method === 'harvest' ? target.energy : target.hits;
				};
				const call = (method, id) => method === 'rangedMassAttack' ? actor.rangedMassAttack()
					: actor[method](method === 'attackController' ? actor.room.controller : Game.getObjectById(id));
				({
					states: [state(${blocker}, ${blockerId}), state(${blocked}, ${blockedId})],
					rcs: ${callBoth} ? [call(${blocker}, ${blockerId}), call(${blocked}, ${blockedId})] : null,
				})
			`;
			const calls = await shard.runPlayer('p1', pairTick(true)) as { states: unknown[]; rcs: number[] };
			expect(calls.rcs).toEqual([OK, OK]);
			const [before, after] = [calls.states, (await shard.runPlayer('p1', pairTick(false)) as { states: unknown[] }).states];

			// The blocker's own effect landed; the blocked method's target is untouched, but for the mass
			// attack's splash on a rangedAttack target beside the actor.
			expect(after[0]).not.toEqual(before[0]);
			const splash = blocker === 'rangedMassAttack' && blocked === 'rangedAttack' ? RANGED_ATTACK_POWER : 0;
			expect(after[1]).toEqual(typeof before[1] === 'number' ? before[1] - splash : before[1]);
		});
	}
});
