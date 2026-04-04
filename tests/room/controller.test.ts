import { describe, test, expect, code, OK, CLAIM, MOVE } from '../../src/index.js';

describe('controller mechanics', () => {
	test('claimController returns OK and sets the unowned controller to level 1 for the claimant', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1' }, // unowned
			],
		});
		const ctrlPos = await shard.getControllerPos('W2N1');
		expect(ctrlPos).not.toBeNull();

		const creepId = await shard.placeCreep('W2N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body: [CLAIM, MOVE],
		});
		expect (creepId).not.toBeNull();

		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			const ctrl = creep.room.controller;
			creep.claimController(ctrl)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const ctrl = Game.rooms['W2N1'].controller;
			({ level: ctrl.level, my: ctrl.my })
		`) as { level: number; my: boolean };
		expect(result).toEqual({ level: 1, my: true });
	});

	test('signController writes the provided text to the controller sign', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const ctrlPos = await shard.getControllerPos('W1N1');

		const creepId = await shard.placeCreep('W1N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body: [MOVE],
		});

		const rc = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			creep.signController(creep.room.controller, 'screeps-ok was here')
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const sign = await shard.runPlayer('p1', code`
			const actor = Game.getObjectById(${creepId});
			const sign = Game.rooms['W1N1'].controller.sign;
			sign ? ({
				text: sign.text,
				owner: sign.username ?? sign.owner?.username ?? sign.owner,
				expectedOwner: actor.owner.username,
			}) : null
		`) as { text: string; owner: string; expectedOwner: string } | null;
		expect(sign).toEqual({
			text: 'screeps-ok was here',
			owner: sign?.expectedOwner,
			expectedOwner: sign?.expectedOwner,
		});
	});

	test('reserveController returns OK and creates a reservation for the player', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1' },
			],
		});
		const ctrlPos = await shard.getControllerPos('W2N1');

		const creepId = await shard.placeCreep('W2N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body: [CLAIM, CLAIM, MOVE],
		});

		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			creep.reserveController(creep.room.controller)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const reservation = await shard.runPlayer('p1', code`
			const actor = Game.getObjectById(${creepId});
			const reservation = Game.rooms['W2N1'].controller.reservation;
			reservation ? ({
				owner: reservation.username ?? reservation.owner?.username ?? reservation.owner,
				expectedOwner: actor.owner.username,
				ticksToEnd: reservation.ticksToEnd,
			}) : null
		`) as { owner: string; expectedOwner: string; ticksToEnd: number } | null;
		expect(reservation).not.toBeNull();
		expect(reservation?.owner).toBe(reservation?.expectedOwner);
		expect((reservation?.ticksToEnd ?? 0)).toBeGreaterThan(0);
	});

	test('attackController reduces the hostile controller downgrade timer', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const ctrlPos = await shard.getControllerPos('W2N1');

		const creepId = await shard.placeCreep('W2N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body: [CLAIM, MOVE],
		});

		await shard.tick();

		const before = await shard.runPlayer('p1', code`
			Game.rooms['W2N1'].controller.ticksToDowngrade
		`) as number;

		const rc = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			creep.attackController(creep.room.controller)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const after = await shard.runPlayer('p1', code`
			Game.rooms['W2N1'].controller.ticksToDowngrade
		`) as number;
		expect(after).toBeLessThan(before);
	});
});
