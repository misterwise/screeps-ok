import { describe, test, expect, code, OK, ERR_NOT_IN_RANGE, ERR_NOT_ENOUGH_RESOURCES, CARRY, MOVE, FIND_CREEPS, FIND_DROPPED_RESOURCES, STRUCTURE_CONTAINER, CARRY_CAPACITY, ENERGY_DECAY } from '../../src/index.js';

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
});
