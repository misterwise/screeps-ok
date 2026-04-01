import { describe, test, expect, code } from '../../src/index.js';

describe('creep.upgradeController()', () => {
	test('returns OK when adjacent to own controller with energy', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const ctrlPos = await shard.getControllerPos('W1N1');

		const creepId = await shard.placeCreep('W1N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body: ['work', 'carry', 'move'],
			store: { energy: 50 },
		});

		const rc = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			const ctrl = creep.room.controller;
			creep.upgradeController(ctrl)
		`);
		expect(rc).toBe(0);
	});

	test('consumes 1 energy per WORK part per tick', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const ctrlPos = await shard.getControllerPos('W1N1');

		const creepId = await shard.placeCreep('W1N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body: ['work', 'work', 'carry', 'move'],
			store: { energy: 50 },
		});

		await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			creep.upgradeController(creep.room.controller)
		`);
		await shard.tick();

		const creep = await shard.getObject(creepId);
		if (creep?.kind === 'creep') {
			expect(creep.store.energy).toBe(48); // 2 WORK = 2 energy/tick
		}
	});

	test('returns ERR_NOT_IN_RANGE when not within range 3', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: ['work', 'carry', 'move'],
			store: { energy: 50 },
		});

		const rc = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			creep.upgradeController(creep.room.controller)
		`);
		expect(rc).toBe(-9);
	});

	test('returns ERR_NOT_ENOUGH_RESOURCES without energy', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const ctrlPos = await shard.getControllerPos('W1N1');

		const creepId = await shard.placeCreep('W1N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body: ['work', 'carry', 'move'],
		});

		const rc = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			creep.upgradeController(creep.room.controller)
		`);
		expect(rc).toBe(-6);
	});
});
