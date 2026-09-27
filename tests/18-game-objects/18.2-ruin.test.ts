import {
	describe, test, expect, code,
	OK,
	CARRY, MOVE, ATTACK,
	RESOURCE_ENERGY,
	RUIN_DECAY, RUIN_DECAY_STRUCTURES,
	FIND_RUINS, FIND_DROPPED_RESOURCES, ATTACK_POWER,
	STRUCTURE_CONTAINER, body,
	STRUCTURE_POWER_BANK,
} from '../../src/index.js';

describe('Ruin', () => {
	test('RUIN-001 a ruin exposes structureType, destroyTime, store, and decay timer', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const ruinId = await shard.placeRuin('W1N1', {
			pos: [25, 25],
			structureType: STRUCTURE_CONTAINER,
			store: { energy: 100 },
			ticksToDecay: 400,
		});
		await shard.tick();

		const ruin = await shard.expectObject(ruinId, 'ruin');
		expect(ruin.structureType).toBe(STRUCTURE_CONTAINER);
		expect(typeof ruin.destroyTime).toBe('number');
		// Seeded relative to placement; one tick has elapsed.
		expect(ruin.ticksToDecay).toBe(399);
		expect(ruin.store.energy).toBe(100);
	});

	test('RUIN-002:container a destroyed structure with no RUIN_DECAY_STRUCTURES entry leaves a RUIN_DECAY ruin', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		expect(RUIN_DECAY_STRUCTURES[STRUCTURE_CONTAINER]).toBeUndefined();
		const containerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_CONTAINER,
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${containerId}).destroy()
		`);
		expect(rc).toBe(OK);

		// Stamped on the destroy tick; read one tick later.
		const ruin = await shard.runPlayer('p1', code`
			const r = Game.rooms['W1N1'].lookForAt(LOOK_RUINS, 25, 25)[0];
			r ? ({ structureType: r.structure.structureType, ticksToDecay: r.ticksToDecay }) : null
		`);
		expect(ruin).toEqual({ structureType: STRUCTURE_CONTAINER, ticksToDecay: RUIN_DECAY - 1 });
	});

	test('RUIN-002:powerBank a destroyed power bank leaves a ruin with its RUIN_DECAY_STRUCTURES decay', async ({ shard }) => {
		shard.requires('powerBank');
		await shard.ownedRoom('p1');
		const expectedDecay = RUIN_DECAY_STRUCTURES[STRUCTURE_POWER_BANK];
		expect(expectedDecay).toBeDefined();
		await shard.placeObject('W1N1', 'powerBank', {
			pos: [25, 25], power: 100, hits: 100,
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1', body: body(4, ATTACK, MOVE),
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const bank = Game.rooms['W1N1'].lookForAt(LOOK_STRUCTURES, 25, 25)[0];
			Game.getObjectById(${attackerId}).attack(bank)
		`);
		expect(rc).toBe(OK);

		// 4 ATTACK parts outhit the 100-hit bank on the attack tick; read one tick later.
		const ruin = await shard.runPlayer('p1', code`
			const r = Game.rooms['W1N1'].lookForAt(LOOK_RUINS, 25, 25)[0];
			r ? ({ structureType: r.structure.structureType, ticksToDecay: r.ticksToDecay }) : null
		`);
		expect(ruin).toEqual({ structureType: STRUCTURE_POWER_BANK, ticksToDecay: expectedDecay - 1 });
	});

	test('RUIN-003 ruin resources can be withdrawn', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const ruinId = await shard.placeRuin('W1N1', {
			pos: [25, 25],
			structureType: STRUCTURE_CONTAINER,
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

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store.energy).toBe(10);
	});

	test('RUIN-004 a structure destroyed by an attack leaves a ruin with its store in the same tick', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const stored = 50;
		// Two ATTACK parts take the container's last hits.
		const containerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_CONTAINER, hits: 2 * ATTACK_POWER, store: { energy: stored },
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: body(2, ATTACK, MOVE),
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${containerId}))
		`);
		expect(rc).toBe(OK);
		expect(await shard.getObject(containerId)).toBeNull();
		const ruins = await shard.findInRoom('W1N1', FIND_RUINS);
		expect(ruins.map(r => ({ pos: [r.pos.x, r.pos.y], structureType: r.structureType, store: r.store })))
			.toEqual([{ pos: [25, 25], structureType: STRUCTURE_CONTAINER, store: { energy: stored } }]);
	});

	test('RUIN-005 a ruin is removed when ticksToDecay reaches 0, leaving its store on the tile', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const stored = 50;
		const ruinId = await shard.placeRuin('W1N1', {
			pos: [25, 25],
			structureType: STRUCTURE_CONTAINER,
			ticksToDecay: 3,
			store: { energy: stored },
		});
		await shard.tick();

		const readings = [];
		for (let i = 0; i < 2; i++) {
			readings.push(await shard.runPlayer('p1', code`Game.getObjectById(${ruinId}).ticksToDecay`));
		}
		expect(readings).toEqual([2, 1]);
		// Removed during the tick that read 1; the fresh pile has not decayed yet.
		expect(await shard.getObject(ruinId)).toBeNull();
		const piles = await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES);
		expect(piles.map(p => ({ pos: [p.pos.x, p.pos.y], resourceType: p.resourceType, amount: p.amount })))
			.toEqual([{ pos: [25, 25], resourceType: RESOURCE_ENERGY, amount: stored }]);
	});

	test('RUIN-006 ruin ticksToDecay strictly decreases each tick', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const ruinId = await shard.placeRuin('W1N1', {
			pos: [25, 25],
			structureType: STRUCTURE_CONTAINER,
			ticksToDecay: 50,
		});
		await shard.tick();

		const r0 = await shard.expectObject(ruinId, 'ruin');
		await shard.tick();
		const r1 = await shard.expectObject(ruinId, 'ruin');
		await shard.tick();
		const r2 = await shard.expectObject(ruinId, 'ruin');

		expect(r1.ticksToDecay).toBe(r0.ticksToDecay - 1);
		expect(r2.ticksToDecay).toBe(r1.ticksToDecay - 1);
	});

	test('RUIN-007 ruin.structure exposes destroyed structure identity, hits, and ownership', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const ruinId = await shard.placeRuin('W1N1', {
			pos: [25, 25],
			structureType: STRUCTURE_CONTAINER,
			structureHitsMax: 250000,
			structureOwner: 'p1',
			store: { [RESOURCE_ENERGY]: 100 },
			ticksToDecay: 400,
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const ruin = Game.getObjectById(${ruinId});
			const structure = ruin.structure;
			({
				id: structure.id,
				hits: structure.hits,
				hitsMax: structure.hitsMax,
				structureType: structure.structureType,
				owner: structure.owner.username,
				expectedOwner: Game.rooms['W1N1'].controller.owner.username,
				my: structure.my,
			})
		`) as {
			id: string;
			hits: number;
			hitsMax: number;
			structureType: string;
			owner: string;
			expectedOwner: string;
			my: boolean;
		};

		expect(result.id).toEqual(expect.any(String));
		expect(result.id.length).toBeGreaterThan(0);
		expect(result.hits).toBe(0);
		expect(result.hitsMax).toBe(250000);
		expect(result.structureType).toBe(STRUCTURE_CONTAINER);
		expect(result.owner).toBe(result.expectedOwner);
		expect(result.my).toBe(true);
	});
});
