import { describe, test, expect, code, body,
	OK, ERR_NOT_OWNER, ERR_NOT_IN_RANGE, ERR_NOT_ENOUGH_RESOURCES,
	ERR_INVALID_ARGS, ERR_INVALID_TARGET, ERR_FULL, ERR_BUSY,
	CARRY, MOVE, WORK,
	RESOURCE_ENERGY,
	STRUCTURE_CONTAINER, STRUCTURE_SPAWN, STRUCTURE_LAB, STRUCTURE_CONTROLLER,
	SPAWN_ENERGY_CAPACITY, LAB_MINERAL_CAPACITY, CARRY_CAPACITY,
	UPGRADE_CONTROLLER_POWER,
} from '../../src/index.js';
import { transferValidationCases } from '../../src/matrices/transfer-validation.js';
import { spawnBusyCreep } from '../intent-validation-helpers.js';

describe('creep.transfer()', () => {
	test('TRANSFER-001 transfers energy from the creep store to the target store', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { energy: 50 },
		});
		const containerId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_CONTAINER,
			store: {},
		});

		const rc = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			const target = Game.getObjectById(${containerId});
			creep.transfer(target, RESOURCE_ENERGY)
		`);
		expect(rc).toBe(OK);

		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store.energy ?? 0).toBe(0);
		const container = await shard.expectStructure(containerId, STRUCTURE_CONTAINER);
		expect(container.store.energy).toBe(50);
	});

	test('TRANSFER-002 transfers partial amount', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { energy: 50 },
		});
		const containerId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_CONTAINER,
			store: {},
		});

		const rc = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			const target = Game.getObjectById(${containerId});
			creep.transfer(target, RESOURCE_ENERGY, 20)
		`);
		expect(rc).toBe(OK);

		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store.energy).toBe(30);
	});

	test('TRANSFER-003 returns ERR_NOT_IN_RANGE when far', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [10, 10], owner: 'p1',
			body: [CARRY, MOVE],
			store: { energy: 50 },
		});
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_SPAWN, owner: 'p1',
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).transfer(Game.getObjectById(${spawnId}), RESOURCE_ENERGY)
		`);
		expect(rc).toBe(ERR_NOT_IN_RANGE);
	});

	test('TRANSFER-004 returns ERR_NOT_ENOUGH_RESOURCES with empty store', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			// no store
		});
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_SPAWN, owner: 'p1',
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).transfer(Game.getObjectById(${spawnId}), RESOURCE_ENERGY)
		`);
		expect(rc).toBe(ERR_NOT_ENOUGH_RESOURCES);
	});

	test('TRANSFER-005 requires a resource type — omitted or unknown returns ERR_INVALID_ARGS', async ({ shard }) => {
		// Engine creeps.js:438: `!_.contains(C.RESOURCES_ALL, resourceType)` → ERR_INVALID_ARGS
		// Both undefined and an unknown string fail this check.
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { energy: 50 },
		});
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_SPAWN, owner: 'p1',
		});

		const result = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			const target = Game.getObjectById(${spawnId});
			({
				omitted: creep.transfer(target),
				unknown: creep.transfer(target, 'not_a_resource'),
			})
		`) as { omitted: number; unknown: number };

		expect(result.omitted).toBe(ERR_INVALID_ARGS);
		expect(result.unknown).toBe(ERR_INVALID_ARGS);
	});

	test('TRANSFER-006 returns ERR_FULL when target store has no free capacity', async ({ shard }) => {
		// Engine creeps.js:473: `storedAmount >= targetCapacity` → ERR_FULL.
		// Pre-fill the spawn to SPAWN_ENERGY_CAPACITY so there is zero free capacity for energy.
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { energy: 50 },
		});
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: SPAWN_ENERGY_CAPACITY },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).transfer(Game.getObjectById(${spawnId}), RESOURCE_ENERGY)
		`);
		expect(rc).toBe(ERR_FULL);
	});

	test('TRANSFER-007 returns ERR_INVALID_TARGET when the target cannot hold the resource type', async ({ shard }) => {
		// Engine creeps.js:459-461 — `!utils.capacityForResource(data(target.id), resourceType)`
		// → ERR_INVALID_TARGET. Spawns accept only energy; transferring any
		// mineral to a spawn hits this path.
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { H: 10 },
		});
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_SPAWN, owner: 'p1',
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).transfer(Game.getObjectById(${spawnId}), RESOURCE_HYDROGEN)
		`);
		expect(rc).toBe(ERR_INVALID_TARGET);
	});

	test('TRANSFER-008 transferring a mineral into a lab loaded with a different mineral returns ERR_INVALID_TARGET', async ({ shard }) => {
		// Labs only accept the mineral type they currently hold (plus energy).
		// Pre-loading the lab with 'H' sets the lab's mineral slot to H; an
		// attempt to transfer 'O' must be rejected via capacityForResource.
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { O: 10 },
		});
		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { H: 50 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).transfer(Game.getObjectById(${labId}), RESOURCE_OXYGEN)
		`);
		expect(rc).toBe(ERR_INVALID_TARGET);
	});

	test('TRANSFER-009 transfer returns ERR_NOT_OWNER on unowned creep', async ({ shard }) => {
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
		const containerId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_CONTAINER,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).transfer(Game.getObjectById(${containerId}), RESOURCE_ENERGY)
		`);
		expect(rc).toBe(ERR_NOT_OWNER);
	});

	test('TRANSFER-010 transfer returns ERR_BUSY while spawning', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 1);
		await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		const containerId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_CONTAINER,
		});
		await shard.tick();

		const spawnRc = await shard.runPlayer('p1', code`
			Object.values(Game.spawns)[0].spawnCreep([CARRY, MOVE], 'Hauler')
		`);
		expect(spawnRc).toBe(OK);

		const rc = await shard.runPlayer('p1', code`
			const c = Game.creeps['Hauler'];
			c ? c.transfer(Game.getObjectById(${containerId}), RESOURCE_ENERGY) : -99
		`);
		expect(rc).toBe(ERR_BUSY);
	});

	test('TRANSFER-011 transfer(controller, RESOURCE_ENERGY) redirects to upgradeController', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [1, 2], owner: 'p1',
			body: [WORK, CARRY, MOVE],
			store: { energy: 50 },
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			const ctrl = creep.room.controller;
			const progressBefore = ctrl.progress;
			const rc = creep.transfer(ctrl, RESOURCE_ENERGY);
			({ rc, progressBefore })
		`) as { rc: number; progressBefore: number };

		expect(result.rc).toBe(OK);

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store.energy).toBe(50 - UPGRADE_CONTROLLER_POWER);
	});

	test('TRANSFER-012 transferring mineral into empty lab initializes mineral slot', async ({ shard }) => {
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { H: 10 },
		});
		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 0 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).transfer(Game.getObjectById(${labId}), RESOURCE_HYDROGEN)
		`);
		expect(rc).toBe(OK);

		const lab = await shard.expectStructure(labId, STRUCTURE_LAB);
		expect((lab.store as Record<string, number>).H).toBe(10);
		expect(lab.mineralType).toBe('H');
	});

	test('TRANSFER-013 transfer returns ERR_FULL when amount exceeds target free capacity', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { energy: 50 },
		});
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: SPAWN_ENERGY_CAPACITY - 10 },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).transfer(Game.getObjectById(${spawnId}), RESOURCE_ENERGY, 20)
		`);
		expect(rc).toBe(ERR_FULL);
	});

	test('TRANSFER-014 transfer to another creep follows same store mechanics', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const giverId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { energy: 30 },
			name: 'giver',
		});
		const receiverId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [CARRY, MOVE],
			name: 'receiver',
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${giverId}).transfer(Game.getObjectById(${receiverId}), RESOURCE_ENERGY, 20)
		`);
		expect(rc).toBe(OK);

		const giver = await shard.expectObject(giverId, 'creep');
		expect(giver.store.energy).toBe(10);
		const receiver = await shard.expectObject(receiverId, 'creep');
		expect(receiver.store.energy).toBe(20);
	});

	for (const row of transferValidationCases) {
		test(`TRANSFER-015:${row.label} transfer() validation returns the canonical code`, async ({ shard }) => {
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

			const resource = blockers.has('invalid-args')
				? 'not_a_resource'
				: blockers.has('invalid-capacity')
					? 'H'
					: RESOURCE_ENERGY;
			const store: Record<string, number> = blockers.has('not-enough')
				? {}
				: blockers.has('not-enough-amount')
					? { energy: 10 }
					: resource === 'H'
						? { H: 50 }
						: { energy: 50 };
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
					store,
				});
			const targetPos: [number, number] = blockers.has('range') ? [30, 30] : [25, 26];
			const targetId = blockers.has('invalid-target')
				? await shard.placeSource('W1N1', { pos: targetPos })
				: blockers.has('invalid-capacity')
					? await shard.placeStructure('W1N1', {
						pos: targetPos,
						structureType: STRUCTURE_SPAWN,
						owner: 'p1',
						store: { energy: 0 },
					})
					: await shard.placeStructure('W1N1', {
						pos: targetPos,
						structureType: STRUCTURE_SPAWN,
						owner: 'p1',
						store: blockers.has('full')
							? { energy: SPAWN_ENERGY_CAPACITY }
							: blockers.has('full-amount')
								? { energy: SPAWN_ENERGY_CAPACITY - 10 }
								: { energy: 0 },
					});
			const amount = blockers.has('invalid-args') ? -1
				: blockers.has('not-enough-amount') || blockers.has('full-amount') ? 20
					: undefined;
			const rc = amount === undefined
				? await shard.runPlayer('p1', code`
					Game.getObjectById(${creepId}).transfer(Game.getObjectById(${targetId}), ${resource})
				`)
				: await shard.runPlayer('p1', code`
					Game.getObjectById(${creepId}).transfer(Game.getObjectById(${targetId}), ${resource}, ${amount})
				`);
			expect(rc).toBe(row.expectedRc);
		});
	}
});
