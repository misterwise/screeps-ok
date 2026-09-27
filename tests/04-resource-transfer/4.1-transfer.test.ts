import { describe, test, expect, code, body,
	OK,
	CARRY, MOVE, WORK,
	RESOURCE_ENERGY, RESOURCE_HYDROGEN, RESOURCE_OXYGEN,
	STRUCTURE_CONTAINER, STRUCTURE_SPAWN, STRUCTURE_LAB, STRUCTURE_EXTENSION,
	SPAWN_ENERGY_CAPACITY,
	UPGRADE_CONTROLLER_POWER,
} from '../../src/index.js';
import { transferValidationCases } from '../../src/matrices/transfer-validation.js';
import { staleArgumentCases } from '../../src/matrices/stale-argument.js';
import { expectStaleArgumentRejected, spawnBusyCreep } from '../intent-validation-helpers.js';

const staleTransferStructureCase = staleArgumentCases.find(row => row.key === 'creepTransferStructure')!;
const staleTransferCreepCase = staleArgumentCases.find(row => row.key === 'creepTransferCreep')!;

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
			const blockers = shard.validationBlockers(row);
			if (blockers.has('lab-mineral')) shard.requires('chemistry');
			const owner = blockers.has('not-owner') ? 'p2' : 'p1';
			const rcl = blockers.has('lab-mineral') ? 6 : 1;
			if (owner === 'p2') {
				await shard.createShard({
					players: ['p1', 'p2'],
					rooms: [{ name: 'W1N1', rcl, owner: blockers.has('busy') ? 'p2' : 'p1' }],
				});
				if (!blockers.has('busy')) {
					await shard.placeCreep('W1N1', { pos: [20, 20], owner: 'p1', body: [MOVE] });
				}
			} else {
				await shard.ownedRoom('p1', 'W1N1', rcl);
			}

			const resource = blockers.has('invalid-resource') ? 'not_a_resource'
				: blockers.has('no-resource') ? undefined
				: blockers.has('invalid-capacity') ? RESOURCE_HYDROGEN
				: blockers.has('lab-mineral') ? RESOURCE_OXYGEN
				: RESOURCE_ENERGY;
			const carried = resource === RESOURCE_HYDROGEN || resource === RESOURCE_OXYGEN ? resource : RESOURCE_ENERGY;
			const store: Record<string, number> = blockers.has('not-enough')
				? {}
				: { [carried]: blockers.has('not-enough-amount') ? 10 : 50 };
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
					: blockers.has('lab-mineral')
					? await shard.placeStructure('W1N1', {
						pos: targetPos,
						structureType: STRUCTURE_LAB,
						owner: 'p1',
						store: { H: 50 },
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
			if (blockers.has('lab-mineral')) await shard.tick();
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

	test(`${staleTransferStructureCase.catalogId}:${staleTransferStructureCase.label} creep.transfer() rejects a stale cached Structure target`, async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 3);
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { energy: 50 },
		});
		const extensionId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_EXTENSION, owner: 'p1',
			store: { energy: 0 },
		});
		await shard.tick();

		const rc1 = await shard.runPlayer('p1', code`
			globalThis.__screepsOkStaleArgExtension = Game.getObjectById(${extensionId});
			globalThis.__screepsOkStaleArgExtension.destroy()
		`);
		expect(rc1).toBe(OK);
		expect(await shard.getObject(extensionId)).toBeNull();

		await expectStaleArgumentRejected(shard, 'p1', staleTransferStructureCase, code`
			Game.getObjectById(${creepId}).transfer(globalThis.__screepsOkStaleArgExtension, RESOURCE_ENERGY)
		`);

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store.energy).toBe(50);
	});

	test(`${staleTransferCreepCase.catalogId}:${staleTransferCreepCase.label} creep.transfer() rejects a stale cached Creep target`, async ({ shard }) => {
		await shard.ownedRoom('p1');
		const giverId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { energy: 50 },
		});
		const receiverId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [CARRY, MOVE], name: 'TransferTarget',
		});
		await shard.tick();

		const rc1 = await shard.runPlayer('p1', code`
			globalThis.__screepsOkStaleArgCreep = Game.getObjectById(${receiverId});
			globalThis.__screepsOkStaleArgCreep.suicide()
		`);
		expect(rc1).toBe(OK);
		expect(await shard.getObject(receiverId)).toBeNull();

		await expectStaleArgumentRejected(shard, 'p1', staleTransferCreepCase, code`
			Game.getObjectById(${giverId}).transfer(globalThis.__screepsOkStaleArgCreep, RESOURCE_ENERGY)
		`);

		const giver = await shard.expectObject(giverId, 'creep');
		expect(giver.store.energy).toBe(50);
	});
});
