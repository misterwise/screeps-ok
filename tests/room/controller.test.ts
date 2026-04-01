import { describe, test, expect, code } from '../../src/index.js';

describe('controller mechanics', () => {
	test('claimController returns OK for unowned room', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1' }, // unowned
			],
		});
		const creepId = await shard.placeCreep('W2N1', {
			pos: [2, 1], owner: 'p1', // adjacent to controller at (1,1)
			body: ['claim', 'move'],
		});

		const rc = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			const ctrl = creep.room.controller;
			creep.claimController(ctrl)
		`);
		expect(rc).toBe(0);
	});

	test('signController writes a sign', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [2, 1], owner: 'p1',
			body: ['move'],
		});

		const rc = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			creep.signController(creep.room.controller, 'screeps-ok was here')
		`);
		expect(rc).toBe(0);
	});

	test('reserveController returns OK for unowned controller', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1' },
			],
		});
		const creepId = await shard.placeCreep('W2N1', {
			pos: [2, 1], owner: 'p1',
			body: ['claim', 'claim', 'move'],
		});

		const rc = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			creep.reserveController(creep.room.controller)
		`);
		expect(rc).toBe(0);
	});

	test('attackController reduces downgrade timer on hostile controller', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const creepId = await shard.placeCreep('W2N1', {
			pos: [2, 1], owner: 'p1',
			body: ['claim', 'move'],
		});

		const rc = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			creep.attackController(creep.room.controller)
		`);
		expect(rc).toBe(0);
	});
});
