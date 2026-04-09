import { describe, test, expect, code,
	OK, MOVE, WORK, CARRY, ATTACK, RANGED_ATTACK, HEAL, CLAIM,
	STRUCTURE_CONTAINER, STRUCTURE_ROAD, STRUCTURE_RAMPART,
	BODYPART_HITS, RANGED_ATTACK_POWER,
} from '../../src/index.js';
import { intentCreepPriorityCases } from '../support/matrices/intent-creep-priority.js';

// All body parts needed for the universal test creep.
const allParts = [WORK, CARRY, ATTACK, RANGED_ATTACK, HEAL, CLAIM, MOVE];

// Filter out attackController — requires hostile room with specific setup.
const feasibleCases = intentCreepPriorityCases.filter(
	c => c.blocker !== 'attackController' && c.blocked !== 'attackController',
);

// Each method gets its own unique target to avoid blocker/blocked interference.
// Positions are arranged around the creep at [25,25].
// Adjacent (range 1): [25,26], [26,25], [24,25], [25,24], [26,26], [24,26], [26,24], [24,24]

describe('Intent creep priority', () => {
	for (const { blocker, blocked } of feasibleCases) {
		test(`INTENT-CREEP-001:${blocker}>${blocked} ${blocker} blocks ${blocked}`, async ({ shard }) => {
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [
					{ name: 'W1N1', rcl: 1, owner: 'p1' },
					{ name: 'W2N1', rcl: 1, owner: 'p2' },
				],
			});

			// Universal creep at center with all body parts.
			const creepId = await shard.placeCreep('W1N1', {
				pos: [25, 25], owner: 'p1',
				body: allParts,
				store: { energy: 50 }, // matches carry capacity
			});

			// Create per-method targets. Each method gets its own target ID.
			const targetIds: Record<string, string> = {};

			// Hostile creeps for combat methods — each at unique position.
			if (needsMethod([blocker, blocked], 'attack')) {
				targetIds.attack = await shard.placeCreep('W1N1', {
					pos: [25, 26], owner: 'p2', body: [MOVE, MOVE, MOVE],
				});
			}
			if (needsMethod([blocker, blocked], 'rangedAttack')) {
				targetIds.rangedAttack = await shard.placeCreep('W1N1', {
					pos: [26, 26], owner: 'p2', body: [MOVE, MOVE, MOVE],
				});
			}
			if (needsMethod([blocker, blocked], 'rangedMassAttack')) {
				// rangedMassAttack has no target arg but we need a hostile in range
				// to verify damage. Use a separate hostile at unique position.
				targetIds.rangedMassAttack = await shard.placeCreep('W1N1', {
					pos: [24, 26], owner: 'p2', body: [MOVE, MOVE, MOVE],
				});
			}

			// Friendly creeps for heal methods — must be damaged.
			const friendlyIds: string[] = [];
			if (needsMethod([blocker, blocked], 'heal')) {
				targetIds.heal = await shard.placeCreep('W1N1', {
					pos: [25, 24], owner: 'p1', body: [MOVE, MOVE, MOVE, MOVE],
				});
				friendlyIds.push(targetIds.heal);
			}
			if (needsMethod([blocker, blocked], 'rangedHeal')) {
				targetIds.rangedHeal = await shard.placeCreep('W1N1', {
					pos: [24, 24], owner: 'p1', body: [MOVE, MOVE, MOVE, MOVE],
				});
				friendlyIds.push(targetIds.rangedHeal);
			}

			// Construction site for build.
			if (needsMethod([blocker, blocked], 'build')) {
				targetIds.build = await shard.placeSite('W1N1', {
					pos: [26, 25], owner: 'p1', structureType: STRUCTURE_ROAD,
				});
			}

			// Damaged structure for repair.
			if (needsMethod([blocker, blocked], 'repair')) {
				targetIds.repair = await shard.placeStructure('W1N1', {
					pos: [24, 25], structureType: STRUCTURE_CONTAINER,
					hits: 1000, ticksToDecay: 1000,
				});
			}

			// Structure for dismantle.
			if (needsMethod([blocker, blocked], 'dismantle')) {
				targetIds.dismantle = await shard.placeStructure('W1N1', {
					pos: [26, 24], structureType: STRUCTURE_RAMPART,
					owner: 'p1', hits: 10000,
				});
			}

			// Source for harvest.
			if (needsMethod([blocker, blocked], 'harvest')) {
				targetIds.harvest = await shard.placeSource('W1N1', {
					pos: [24, 25], energy: 3000, energyCapacity: 3000,
				});
			}

			// Damage friendly creeps so heal/rangedHeal has observable effect.
			if (friendlyIds.length > 0) {
				const attackerPositions: [number, number][] = [[25, 23], [24, 23]];
				const attackerIds: string[] = [];
				for (let i = 0; i < friendlyIds.length; i++) {
					attackerIds.push(await shard.placeCreep('W1N1', {
						pos: attackerPositions[i], owner: 'p2', body: [ATTACK, MOVE],
					}));
				}
				await shard.tick();
				// Attack each friendly to damage it.
				for (let i = 0; i < friendlyIds.length; i++) {
					await shard.runPlayer('p2', code`
						Game.getObjectById(${attackerIds[i]}).attack(Game.getObjectById(${friendlyIds[i]}))
					`);
				}
				await shard.tick();
			} else {
				await shard.tick();
			}

			// Snapshot the BLOCKED method's target before the dual-intent tick.
			const blockedBefore = await getTargetState(shard, blocked, targetIds);

			// Issue both intents using bracket notation for dynamic dispatch.
			const result = await shard.runPlayer('p1', code`
				const creep = Game.getObjectById(${creepId});
				const targets = {
					attack: Game.getObjectById(${targetIds.attack ?? null}),
					rangedAttack: Game.getObjectById(${targetIds.rangedAttack ?? null}),
					heal: Game.getObjectById(${targetIds.heal ?? null}),
					rangedHeal: Game.getObjectById(${targetIds.rangedHeal ?? null}),
					build: Game.getObjectById(${targetIds.build ?? null}),
					repair: Game.getObjectById(${targetIds.repair ?? null}),
					dismantle: Game.getObjectById(${targetIds.dismantle ?? null}),
					harvest: Game.getObjectById(${targetIds.harvest ?? null}),
				};
				const noArgMethods = { rangedMassAttack: true };
				const blockerM = ${blocker};
				const blockedM = ${blocked};
				const blockerRc = noArgMethods[blockerM]
					? creep[blockerM]()
					: creep[blockerM](targets[blockerM]);
				const blockedRc = noArgMethods[blockedM]
					? creep[blockedM]()
					: creep[blockedM](targets[blockedM]);
				({ blockerRc, blockedRc })
			`) as { blockerRc: number; blockedRc: number };

			expect(result.blockerRc).toBe(OK);
			expect(result.blockedRc).toBe(OK);

			await shard.tick();

			// Verify the blocked method's own target is unchanged.
			// Special case: rangedMassAttack is an AoE — it also hits the
			// rangedAttack target (both in range 3). Account for blocker's AoE.
			const blockedAfter = await getTargetState(shard, blocked, targetIds);
			if (blocker === 'rangedMassAttack' && blocked === 'rangedAttack') {
				// rangedAttack target took AoE damage from blocker at range 1 = RANGED_ATTACK_POWER.
				// If rangedAttack also executed, it would deal an ADDITIONAL RANGED_ATTACK_POWER.
				expect(blockedAfter.hp).toBe(blockedBefore.hp! - RANGED_ATTACK_POWER);
			} else {
				expectStateUnchanged(blocked, blockedBefore, blockedAfter);
			}
		});
	}
});

// ── Helpers ──────────────────────────────────────────────────

function needsMethod(methods: string[], method: string): boolean {
	return methods.includes(method);
}

interface TargetState {
	hp?: number;
	progress?: number;
	sourceEnergy?: number;
}

async function getTargetState(
	shard: any,
	method: string,
	targetIds: Record<string, string>,
): Promise<TargetState> {
	const state: TargetState = {};
	const id = targetIds[method];

	if (method === 'attack' || method === 'rangedAttack') {
		if (id) {
			const c = await shard.expectObject(id, 'creep');
			state.hp = c.hits;
		}
	} else if (method === 'rangedMassAttack') {
		// rangedMassAttack's target is the dedicated hostile creep.
		if (id) {
			const c = await shard.expectObject(id, 'creep');
			state.hp = c.hits;
		}
	} else if (method === 'heal' || method === 'rangedHeal') {
		if (id) {
			const c = await shard.expectObject(id, 'creep');
			state.hp = c.hits;
		}
	} else if (method === 'build') {
		if (id) {
			const s = await shard.getObject(id);
			state.progress = s?.kind === 'site' ? s.progress : 0;
		}
	} else if (method === 'repair') {
		if (id) {
			const s = await shard.expectStructure(id, STRUCTURE_CONTAINER);
			state.hp = s.hits;
		}
	} else if (method === 'dismantle') {
		if (id) {
			const s = await shard.expectStructure(id, STRUCTURE_RAMPART);
			state.hp = s.hits;
		}
	} else if (method === 'harvest') {
		// Track source energy: harvest drains it.
		if (id) {
			const s = await shard.expectObject(id, 'source');
			state.sourceEnergy = s.energy;
		}
	}

	return state;
}

function expectStateUnchanged(
	method: string,
	before: TargetState,
	after: TargetState,
): void {
	if (method === 'harvest') {
		expect(after.sourceEnergy).toBe(before.sourceEnergy);
	} else if (method === 'build') {
		expect(after.progress).toBe(before.progress);
	} else {
		expect(after.hp).toBe(before.hp);
	}
}
