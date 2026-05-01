import { describe, test, expect, code, OK, CARRY, MOVE, ATTACK, RUIN_DECAY, RUIN_DECAY_STRUCTURES, FIND_RUINS, STRUCTURE_WALL, body } from '../../src/index.js';

describe('Ruin', () => {
	test('RUIN-001 a ruin exposes structureType, destroyTime, store, and decay timer', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const ruinId = await shard.placeRuin('W1N1', {
			pos: [25, 25],
			structureType: 'container',
			store: { energy: 100 },
			ticksToDecay: 400,
		});
		await shard.tick();

		const ruin = await shard.expectObject(ruinId, 'ruin');
		expect(ruin.structureType).toBe('container');
		expect(typeof ruin.destroyTime).toBe('number');
		expect(ruin.ticksToDecay).toBeGreaterThan(0);
		expect(ruin.store.energy).toBeGreaterThan(0);
	});

	test('RUIN-002 ruin decay time matches RUIN_DECAY_STRUCTURES when present and RUIN_DECAY otherwise', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});

		// A powerBank has an entry in RUIN_DECAY_STRUCTURES (10 ticks).
		// A container does not — it should use the generic RUIN_DECAY (500 ticks).
		const expectedSpecial = RUIN_DECAY_STRUCTURES['powerBank'];
		expect(expectedSpecial).toBeDefined();

		const ruinWithEntry = await shard.placeRuin('W1N1', {
			pos: [25, 25],
			structureType: 'powerBank',
			ticksToDecay: expectedSpecial,
		});
		const ruinGeneric = await shard.placeRuin('W1N1', {
			pos: [26, 25],
			structureType: 'container',
			ticksToDecay: RUIN_DECAY,
		});
		await shard.tick();

		const specialRuin = await shard.expectObject(ruinWithEntry, 'ruin');
		const genericRuin = await shard.expectObject(ruinGeneric, 'ruin');

		expect(specialRuin.ticksToDecay).toBeLessThanOrEqual(expectedSpecial);
		expect(specialRuin.ticksToDecay).toBeGreaterThan(0);

		// container has no entry — uses generic RUIN_DECAY.
		expect(RUIN_DECAY_STRUCTURES['container']).toBeUndefined();
		expect(genericRuin.ticksToDecay).toBeLessThanOrEqual(RUIN_DECAY);
		expect(genericRuin.ticksToDecay).toBeGreaterThan(0);
	});

	test('RUIN-003 ruin resources can be withdrawn', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const ruinId = await shard.placeRuin('W1N1', {
			pos: [25, 25],
			structureType: 'container',
			store: { energy: 100 },
			ticksToDecay: 400,
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [CARRY, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).withdraw(Game.getObjectById(${ruinId}), RESOURCE_ENERGY, 10)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store.energy).toBe(10);
	});

	test('RUIN-004 destroying a structure creates a ruin at its position in the same tick', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const wallId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_WALL, hits: 1,
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: body(2, ATTACK, MOVE),
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${wallId}))
		`);

		const ruins = await shard.findInRoom('W1N1', FIND_RUINS);
		const ruin = ruins.find(r => r.pos.x === 25 && r.pos.y === 25);
		expect(ruin).toBeDefined();
		expect(ruin!.structureType).toBe('constructedWall');
	});

	test('RUIN-005 ruin is removed when ticksToDecay reaches 0', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const ruinId = await shard.placeRuin('W1N1', {
			pos: [25, 25],
			structureType: 'container',
			ticksToDecay: 2,
		});
		await shard.tick();

		const ruin = await shard.getObject(ruinId);
		expect(ruin).not.toBeNull();

		await shard.tick();
		await shard.tick();
		await shard.tick();

		const gone = await shard.getObject(ruinId);
		expect(gone).toBeNull();
	});

	test('RUIN-006 ruin ticksToDecay strictly decreases each tick', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const ruinId = await shard.placeRuin('W1N1', {
			pos: [25, 25],
			structureType: 'container',
			ticksToDecay: 50,
		});
		await shard.tick();

		const r0 = await shard.expectObject(ruinId, 'ruin');
		await shard.tick();
		const r1 = await shard.expectObject(ruinId, 'ruin');
		await shard.tick();
		const r2 = await shard.expectObject(ruinId, 'ruin');

		expect(r1.ticksToDecay).toBeLessThan(r0.ticksToDecay);
		expect(r2.ticksToDecay).toBeLessThan(r1.ticksToDecay);
	});
});
