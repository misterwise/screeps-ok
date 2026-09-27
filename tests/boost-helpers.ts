import { expect } from 'vitest';
import type { ShardFixture } from '../src/fixture.js';
import type { BoostMechanic } from '../src/matrices/boost-tables.js';
import {
	body, code, OK, FIND_STRUCTURES, LEFT,
	ATTACK, CARRY, MOVE, WORK,
	STRUCTURE_CONTROLLER, STRUCTURE_LAB, STRUCTURE_ROAD, STRUCTURE_WALL,
	ATTACK_POWER, BODYPART_HITS, BUILD_POWER, CARRY_CAPACITY, DISMANTLE_POWER, HARVEST_POWER, HEAL_POWER,
	LAB_BOOST_MINERAL, LAB_ENERGY_CAPACITY, RANGED_ATTACK_DISTANCE_RATE, RANGED_ATTACK_POWER, RANGED_HEAL_POWER,
	REPAIR_POWER, SOURCE_ENERGY_CAPACITY, UPGRADE_CONTROLLER_POWER, WALL_HITS, WALL_HITS_MAX,
} from '../src/index.js';
import type { ControllerSnapshot } from '../src/index.js';

export interface BoostedBody {
	mechanic: BoostMechanic;
	bodyPart: string;
	compound: string;
	boosted: number;
	unboosted: number;
}

export interface BoostedOutcome {
	effect: number;
	// Energy the creep spent, for the mechanics that spend it.
	energySpent?: number;
}

// Plains fatigue per weighted part, and fatigue each MOVE part removes a tick
// (movement.js:204-239, creeps/tick.js:105-107).
const FATIGUE_PER_PART = 2;
const FATIGUE_RIG_WORK_PARTS = 6;
const TARGET_PARTS = 10;

const basePower: Record<BoostMechanic, number> = {
	attack: ATTACK_POWER,
	rangedAttack: RANGED_ATTACK_POWER,
	rangedMassAttack: RANGED_ATTACK_POWER * RANGED_ATTACK_DISTANCE_RATE[1],
	heal: HEAL_POWER,
	rangedHeal: RANGED_HEAL_POWER,
	damage: ATTACK_POWER,
	harvest: HARVEST_POWER,
	build: BUILD_POWER,
	repair: REPAIR_POWER,
	dismantle: DISMANTLE_POWER,
	upgradeController: UPGRADE_CONTROLLER_POWER,
	fatigue: FATIGUE_PER_PART,
	capacity: CARRY_CAPACITY,
};

// Each part adds its base power times its multiplier; build, repair and
// upgradeController floor the sum (build.js:78, repair.js:38,
// upgradeController.js:53). `damage` is the hits one boosted TOUGH part loses
// to one ATTACK part: damage it absorbs is scaled by the multiplier, and the
// reduction rounds (creeps/tick.js:7-28).
export function expectedBoostedEffect(parts: BoostedBody & { multiplier: number }): number {
	const { mechanic, multiplier, boosted, unboosted } = parts;
	if (mechanic === 'damage') {
		if (boosted !== 1 || unboosted !== 0) throw new Error('expectedBoostedEffect: damage takes one boosted TOUGH part');
		return ATTACK_POWER - Math.round(Math.min(ATTACK_POWER, BODYPART_HITS / multiplier) * (1 - multiplier));
	}
	return Math.floor(basePower[mechanic] * (unboosted + boosted * multiplier));
}

// Runs the mechanic once for a p1 creep whose first `boosted` parts of
// `bodyPart` carry `compound` (placed boosted; carry capacity boosts through a
// lab, since the engine derives capacity when it boosts) and returns what the
// action did on its tick.
export async function measureBoostedEffect(shard: ShardFixture, parts: BoostedBody): Promise<BoostedOutcome> {
	const { mechanic, bodyPart, compound, boosted, unboosted } = parts;
	await shard.createShard({
		players: ['p1', 'p2'],
		rooms: [
			{ name: 'W1N1', rcl: 6, owner: 'p1' },
			{ name: 'W2N1', rcl: 1, owner: 'p2' },
		],
	});
	const mechanicParts: string[] = Array.from({ length: boosted + unboosted }, () => bodyPart);
	const boosts = Object.fromEntries(Array.from({ length: boosted }, (_, index) => [index, compound]));
	const placeActor = (extra: string[], options: { pos?: [number, number]; store?: Record<string, number> } = {}) =>
		shard.placeCreep('W1N1', {
			pos: options.pos ?? [25, 25], owner: 'p1', body: [...mechanicParts, ...extra], boosts, store: options.store,
		});

	switch (mechanic) {
		case 'attack':
		case 'rangedAttack':
		case 'rangedMassAttack': {
			const actorId = await placeActor([MOVE]);
			const targetId = await shard.placeCreep('W1N1', {
				pos: mechanic === 'rangedAttack' ? [28, 25] : [26, 25], owner: 'p2', body: body(TARGET_PARTS, MOVE),
			});
			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${actorId})[${mechanic}](Game.getObjectById(${targetId}))
			`);
			expect(rc).toBe(OK);
			const target = await shard.expectObject(targetId, 'creep');
			return { effect: TARGET_PARTS * BODYPART_HITS - target.hits };
		}
		case 'heal':
		case 'rangedHeal': {
			const actorId = await placeActor([MOVE]);
			const targetX = mechanic === 'heal' ? 26 : 28;
			const targetId = await shard.placeCreep('W1N1', {
				pos: [targetX, 25], owner: 'p1', body: body(TARGET_PARTS, MOVE),
			});
			const attackerId = await shard.placeCreep('W1N1', {
				pos: [targetX + 1, 25], owner: 'p2', body: body(3, ATTACK, MOVE),
			});
			const attackRc = await shard.runPlayer('p2', code`
				Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
			`);
			expect(attackRc).toBe(OK);
			const injured = await shard.expectObject(targetId, 'creep');
			expect(injured.hits).toBe(TARGET_PARTS * BODYPART_HITS - 3 * ATTACK_POWER);
			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${actorId})[${mechanic}](Game.getObjectById(${targetId}))
			`);
			expect(rc).toBe(OK);
			const healed = await shard.expectObject(targetId, 'creep');
			return { effect: healed.hits - injured.hits };
		}
		case 'damage': {
			const actorId = await placeActor([MOVE]);
			const attackerId = await shard.placeCreep('W1N1', {
				pos: [26, 25], owner: 'p2', body: [ATTACK, MOVE],
			});
			const rc = await shard.runPlayer('p2', code`
				Game.getObjectById(${attackerId}).attack(Game.getObjectById(${actorId}))
			`);
			expect(rc).toBe(OK);
			const actor = await shard.expectObject(actorId, 'creep');
			return { effect: (mechanicParts.length + 1) * BODYPART_HITS - actor.hits };
		}
		case 'harvest': {
			const actorId = await placeActor([CARRY, MOVE]);
			const sourceId = await shard.placeSource('W1N1', {
				pos: [26, 25], energy: SOURCE_ENERGY_CAPACITY, energyCapacity: SOURCE_ENERGY_CAPACITY,
			});
			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${actorId}).harvest(Game.getObjectById(${sourceId}))
			`);
			expect(rc).toBe(OK);
			const actor = await shard.expectObject(actorId, 'creep');
			return { effect: actor.store.energy };
		}
		case 'build': {
			const actorId = await placeActor([CARRY, MOVE], { store: { energy: CARRY_CAPACITY } });
			const siteId = await shard.placeSite('W1N1', {
				pos: [26, 25], owner: 'p1', structureType: STRUCTURE_ROAD,
			});
			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${actorId}).build(Game.getObjectById(${siteId}))
			`);
			expect(rc).toBe(OK);
			const site = await shard.expectObject(siteId, 'site');
			const actor = await shard.expectObject(actorId, 'creep');
			return { effect: site.progress, energySpent: CARRY_CAPACITY - actor.store.energy };
		}
		case 'repair':
		case 'dismantle': {
			const actorId = await placeActor([CARRY, MOVE], { store: { energy: CARRY_CAPACITY } });
			const placedHits = mechanic === 'repair' ? WALL_HITS : WALL_HITS_MAX;
			const wallId = await shard.placeStructure('W1N1', {
				pos: [26, 25], structureType: STRUCTURE_WALL, hits: placedHits,
			});
			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${actorId})[${mechanic}](Game.getObjectById(${wallId}))
			`);
			expect(rc).toBe(OK);
			const wall = await shard.expectStructure(wallId, STRUCTURE_WALL);
			if (mechanic === 'dismantle') return { effect: placedHits - wall.hits! };
			const actor = await shard.expectObject(actorId, 'creep');
			return { effect: wall.hits! - placedHits, energySpent: CARRY_CAPACITY - actor.store.energy };
		}
		case 'upgradeController': {
			const ctrl = (await shard.getControllerPos('W1N1'))!;
			const actorId = await placeActor([CARRY, MOVE], {
				pos: [ctrl.x + 1, ctrl.y + 1], store: { energy: CARRY_CAPACITY },
			});
			const before = await controllerProgress(shard);
			const rc = await shard.runPlayer('p1', code`
				const creep = Game.getObjectById(${actorId});
				creep.upgradeController(creep.room.controller)
			`);
			expect(rc).toBe(OK);
			const actor = await shard.expectObject(actorId, 'creep');
			return { effect: await controllerProgress(shard) - before, energySpent: CARRY_CAPACITY - actor.store.energy };
		}
		case 'fatigue': {
			const actorId = await placeActor(body(FATIGUE_RIG_WORK_PARTS, WORK));
			const rc = await shard.runPlayer('p1', code`Game.getObjectById(${actorId}).move(LEFT)`);
			expect(rc).toBe(OK);
			const actor = await shard.expectObject(actorId, 'creep');
			expect(actor.pos.x).toBe(24);
			return { effect: FATIGUE_PER_PART * FATIGUE_RIG_WORK_PARTS - actor.fatigue };
		}
		case 'capacity': {
			const actorId = await shard.placeCreep('W1N1', {
				pos: [25, 25], owner: 'p1', body: [...mechanicParts, MOVE],
			});
			const labId = await shard.placeStructure('W1N1', {
				pos: [26, 25], structureType: STRUCTURE_LAB, owner: 'p1',
				store: { energy: LAB_ENERGY_CAPACITY, [compound]: LAB_BOOST_MINERAL * boosted },
			});
			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${labId}).boostCreep(Game.getObjectById(${actorId}), ${boosted})
			`);
			expect(rc).toBe(OK);
			const actor = await shard.expectObject(actorId, 'creep');
			return { effect: actor.storeCapacity! };
		}
	}
}

async function controllerProgress(shard: ShardFixture): Promise<number> {
	const controller = (await shard.findInRoom('W1N1', FIND_STRUCTURES))
		.find((s): s is ControllerSnapshot => s.structureType === STRUCTURE_CONTROLLER)!;
	return controller.progress!;
}
