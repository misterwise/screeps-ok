import { describe, test, expect, code, body,
	OK,
	CARRY, MOVE,
	FIND_CREEPS, FIND_DROPPED_RESOURCES,
	RESOURCE_ENERGY, RESOURCE_HYDROGEN, RESOURCE_POWER,
	STRUCTURE_CONTAINER, STRUCTURE_RAMPART, STRUCTURE_SPAWN, STRUCTURE_TERMINAL,
	STRUCTURE_LAB, STRUCTURE_NUKER, STRUCTURE_TOWER,
	CARRY_CAPACITY, ENERGY_DECAY,
	PWR_DISRUPT_TERMINAL,
	SAFE_MODE_DURATION,
} from '../../src/index.js';
import { dropValidationCases } from '../../src/matrices/drop-validation.js';
import { pickupValidationCases } from '../../src/matrices/pickup-validation.js';
import { withdrawValidationCases } from '../../src/matrices/withdraw-validation.js';
import { staleArgumentCases } from '../../src/matrices/stale-argument.js';
import { expectStaleArgumentRejected, spawnBusyCreep } from '../intent-validation-helpers.js';

const staleWithdrawStructureCase = staleArgumentCases.find(row => row.key === 'creepWithdrawStructure')!;
const stalePickupCase = staleArgumentCases.find(row => row.key === 'creepPickup')!;

describe('creep.withdraw()', () => {
	test('WITHDRAW-001 withdraws energy from container', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
		});
		const containerId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_CONTAINER,
			store: { energy: 500 },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).withdraw(Game.getObjectById(${containerId}), RESOURCE_ENERGY)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store.energy).toBe(CARRY_CAPACITY);
	});

	test('WITHDRAW-002 withdraws partial amount', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
		});
		const containerId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_CONTAINER,
			store: { energy: 500 },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).withdraw(Game.getObjectById(${containerId}), RESOURCE_ENERGY, 10)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store.energy).toBe(10);
	});

	test('WITHDRAW-006 withdraw() works on tombstones and ruins', async ({ shard }) => {
		// Engine creeps.js:511-512 — tombstones and ruins are explicitly
		// allowed withdraw targets alongside structures.
		await shard.ownedRoom('p1');
		const tombstoneId = await shard.placeTombstone('W1N1', {
			pos: [25, 26],
			creepName: 'fallen',
			store: { energy: 40 },
			ticksToDecay: 100,
		});
		const ruinId = await shard.placeRuin('W1N1', {
			pos: [24, 25],
			structureType: STRUCTURE_CONTAINER,
			store: { energy: 60 },
			ticksToDecay: 200,
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: body(3, CARRY, MOVE),
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			({
				tombstoneRc: creep.withdraw(Game.getObjectById(${tombstoneId}), RESOURCE_ENERGY, 40),
				ruinRc: creep.withdraw(Game.getObjectById(${ruinId}), RESOURCE_ENERGY, 60),
			})
		`) as { tombstoneRc: number; ruinRc: number };

		// The first intent in a tick should succeed. Withdraw intents against
		// two different sources in the same tick are legal — assert both validate.
		expect(result.tombstoneRc).toBe(OK);
		expect(result.ruinRc).toBe(OK);
	});

	test('WITHDRAW-015 withdrawing last mineral from lab clears mineral slot', async ({ shard }) => {
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);
		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { H: 10 },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).withdraw(Game.getObjectById(${labId}), RESOURCE_HYDROGEN, 10)
		`);
		expect(rc).toBe(OK);

		const lab = await shard.expectStructure(labId, STRUCTURE_LAB);
		expect((lab.store as Record<string, number>).H ?? 0).toBe(0);
		expect(lab.mineralType).toBeNull();
	});

	for (const row of withdrawValidationCases) {
		test(`WITHDRAW-017:${row.label} withdraw() validation returns the canonical code`, async ({ shard }) => {
			const blockers = shard.validationBlockers(row);
			if (blockers.has('invalid-nuker')) shard.requires('nuke');
			if (blockers.has('invalid-power-bank')) shard.requires('powerBank');
			const disrupted = blockers.has('disrupted-terminal');
			if (disrupted) {
				shard.requires('powerCreeps');
				shard.requires('powerEffects');
			}
			const owner = blockers.has('not-owner') ? 'p2' : 'p1';
			const needsSecondPlayer = owner === 'p2' || blockers.has('target-not-owner') || blockers.has('safemode-not-owner');
			const roomOwner = blockers.has('safemode-not-owner') || owner === 'p2' && blockers.has('busy') ? 'p2' : 'p1';
			await shard.createShard({
				players: needsSecondPlayer ? ['p1', 'p2'] : ['p1'],
				rooms: [{
					name: 'W1N1',
					rcl: disrupted ? 8 : 3,
					owner: roomOwner,
					...(disrupted ? { powerEnabled: true } : {}),
					...(blockers.has('safemode-not-owner') ? { safeMode: SAFE_MODE_DURATION } : {}),
				}],
			});
			if (owner === 'p2' && !blockers.has('busy')) {
				await shard.placeCreep('W1N1', { pos: [20, 20], owner: 'p1', body: [MOVE] });
			}

			const creepId = blockers.has('busy')
				? await spawnBusyCreep(shard, {
					owner,
					observerOwner: owner === 'p2' ? 'p1' : undefined,
					// A spawning creep holds nothing, so only a body without CARRY is full.
					// Outlasts the disrupt setup's three ticks.
					body: blockers.has('full') ? [MOVE] : disrupted ? body(3, CARRY, MOVE) : [CARRY, MOVE],
				})
				: await shard.placeCreep('W1N1', {
					pos: [25, 25],
					owner,
					body: [CARRY, MOVE],
					store: blockers.has('full') ? { energy: CARRY_CAPACITY }
						: blockers.has('full-amount') ? { energy: CARRY_CAPACITY - 10 }
						: {},
				});
			const targetPos: [number, number] = blockers.has('range') ? [30, 30] : [25, 26];
			let targetId: string;
			if (blockers.has('invalid-target')) {
				targetId = await shard.placeCreep('W1N1', {
					pos: targetPos,
					owner: blockers.has('target-not-owner') ? 'p2' : 'p1',
					body: [CARRY, MOVE],
					store: blockers.has('not-enough') ? {} : { energy: 50 },
				});
			} else if (disrupted) {
				targetId = await shard.placeStructure('W1N1', {
					pos: targetPos,
					structureType: STRUCTURE_TERMINAL,
					owner: blockers.has('target-not-owner') ? 'p2' : 'p1',
					store: blockers.has('not-enough') ? {} : { energy: 500 },
				});
			} else if (blockers.has('invalid-power-bank')) {
				targetId = await shard.placeObject('W1N1', 'powerBank', { pos: targetPos, power: 1000 });
			} else if (blockers.has('target-not-owner')) {
				targetId = await shard.placeStructure('W1N1', {
					pos: targetPos,
					structureType: blockers.has('invalid-nuker') ? STRUCTURE_NUKER : STRUCTURE_SPAWN,
					owner: 'p2',
					store: blockers.has('not-enough') ? {} : { energy: 300 },
				});
			} else if (blockers.has('invalid-nuker')) {
				targetId = await shard.placeStructure('W1N1', {
					pos: targetPos,
					structureType: STRUCTURE_NUKER,
					owner: 'p1',
					store: blockers.has('not-enough') ? {} : { energy: 500 },
				});
			} else if (blockers.has('invalid-capacity')) {
				targetId = await shard.placeStructure('W1N1', { pos: targetPos, structureType: STRUCTURE_SPAWN, owner: 'p1', store: { energy: 300 } });
			} else {
				targetId = await shard.placeStructure('W1N1', {
					pos: targetPos,
					structureType: STRUCTURE_CONTAINER,
					store: blockers.has('not-enough') ? {} : { energy: 500 },
				});
			}
			if (blockers.has('target-not-owner')) {
				await shard.placeStructure('W1N1', {
					pos: targetPos,
					structureType: STRUCTURE_RAMPART,
					owner: 'p2',
				});
			}
			if (disrupted) {
				await shard.placePowerCreep('W1N1', {
					pos: [20, 25], owner: 'p1',
					powers: { [PWR_DISRUPT_TERMINAL]: 1 },
					store: { ops: 100 },
				});
				await shard.tick();
				const castRc = await shard.runPlayer('p1', code`
					Object.values(Game.powerCreeps)[0].usePower(PWR_DISRUPT_TERMINAL, Game.getObjectById(${targetId}))
				`);
				expect(castRc).toBe(OK);
				await shard.tick();
			}

			// A power bank holds power; asked for energy it also holds too little.
			const resource = blockers.has('invalid-resource') ? 'not_a_resource'
				: blockers.has('invalid-capacity') ? RESOURCE_HYDROGEN
				: blockers.has('invalid-power-bank') && !blockers.has('not-enough') ? RESOURCE_POWER
				: RESOURCE_ENERGY;
			const amount = blockers.has('invalid-args') ? -1 : blockers.has('full-amount') ? 20 : undefined;
			const rc = amount === undefined
				? await shard.runPlayer('p1', code`
					Game.getObjectById(${creepId}).withdraw(Game.getObjectById(${targetId}), ${resource})
				`)
				: await shard.runPlayer('p1', code`
					Game.getObjectById(${creepId}).withdraw(Game.getObjectById(${targetId}), ${resource}, ${amount})
				`);
			expect(rc).toBe(row.expectedRc);
		});
	}

	test(`${staleWithdrawStructureCase.catalogId}:${staleWithdrawStructureCase.label} creep.withdraw() rejects a stale cached Structure target`, async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 3);
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
		});
		const towerId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_TOWER, owner: 'p1',
			store: { energy: 100 },
		});
		await shard.tick();

		const rc1 = await shard.runPlayer('p1', code`
			globalThis.__screepsOkStaleArgWithdrawTower = Game.getObjectById(${towerId});
			globalThis.__screepsOkStaleArgWithdrawTower.destroy()
		`);
		expect(rc1).toBe(OK);
		expect(await shard.getObject(towerId)).toBeNull();

		await expectStaleArgumentRejected(shard, 'p1', staleWithdrawStructureCase, code`
			Game.getObjectById(${creepId}).withdraw(globalThis.__screepsOkStaleArgWithdrawTower, RESOURCE_ENERGY)
		`);

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store.energy ?? 0).toBe(0);
	});
});

describe('creep.drop()', () => {
	test('DROP-001 drop() removes the dropped amount from the creep store', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { energy: 50 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).drop(RESOURCE_ENERGY)
		`);
		expect(rc).toBe(OK);

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store.energy ?? 0).toBe(0);
	});

	test('DROP-001 drop() creates a dropped resource at the creep position', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { energy: 50 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).drop(RESOURCE_ENERGY)
		`);
		expect(rc).toBe(OK);
		// runPlayer processed the drop. Observe via findInRoom (no extra tick).
		// Dropped resources decay by ceil(amount/1000) per tick = 1 for 50 energy.
		// The runPlayer tick already applied 1 tick of decay.
		const resources = await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES);
		const dropped = resources.find(r => r.pos.x === 25 && r.pos.y === 25);
		expect(dropped).toBeDefined();
		if (dropped) {
			expect(dropped.resourceType).toBe('energy');
			expect(dropped.amount).toBe(49);
		}
	});

	test('DROP-002 drops partial amount', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { energy: 50 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).drop(RESOURCE_ENERGY, 20)
		`);
		expect(rc).toBe(OK);

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store.energy).toBe(30);
	});

	test('DROP-003 dropping onto an existing pile of the same type merges into it', async ({ shard }) => {
		// Engine _create-energy.js:36-40: if an existing pile of the same
		// resource type is on the tile, the drop adds to it instead of
		// creating a second pile. Observed: one pile with merged amount.
		await shard.ownedRoom('p1');
		await shard.placeDroppedResource('W1N1', {
			pos: [25, 25], resourceType: 'energy', amount: 40,
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { energy: 30 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).drop(RESOURCE_ENERGY)
		`);
		expect(rc).toBe(OK);

		const piles = (await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES))
			.filter(r => r.pos.x === 25 && r.pos.y === 25 && r.resourceType === 'energy');
		// Exactly one pile — drop merged into the existing resource.
		expect(piles.length).toBe(1);
		// 40 decays to 39 on the setup tick; the drop merges 30 into it and the
		// drop tick's decay takes 1 more.
		expect(piles[0].amount).toBe(68);
	});

	test('DROP-008 drop inserts into same-tile container before creating pile', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const containerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_CONTAINER,
			store: { energy: 100 },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { energy: 30 },
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).drop(RESOURCE_ENERGY)
		`);

		const container = await shard.expectStructure(containerId, STRUCTURE_CONTAINER);
		expect(container.store.energy).toBe(130);

		const drops = await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES);
		const piles = drops.filter(r => r.pos.x === 25 && r.pos.y === 25);
		expect(piles.length).toBe(0);
	});

	test('DROP-009 drop onto empty tile creates a new Resource', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { energy: 30 },
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).drop(RESOURCE_ENERGY)
		`);

		const drops = await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES);
		const pile = drops.find(r => r.pos.x === 25 && r.pos.y === 25);
		expect(pile).toBeDefined();
		expect(pile!.resourceType).toBe(RESOURCE_ENERGY);
		expect(pile!.amount).toBe(29);
	});

	test('DROP-010 dropping different resource type creates separate Resource', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeDroppedResource('W1N1', {
			pos: [25, 25], resourceType: RESOURCE_ENERGY, amount: 100,
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { H: 20 },
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).drop(RESOURCE_HYDROGEN)
		`);

		const drops = await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES);
		const piles = drops.filter(r => r.pos.x === 25 && r.pos.y === 25);
		expect(piles.length).toBe(2);
		expect(piles.find(r => r.resourceType === RESOURCE_ENERGY)).toBeDefined();
		expect(piles.find(r => r.resourceType === 'H')).toBeDefined();
	});

	for (const row of dropValidationCases) {
		test(`DROP-011:${row.label} drop() validation returns the canonical code`, async ({ shard }) => {
			const blockers = shard.validationBlockers(row);
			const owner = blockers.has('not-owner') ? 'p2' : 'p1';
			if (owner === 'p2') {
				await shard.createShard({
					players: ['p1', 'p2'],
					rooms: [{ name: 'W1N1', rcl: 1, owner: blockers.has('busy') ? 'p2' : 'p1' }],
				});
				if (!blockers.has('busy')) {
					await shard.placeCreep('W1N1', { pos: [20, 20], owner: 'p1', body: [MOVE] });
				}
			} else {
				await shard.ownedRoom('p1');
			}

			const creepId = blockers.has('busy')
				? await spawnBusyCreep(shard, {
					owner,
					observerOwner: owner === 'p2' ? 'p1' : undefined,
					body: [CARRY, MOVE],
				})
				: await shard.placeCreep('W1N1', {
					pos: [25, 25],
					owner,
					body: [CARRY, MOVE],
					store: blockers.has('not-enough') ? {}
						: blockers.has('not-enough-amount') ? { energy: 10 }
						: { energy: 50 },
				});

			const resource = blockers.has('invalid-args') ? 'not_a_resource' : RESOURCE_ENERGY;
			const rc = blockers.has('not-enough-amount')
				? await shard.runPlayer('p1', code`
					Game.getObjectById(${creepId}).drop(${resource}, 20)
				`)
				: await shard.runPlayer('p1', code`
					Game.getObjectById(${creepId}).drop(${resource})
				`);
			expect(rc).toBe(row.expectedRc);
		});
	}
});

describe('creep.pickup()', () => {
	test('PICKUP-001 picks up dropped resource', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { energy: 30 },
			name: 'dropper',
		});
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			name: 'picker',
		});
		await shard.tick();

		// Drop energy — runPlayer processes the drop (1 tick, 1 decay)
		await shard.runPlayer('p1', code`
			Game.creeps['dropper'].drop(RESOURCE_ENERGY)
		`);

		// Pick up — runPlayer processes the pickup (1 more tick).
		// Resource was 30, decayed to 29 after drop tick. Picker receives 29.
		const rc = await shard.runPlayer('p1', code`
			const picker = Game.creeps['picker'];
			const resources = picker.room.find(FIND_DROPPED_RESOURCES);
			resources.length > 0 ? picker.pickup(resources[0]) : -99
		`);
		expect(rc).toBe(OK);

		const picker = (await shard.findInRoom('W1N1', FIND_CREEPS))
			.find(c => c.name === 'picker');
		expect(picker).toBeDefined();
		expect(picker!.store.energy).toBe(29);

		const remaining = await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES);
		expect(remaining.length).toBe(0);
	});

	test('PICKUP-002 pickup is capped by the creep free capacity, remainder stays on the tile', async ({ shard }) => {
		// Engine pickup processor (dist/processor/intents/creeps/pickup.js:27):
		//   amount = min(freeCapacity, target[resourceType])
		// The picker has 20 free capacity against a large pile; pickup must
		// take exactly 20 (capping the picker at full), leaving the remainder
		// minus 1 decay tick on the tile.
		//
		// Observation strategy: do the measurement inside a single runPlayer
		// so pre/post amounts use consistent tick semantics and we don't
		// conflate runPlayer's implicit tick with pile-decay arithmetic.
		await shard.ownedRoom('p1');
		await shard.placeDroppedResource('W1N1', {
			pos: [25, 25], resourceType: 'energy', amount: 200,
		});
		const pickerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			// body(3, CARRY, MOVE) → 3 CARRY = 150 capacity, already loaded
			// with 130 → 20 free capacity.
			body: body(3, CARRY, MOVE),
			store: { energy: 130 },
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const picker = Game.getObjectById(${pickerId});
			const pile = picker.room.lookForAt(LOOK_RESOURCES, picker.pos)[0];
			({
				preAmount: pile ? pile.amount : null,
				rc: pile ? picker.pickup(pile) : -99,
				pickerFree: picker.store.getFreeCapacity(RESOURCE_ENERGY),
				pickerEnergy: picker.store.energy,
			})
		`) as { preAmount: number | null; rc: number; pickerFree: number; pickerEnergy: number };

		expect(result.rc).toBe(OK);
		expect(result.pickerEnergy).toBe(130);
		expect(result.pickerFree).toBe(20);
		expect(result.preAmount).not.toBeNull();
		const preAmount = result.preAmount!;

		// After the intent is processed: picker filled to capacity, pile
		// reduced by exactly 20 then decayed once at tick end.
		const picker = await shard.expectObject(pickerId, 'creep');
		expect(picker.store.energy).toBe(150);

		const remaining = await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES);
		// Sanity: exactly one pile remains on the test tile.
		const piles = remaining.filter(r => r.pos.x === 25 && r.pos.y === 25);
		expect(piles.length).toBe(1);
		// Expected after-amount = (preAmount - 20) minus the end-of-tick decay
		// of ceil((preAmount - 20) / ENERGY_DECAY) = 1 for values 1..1000.
		const expectedAfter = (preAmount - 20) - Math.ceil((preAmount - 20) / ENERGY_DECAY);
		expect(piles[0].amount).toBe(expectedAfter);
	});

	test('PICKUP-008 pickup removes resource pile when amount reaches 0', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeDroppedResource('W1N1', {
			pos: [25, 25], resourceType: RESOURCE_ENERGY, amount: 50,
		});
		const pickerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: body(3, CARRY, MOVE),
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			const picker = Game.getObjectById(${pickerId});
			const pile = picker.room.lookForAt(LOOK_RESOURCES, picker.pos)[0];
			pile ? picker.pickup(pile) : -99
		`);

		const remaining = await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES);
		const piles = remaining.filter(r => r.pos.x === 25 && r.pos.y === 25);
		expect(piles.length).toBe(0);
	});

	test('PICKUP-009 pickup reduces resource pile amount by picked-up quantity', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeDroppedResource('W1N1', {
			pos: [25, 25], resourceType: RESOURCE_ENERGY, amount: 200,
		});
		const pickerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const picker = Game.getObjectById(${pickerId});
			const pile = picker.room.lookForAt(LOOK_RESOURCES, picker.pos)[0];
			({ preAmount: pile ? pile.amount : null, rc: pile ? picker.pickup(pile) : -99 })
		`) as { preAmount: number | null; rc: number };
		expect(result.rc).toBe(OK);

		const picker = await shard.expectObject(pickerId, 'creep');
		expect(picker.store.energy).toBe(CARRY_CAPACITY);

		const remaining = await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES);
		const piles = remaining.filter(r => r.pos.x === 25 && r.pos.y === 25);
		expect(piles.length).toBe(1);
		const expectedAfter = (result.preAmount! - CARRY_CAPACITY) -
			Math.ceil((result.preAmount! - CARRY_CAPACITY) / ENERGY_DECAY);
		expect(piles[0].amount).toBe(expectedAfter);
	});

	for (const row of pickupValidationCases) {
		test(`PICKUP-010:${row.label} pickup() validation returns the canonical code`, async ({ shard }) => {
			const blockers = shard.validationBlockers(row);
			const owner = blockers.has('not-owner') ? 'p2' : 'p1';
			if (owner === 'p2') {
				await shard.createShard({
					players: ['p1', 'p2'],
					rooms: [{ name: 'W1N1', rcl: 1, owner: blockers.has('busy') ? 'p2' : 'p1' }],
				});
				if (!blockers.has('busy')) {
					await shard.placeCreep('W1N1', { pos: [20, 20], owner: 'p1', body: [MOVE] });
				}
			} else {
				await shard.ownedRoom('p1');
			}

			const creepId = blockers.has('busy')
				? await spawnBusyCreep(shard, {
					owner,
					observerOwner: owner === 'p2' ? 'p1' : undefined,
					body: blockers.has('full') ? [MOVE] : [CARRY, MOVE],
				})
				: await shard.placeCreep('W1N1', {
					pos: [25, 25],
					owner,
					body: [CARRY, MOVE],
					store: blockers.has('full') ? { energy: CARRY_CAPACITY } : {},
				});
			const targetPos: [number, number] = blockers.has('range') ? [30, 30] : [25, 26];
			const targetId = blockers.has('invalid-target')
				? await shard.placeStructure('W1N1', {
					pos: targetPos,
					structureType: STRUCTURE_CONTAINER,
					store: { energy: 50 },
				})
				: await shard.placeDroppedResource('W1N1', {
					pos: targetPos,
					resourceType: RESOURCE_ENERGY,
					amount: 50,
				});

			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${creepId}).pickup(Game.getObjectById(${targetId}))
			`);
			expect(rc).toBe(row.expectedRc);
		});
	}

	test(`${stalePickupCase.catalogId}:${stalePickupCase.label} creep.pickup() rejects a stale cached Resource target`, async ({ shard }) => {
		await shard.ownedRoom('p1');
		const carrierId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE], name: 'Carrier',
		});
		const cleanerId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [CARRY, MOVE], name: 'Cleaner',
		});
		const dropId = await shard.placeDroppedResource('W1N1', {
			pos: [25, 26], resourceType: RESOURCE_ENERGY, amount: 50,
		});
		await shard.tick();

		const rc1 = await shard.runPlayer('p1', code`
			globalThis.__screepsOkStaleArgResource = Game.getObjectById(${dropId});
			Game.getObjectById(${cleanerId}).pickup(globalThis.__screepsOkStaleArgResource)
		`);
		expect(rc1).toBe(OK);
		expect(await shard.getObject(dropId)).toBeNull();

		await expectStaleArgumentRejected(shard, 'p1', stalePickupCase, code`
			Game.getObjectById(${carrierId}).pickup(globalThis.__screepsOkStaleArgResource)
		`);

		const carrier = await shard.expectObject(carrierId, 'creep');
		expect(carrier.store.energy ?? 0).toBe(0);
	});
});

describe('Dropped resource decay', () => {
	test('DROP-DECAY-001 dropped energy decays by ceil(amount / ENERGY_DECAY) per tick', async ({ shard }) => {
		await shard.ownedRoom('p1');
		// Drop from a creep — the engine tracks decay for dropped resources.
		// Use 50 energy (1 CARRY part). ceil(50/1000) = 1 per tick.
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { energy: CARRY_CAPACITY },
		});
		await shard.tick();

		// Drop all energy. runPlayer is 1 tick — first decay fires: 50 → 49.
		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).drop(RESOURCE_ENERGY)
		`);
		const resources1 = await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES);
		const pile1 = resources1.find(r => r.pos.x === 25 && r.pos.y === 25);
		expect(pile1).toBeDefined();
		expect(pile1!.amount).toBe(CARRY_CAPACITY - Math.ceil(CARRY_CAPACITY / ENERGY_DECAY));

		// Second decay tick: ceil(49/1000) = 1 → 48.
		await shard.tick();
		const resources2 = await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES);
		const pile2 = resources2.find(r => r.pos.x === 25 && r.pos.y === 25);
		expect(pile2).toBeDefined();
		expect(pile2!.amount).toBe(CARRY_CAPACITY - 1 - Math.ceil((CARRY_CAPACITY - 1) / ENERGY_DECAY));
	});

	test('DROP-DECAY-002 dropped resource disappears when amount reaches 0', async ({ shard }) => {
		await shard.ownedRoom('p1');
		// Use a creep to drop a small amount — the drop action creates the
		// resource in a known tick context. ceil(2/1000)=1 per tick → 2 ticks to vanish.
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { energy: 2 },
		});
		await shard.tick();

		// Drop 2 energy. runPlayer is 1 tick — decay fires: ceil(2/1000)=1 → amount=1.
		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).drop(RESOURCE_ENERGY)
		`);
		const mid = await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES);
		expect(mid.find(r => r.pos.x === 25)!.amount).toBe(1);

		// One more tick: ceil(1/1000)=1 → amount=0 → removed.
		await shard.tick();
		const after = await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES);
		expect(after.find(r => r.pos.x === 25 && r.pos.y === 25)).toBeUndefined();
	});

	test('DROP-DECAY-005 any player\'s creep can pick up any dropped resource', async ({ shard }) => {
		// Engine pickup has no ownership check — any creep within range 1 can
		// pickup any dropped resource regardless of who dropped it. This is
		// the basis of "energy drops are public loot" behavior.
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 3, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		// p1's creep drops energy at (25,25).
		const dropperId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { energy: 50 },
			name: 'p1dropper',
		});
		// p2's creep standing adjacent. p2 does not own W1N1 but creeps can
		// exist in foreign rooms and take actions that don't require ownership.
		const pickerId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2',
			body: [CARRY, MOVE],
			name: 'p2picker',
		});
		await shard.tick();

		// p1 drops.
		await shard.runPlayer('p1', code`
			Game.getObjectById(${dropperId}).drop(RESOURCE_ENERGY)
		`);

		// p2 picks up the foreign drop.
		const rc = await shard.runPlayer('p2', code`
			const picker = Game.getObjectById(${pickerId});
			const pile = picker.room.lookForAt(LOOK_RESOURCES, 25, 25)[0];
			pile ? picker.pickup(pile) : -99
		`);
		expect(rc).toBe(OK);

		const picker = await shard.expectObject(pickerId, 'creep');
		// p1 dropped 50; the drop tick's decay leaves 49 for the pickup.
		expect(picker.store.energy).toBe(49);
	});

	test('DROP-DECAY-006 dropped resources expose amount and resourceType via Resource API', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { energy: 40 },
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).drop(RESOURCE_ENERGY)
		`);

		const result = await shard.runPlayer('p1', code`
			const pile = Game.rooms['W1N1'].lookForAt(LOOK_RESOURCES, 25, 25)[0];
			pile ? ({ amount: pile.amount, resourceType: pile.resourceType, hasId: typeof pile.id === 'string' }) : null
		`) as { amount: number; resourceType: string; hasId: boolean } | null;

		expect(result).not.toBeNull();
		expect(result!.resourceType).toBe(RESOURCE_ENERGY);
		expect(result!.amount).toBe(39);
		expect(result!.hasId).toBe(true);
	});
});
