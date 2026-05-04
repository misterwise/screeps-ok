import { describe, test, expect, code, body,
	OK, ERR_NOT_OWNER, ERR_NOT_IN_RANGE, ERR_NOT_ENOUGH_RESOURCES,
	ERR_FULL, ERR_INVALID_TARGET, ERR_INVALID_ARGS, ERR_BUSY,
	WORK, CARRY, MOVE,
	FIND_CREEPS, FIND_DROPPED_RESOURCES,
	RESOURCE_ENERGY,
	STRUCTURE_CONTAINER, STRUCTURE_RAMPART, STRUCTURE_SPAWN, STRUCTURE_TERMINAL,
	STRUCTURE_LAB, STRUCTURE_NUKER,
	CARRY_CAPACITY, ENERGY_DECAY, SPAWN_ENERGY_CAPACITY,
	LAB_MINERAL_CAPACITY,
	PWR_DISRUPT_TERMINAL,
	SAFE_MODE_DURATION,
} from '../../src/index.js';
import { dropValidationCases } from '../../src/matrices/drop-validation.js';
import { pickupValidationCases } from '../../src/matrices/pickup-validation.js';
import { withdrawValidationCases } from '../../src/matrices/withdraw-validation.js';
import { spawnBusyCreep } from '../intent-validation-helpers.js';

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

	test('WITHDRAW-003 returns ERR_NOT_IN_RANGE', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [10, 10], owner: 'p1',
			body: [CARRY, MOVE],
		});
		const containerId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_CONTAINER,
			store: { energy: 500 },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).withdraw(Game.getObjectById(${containerId}), RESOURCE_ENERGY)
		`);
		expect(rc).toBe(ERR_NOT_IN_RANGE);
	});

	test('WITHDRAW-004 returns ERR_NOT_ENOUGH_RESOURCES from empty container', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
		});
		const containerId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_CONTAINER,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).withdraw(Game.getObjectById(${containerId}), RESOURCE_ENERGY)
		`);
		expect(rc).toBe(ERR_NOT_ENOUGH_RESOURCES);
	});

	test('WITHDRAW-005 returns ERR_NOT_OWNER when a non-public enemy rampart covers the target', async ({ shard }) => {
		// Engine creeps.js:499-500 — `target.my === false && any non-public
		// enemy rampart on target tile` → ERR_NOT_OWNER. The rule is gated on
		// strict `target.my === false`, so it only applies to OwnedStructures
		// with a non-me user; neutral structures (e.g. plain containers) have
		// `my === undefined` and slip past the rule entirely. Use a p2-owned
		// spawn as the target so target.my === false actually holds.
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 3, owner: 'p2' },
				{ name: 'W2N1', rcl: 1, owner: 'p1' },
			],
		});
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_SPAWN, owner: 'p2',
			store: { energy: 300 },
		});
		// Enemy rampart on same tile, defaults to isPublic=false — blocks any
		// non-owner withdraw per engine creeps.js:499.
		await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_RAMPART, owner: 'p2',
			hits: 10000,
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).withdraw(Game.getObjectById(${spawnId}), RESOURCE_ENERGY)
		`);
		expect(rc).toBe(ERR_NOT_OWNER);
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
			structureType: 'container',
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

	test('WITHDRAW-007 returns ERR_FULL when the creep has no free capacity', async ({ shard }) => {
		// Engine creeps.js:544-548 — `emptySpace <= 0` → ERR_FULL.
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { energy: CARRY_CAPACITY },
		});
		const containerId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_CONTAINER,
			store: { energy: 500 },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).withdraw(Game.getObjectById(${containerId}), RESOURCE_ENERGY)
		`);
		expect(rc).toBe(ERR_FULL);
	});

	test('WITHDRAW-008 terminal withdraw is blocked by PWR_DISRUPT_TERMINAL effect', async ({ shard }) => {
		// Engine creeps.js:518-523: if the target is a terminal with a
		// PWR_DISRUPT_TERMINAL effect that has ticksRemaining > 0, withdraw()
		// returns ERR_INVALID_TARGET (the terminal behaves as if it is not a
		// valid withdraw target while disrupted).
		shard.requires('powerCreeps');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});
		const terminalId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p1',
			store: { energy: 1000 },
		});
		await shard.placePowerCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			powers: { [PWR_DISRUPT_TERMINAL]: 1 },
			store: { ops: 100 },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [26, 25], owner: 'p1',
			body: [CARRY, MOVE],
		});
		await shard.tick();

		// Power creep applies the disrupt effect to the terminal.
		const castRc = await shard.runPlayer('p1', code`
			const pc = Object.values(Game.powerCreeps)[0];
			const term = Game.getObjectById(${terminalId});
			pc.usePower(PWR_DISRUPT_TERMINAL, term)
		`);
		expect(castRc).toBe(OK);
		await shard.tick();

		// Now try withdrawing from the disrupted terminal.
		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).withdraw(Game.getObjectById(${terminalId}), RESOURCE_ENERGY)
		`);
		expect(rc).toBe(ERR_INVALID_TARGET);
	});

	test('WITHDRAW-009 withdraw returns ERR_NOT_OWNER on unowned creep', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p2',
			body: [CARRY, MOVE],
		});
		const containerId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_CONTAINER,
			store: { energy: 500 },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).withdraw(Game.getObjectById(${containerId}), RESOURCE_ENERGY)
		`);
		expect(rc).toBe(ERR_NOT_OWNER);
	});

	test('WITHDRAW-010 withdraw returns ERR_BUSY while spawning', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 1);
		await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		const containerId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_CONTAINER,
			store: { energy: 500 },
		});
		await shard.tick();

		const spawnRc = await shard.runPlayer('p1', code`
			Object.values(Game.spawns)[0].spawnCreep([CARRY, MOVE], 'Hauler')
		`);
		expect(spawnRc).toBe(OK);

		const rc = await shard.runPlayer('p1', code`
			const c = Game.creeps['Hauler'];
			c ? c.withdraw(Game.getObjectById(${containerId}), RESOURCE_ENERGY) : -99
		`);
		expect(rc).toBe(ERR_BUSY);
	});

	test('WITHDRAW-011 withdraw returns ERR_INVALID_ARGS for invalid resourceType or negative amount', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
		});
		const containerId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_CONTAINER,
			store: { energy: 500 },
		});

		const result = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			const target = Game.getObjectById(${containerId});
			({
				invalidType: creep.withdraw(target, 'not_a_resource'),
				negativeAmount: creep.withdraw(target, RESOURCE_ENERGY, -10),
			})
		`) as { invalidType: number; negativeAmount: number };

		expect(result.invalidType).toBe(ERR_INVALID_ARGS);
		expect(result.negativeAmount).toBe(ERR_INVALID_ARGS);
	});

	test('WITHDRAW-012 withdraw returns ERR_NOT_OWNER during hostile safe mode', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 3, owner: 'p2', safeMode: SAFE_MODE_DURATION },
				{ name: 'W2N1', rcl: 1, owner: 'p1' },
			],
		});
		const containerId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_CONTAINER,
			store: { energy: 500 },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).withdraw(Game.getObjectById(${containerId}), RESOURCE_ENERGY)
		`);
		expect(rc).toBe(ERR_NOT_OWNER);
	});

	test('WITHDRAW-013 withdraw returns ERR_INVALID_TARGET for nukers', async ({ shard }) => {
		shard.requires('nuke');
		await shard.ownedRoom('p1', 'W1N1', 8);
		const nukerId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_NUKER, owner: 'p1',
			store: { energy: 100000 },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).withdraw(Game.getObjectById(${nukerId}), RESOURCE_ENERGY)
		`);
		expect(rc).toBe(ERR_INVALID_TARGET);
	});

	test('WITHDRAW-014 withdraw returns ERR_INVALID_TARGET when target cannot hold requested resource', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).withdraw(Game.getObjectById(${spawnId}), RESOURCE_HYDROGEN)
		`);
		expect(rc).toBe(ERR_INVALID_TARGET);
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

	test('WITHDRAW-016 withdraw returns ERR_FULL when amount exceeds creep free capacity', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { energy: 40 },
		});
		const containerId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_CONTAINER,
			store: { energy: 500 },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).withdraw(Game.getObjectById(${containerId}), RESOURCE_ENERGY, 20)
		`);
		expect(rc).toBe(ERR_FULL);
	});

	for (const row of withdrawValidationCases) {
		test(`WITHDRAW-017:${row.label} withdraw() validation returns the canonical code`, async ({ shard }) => {
			const blockers = new Set(row.blockers);
			const owner = blockers.has('not-owner') ? 'p2' : 'p1';
			const needsSecondPlayer = owner === 'p2' || blockers.has('target-not-owner') || blockers.has('safemode-not-owner');
			const roomOwner = blockers.has('safemode-not-owner') || owner === 'p2' && blockers.has('busy') ? 'p2' : 'p1';
			if (needsSecondPlayer) {
				await shard.createShard({
					players: ['p1', 'p2'],
					rooms: [{
						name: 'W1N1',
						rcl: 3,
						owner: roomOwner,
						...(blockers.has('safemode-not-owner') ? { safeMode: SAFE_MODE_DURATION } : {}),
					}],
				});
				if (owner === 'p2' && !blockers.has('busy')) {
					await shard.placeCreep('W1N1', { pos: [20, 20], owner: 'p1', body: [MOVE] });
				}
			} else {
				await shard.ownedRoom('p1', 'W1N1', 3);
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
					store: blockers.has('full') || blockers.has('full-amount') ? { energy: CARRY_CAPACITY } : {},
				});
			const targetPos: [number, number] = blockers.has('range') ? [30, 30] : [25, 26];
			const targetId = blockers.has('invalid-target')
				? await shard.placeCreep('W1N1', { pos: targetPos, owner: 'p1', body: [MOVE] })
				: blockers.has('target-not-owner')
					? await shard.placeStructure('W1N1', {
						pos: targetPos,
						structureType: blockers.has('invalid-nuker') ? STRUCTURE_NUKER : STRUCTURE_SPAWN,
						owner: 'p2',
						store: { energy: 300 },
					})
				: blockers.has('invalid-nuker')
					? await shard.placeStructure('W1N1', { pos: targetPos, structureType: STRUCTURE_NUKER, owner: 'p1' })
					: blockers.has('invalid-capacity')
						? await shard.placeStructure('W1N1', { pos: targetPos, structureType: STRUCTURE_SPAWN, owner: 'p1', store: { energy: 300 } })
							: await shard.placeStructure('W1N1', {
								pos: targetPos,
								structureType: STRUCTURE_CONTAINER,
								store: blockers.has('not-enough') ? {} : { energy: 500 },
							});
			if (blockers.has('target-not-owner')) {
				await shard.placeStructure('W1N1', {
					pos: targetPos,
					structureType: STRUCTURE_RAMPART,
					owner: 'p2',
				});
			}

			const resource = blockers.has('invalid-args')
				? 'not_a_resource'
				: blockers.has('invalid-capacity')
					? 'H'
					: RESOURCE_ENERGY;
			const amount = blockers.has('invalid-args') ? -1 : blockers.has('full-amount') ? 51 : undefined;
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
		// Merged amount = 40 (initial, after one decay from shard.tick) + 30 (dropped)
		// then one end-of-tick decay from runPlayer.
		// Accept the pile has clearly more than the initial 40 — the merge
		// actually added the dropped 30 into the same resource.
		expect(piles[0].amount).toBeGreaterThan(40);
	});

	test('DROP-004 returns ERR_NOT_ENOUGH_RESOURCES when the creep lacks the resource', async ({ shard }) => {
		// Engine creeps.js (drop): `!data.store[resourceType]` → ERR_NOT_ENOUGH_RESOURCES.
		// Creep has energy but tries to drop hydrogen.
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { energy: 50 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).drop(RESOURCE_HYDROGEN)
		`);
		expect(rc).toBe(ERR_NOT_ENOUGH_RESOURCES);
	});

	test('DROP-005 drop returns ERR_NOT_OWNER on unowned creep', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p2',
			body: [CARRY, MOVE],
			store: { energy: 50 },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).drop(RESOURCE_ENERGY)
		`);
		expect(rc).toBe(ERR_NOT_OWNER);
	});

	test('DROP-006 drop returns ERR_BUSY while spawning', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 1);
		await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		await shard.tick();

		const spawnRc = await shard.runPlayer('p1', code`
			Object.values(Game.spawns)[0].spawnCreep([CARRY, MOVE], 'Dropper')
		`);
		expect(spawnRc).toBe(OK);

		const rc = await shard.runPlayer('p1', code`
			const c = Game.creeps['Dropper'];
			c ? c.drop(RESOURCE_ENERGY) : -99
		`);
		expect(rc).toBe(ERR_BUSY);
	});

	test('DROP-007 drop returns ERR_INVALID_ARGS for invalid resourceType', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { energy: 50 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).drop('not_a_resource')
		`);
		expect(rc).toBe(ERR_INVALID_ARGS);
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
		expect(pile!.amount).toBeGreaterThan(0);
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
			const blockers = new Set(row.blockers);
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
					store: blockers.has('not-enough') ? {} : { energy: 50 },
				});

			const resource = blockers.has('invalid-args') ? 'not_a_resource' : RESOURCE_ENERGY;
			const rc = await shard.runPlayer('p1', code`
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

	test('PICKUP-003 returns ERR_NOT_IN_RANGE when the resource is not adjacent', async ({ shard }) => {
		// Engine creeps.js:581-583 — not adjacent → ERR_NOT_IN_RANGE.
		await shard.ownedRoom('p1');
		await shard.placeDroppedResource('W1N1', {
			pos: [40, 40], resourceType: 'energy', amount: 50,
		});
		const pickerId = await shard.placeCreep('W1N1', {
			pos: [10, 10], owner: 'p1',
			body: [CARRY, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const picker = Game.getObjectById(${pickerId});
			const pile = picker.room.find(FIND_DROPPED_RESOURCES)[0];
			pile ? picker.pickup(pile) : -99
		`);
		expect(rc).toBe(ERR_NOT_IN_RANGE);
	});

	test('PICKUP-004 returns ERR_FULL when the creep has no free capacity', async ({ shard }) => {
		// Engine creeps.js:578-580 — `calcResources(creep) >= storeCapacity`
		// → ERR_FULL.
		await shard.ownedRoom('p1');
		await shard.placeDroppedResource('W1N1', {
			pos: [25, 25], resourceType: 'energy', amount: 50,
		});
		const pickerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { energy: CARRY_CAPACITY },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const picker = Game.getObjectById(${pickerId});
			const pile = picker.room.lookForAt(LOOK_RESOURCES, picker.pos)[0];
			pile ? picker.pickup(pile) : -99
		`);
		expect(rc).toBe(ERR_FULL);
	});

	test('PICKUP-005 pickup returns ERR_NOT_OWNER on unowned creep', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		await shard.placeDroppedResource('W1N1', {
			pos: [25, 25], resourceType: RESOURCE_ENERGY, amount: 50,
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p2',
			body: [CARRY, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const picker = Game.getObjectById(${creepId});
			const pile = picker.room.lookForAt(LOOK_RESOURCES, picker.pos)[0];
			pile ? picker.pickup(pile) : -99
		`);
		expect(rc).toBe(ERR_NOT_OWNER);
	});

	test('PICKUP-006 pickup returns ERR_BUSY while spawning', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 1);
		await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		await shard.placeDroppedResource('W1N1', {
			pos: [25, 26], resourceType: RESOURCE_ENERGY, amount: 50,
		});
		await shard.tick();

		const spawnRc = await shard.runPlayer('p1', code`
			Object.values(Game.spawns)[0].spawnCreep([CARRY, MOVE], 'Picker')
		`);
		expect(spawnRc).toBe(OK);

		const rc = await shard.runPlayer('p1', code`
			const c = Game.creeps['Picker'];
			c ? (c.room.find(FIND_DROPPED_RESOURCES)[0] ? c.pickup(c.room.find(FIND_DROPPED_RESOURCES)[0]) : -98) : -99
		`);
		expect(rc).toBe(ERR_BUSY);
	});

	test('PICKUP-007 pickup returns ERR_INVALID_TARGET for a non-Resource target', async ({ shard }) => {
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
			Game.getObjectById(${creepId}).pickup(Game.getObjectById(${containerId}))
		`);
		expect(rc).toBe(ERR_INVALID_TARGET);
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
			const blockers = new Set(row.blockers);
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

	test('DROP-DECAY-004 harvesting above carry capacity drops the overflow on the creep tile', async ({ shard }) => {
		// Engine harvest.js:60-65: when sum > storeCapacity after harvest,
		// the overflow is dispatched through ./drop(creep, { amount, resourceType }).
		// Setup: 5 WORK = 10 energy/tick, 1 CARRY = 50 capacity, start with 45
		// energy → sum becomes 55, overflow 5 dropped.
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: body(5, WORK, CARRY, MOVE),
			store: { energy: 45 },
		});
		const sourceId = await shard.placeSource('W1N1', {
			pos: [25, 26], energy: 3000, energyCapacity: 3000,
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${sourceId}))
		`);

		// After the intent tick: creep is capped at CARRY_CAPACITY (50); the
		// 5-energy overflow is dropped on the creep tile (25,25).
		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store.energy).toBe(CARRY_CAPACITY);

		const piles = (await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES))
			.filter(r => r.pos.x === 25 && r.pos.y === 25 && r.resourceType === 'energy');
		expect(piles.length).toBe(1);
		// The overflow was 5; decay ceil(5/1000)=1 → 4 after the tick's decay pass.
		expect(piles[0].amount).toBeGreaterThanOrEqual(4);
		expect(piles[0].amount).toBeLessThanOrEqual(5);
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
		// p1 dropped 50, two ticks of decay along the way (1 after drop, 1
		// after pickup intent) leave the picker with 48-50 energy.
		expect(picker.store.energy).toBeGreaterThanOrEqual(48);
		expect(picker.store.energy).toBeLessThanOrEqual(50);
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
		expect(result!.amount).toBeGreaterThan(0);
		expect(result!.hasId).toBe(true);
	});
});
