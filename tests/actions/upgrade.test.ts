import { describe, test, expect, code, OK, ERR_NOT_IN_RANGE, ERR_NOT_ENOUGH_RESOURCES, WORK, CARRY, MOVE } from '../../src/index.js';

describe('creep.upgradeController()', () => {
	test('returns OK when adjacent to own controller with energy', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const ctrlPos = await shard.getControllerPos('W1N1');

		const creepId = await shard.placeCreep('W1N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body: [WORK, CARRY, MOVE],
			store: { energy: 50 },
		});

		const rc = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			const ctrl = creep.room.controller;
			creep.upgradeController(ctrl)
		`);
		expect(rc).toBe(OK);
	});

	test('consumes 1 energy per WORK part per tick', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const ctrlPos = await shard.getControllerPos('W1N1');

		const creepId = await shard.placeCreep('W1N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body: [WORK, WORK, CARRY, MOVE],
			store: { energy: 50 },
		});

		await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			creep.upgradeController(creep.room.controller)
		`);
		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store.energy).toBe(48); // 2 WORK = 2 energy/tick
	});

	test('returns ERR_NOT_IN_RANGE when not within range 3', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
			store: { energy: 50 },
		});

		const rc = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			creep.upgradeController(creep.room.controller)
		`);
		expect(rc).toBe(ERR_NOT_IN_RANGE);
	});

	test('returns ERR_NOT_ENOUGH_RESOURCES without energy', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const ctrlPos = await shard.getControllerPos('W1N1');

		const creepId = await shard.placeCreep('W1N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});

		const rc = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			creep.upgradeController(creep.room.controller)
		`);
		expect(rc).toBe(ERR_NOT_ENOUGH_RESOURCES);
	});
});
