import { describe, test, expect, code,
	OK, ERR_NOT_ENOUGH_RESOURCES,
	MOVE, CARRY,
	STRUCTURE_CONTAINER, RESOURCE_ENERGY,
	CARRY_CAPACITY, ENERGY_DECAY,
	FIND_DROPPED_RESOURCES,
} from '../../src/index.js';

// A pile's amount after one tick of decay.
const decayed = (amount: number) => amount - Math.ceil(amount / ENERGY_DECAY);

describe('Same-tick resource intent visibility', () => {
	test('INTENT-RESOURCE-001 withdrawn resources are not available to the same tick\'s drop', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const stored = 5 * CARRY_CAPACITY;
		const containerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_CONTAINER,
			store: { [RESOURCE_ENERGY]: stored },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [CARRY, CARRY, MOVE],
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			const withdrawRc = creep.withdraw(Game.getObjectById(${containerId}), RESOURCE_ENERGY);
			({ withdrawRc, dropRc: creep.drop(RESOURCE_ENERGY) })
		`);
		expect(result).toEqual({ withdrawRc: OK, dropRc: ERR_NOT_ENOUGH_RESOURCES });

		const creep = await shard.expectObject(creepId, 'creep');
		const container = await shard.expectStructure(containerId, STRUCTURE_CONTAINER);
		expect(creep.store.energy).toBe(2 * CARRY_CAPACITY);
		expect(container.store.energy).toBe(stored - 2 * CARRY_CAPACITY);
		expect(await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES)).toEqual([]);
	});

	test('INTENT-RESOURCE-002 transfer changes neither store during the calling tick and both the next', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const senderId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { [RESOURCE_ENERGY]: CARRY_CAPACITY },
		});
		const recipientId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [CARRY, MOVE],
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const sender = Game.getObjectById(${senderId});
			const recipient = Game.getObjectById(${recipientId});
			const rc = sender.transfer(recipient, RESOURCE_ENERGY);
			({ rc, sender: sender.store[RESOURCE_ENERGY], recipient: recipient.store[RESOURCE_ENERGY] })
		`);
		expect(result).toEqual({ rc: OK, sender: CARRY_CAPACITY, recipient: 0 });

		const next = await shard.runPlayer('p1', code`
			({
				sender: Game.getObjectById(${senderId}).store[RESOURCE_ENERGY],
				recipient: Game.getObjectById(${recipientId}).store[RESOURCE_ENERGY],
			})
		`);
		expect(next).toEqual({ sender: 0, recipient: CARRY_CAPACITY });
	});

	test('INTENT-RESOURCE-003 a transfer and a drop of the whole load both return OK and the drop resolves first', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const containerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_CONTAINER,
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [CARRY, MOVE],
			store: { [RESOURCE_ENERGY]: CARRY_CAPACITY },
		});
		await shard.tick();

		// Called in the other order: the spend order is the engine's, not the calls'.
		const result = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			({
				transferRc: creep.transfer(Game.getObjectById(${containerId}), RESOURCE_ENERGY, ${CARRY_CAPACITY}),
				dropRc: creep.drop(RESOURCE_ENERGY, ${CARRY_CAPACITY}),
			})
		`);
		expect(result).toEqual({ transferRc: OK, dropRc: OK });

		const creep = await shard.expectObject(creepId, 'creep');
		const container = await shard.expectStructure(containerId, STRUCTURE_CONTAINER);
		expect(creep.store.energy ?? 0).toBe(0);
		expect(container.store.energy ?? 0).toBe(0);
		const piles = await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES);
		expect(piles.map(pile => ({ x: pile.pos.x, y: pile.pos.y, amount: pile.amount })))
			.toEqual([{ x: 25, y: 26, amount: decayed(CARRY_CAPACITY) }]);
	});

	test('INTENT-RESOURCE-004 withdraw resolves before a same-tick pickup, which takes the capacity left', async ({ shard }) => {
		await shard.ownedRoom('p1');
		// Two CARRY parts: the withdraw fills 60 of the 100, leaving the pickup 40.
		const capacity = 2 * CARRY_CAPACITY;
		const withdrawn = 60;
		const containerId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_CONTAINER,
			store: { [RESOURCE_ENERGY]: withdrawn },
		});
		const pileId = await shard.placeDroppedResource('W1N1', {
			pos: [24, 25], resourceType: RESOURCE_ENERGY, amount: capacity,
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, CARRY, MOVE],
		});
		await shard.tick();

		// Called pickup first: the engine resolves withdraw first regardless.
		const result = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			const pile = Game.getObjectById(${pileId});
			({
				pile: pile.amount,
				pickupRc: creep.pickup(pile),
				withdrawRc: creep.withdraw(Game.getObjectById(${containerId}), RESOURCE_ENERGY),
			})
		`) as { pile: number; pickupRc: number; withdrawRc: number };
		expect(result).toEqual({ pile: decayed(capacity), pickupRc: OK, withdrawRc: OK });

		const creep = await shard.expectObject(creepId, 'creep');
		const container = await shard.expectStructure(containerId, STRUCTURE_CONTAINER);
		expect(creep.store.energy).toBe(capacity);
		expect(container.store.energy ?? 0).toBe(0);
		const piles = await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES);
		expect(piles.map(pile => pile.amount)).toEqual([decayed(result.pile - (capacity - withdrawn))]);
	});
});
