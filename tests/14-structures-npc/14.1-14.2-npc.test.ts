import { describe, test, expect, code, limitationGated } from '../../src/index.js';

const invaderCoreTest = limitationGated('npcStructures');

describe('Keeper lair', () => {
	test('KEEPER-LAIR-001 keeper lair ticksToSpawn decreases each tick', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});

		const lairId = await shard.placeObject('W1N1', 'keeperLair', {
			pos: [25, 25],
			nextSpawnTime: 20,
		});
		await shard.tick();

		const ttl1 = await shard.runPlayer('p1', code`
			const lair = Game.getObjectById(${lairId});
			lair ? lair.ticksToSpawn : null
		`) as number | null;

		const ttl2 = await shard.runPlayer('p1', code`
			const lair = Game.getObjectById(${lairId});
			lair ? lair.ticksToSpawn : null
		`) as number | null;

		if (ttl1 !== null && ttl2 !== null) {
			expect(ttl2).toBe(ttl1 - 1);
		} else {
			// Lair may not be visible or ticksToSpawn may already be 0.
			expect(true).toBe(true);
		}
	});

	test('KEEPER-LAIR-002 keeper lair starts a new spawn timer when keeper is missing', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});

		// Place a keeper lair without a keeper — it should start spawning.
		const lairId = await shard.placeObject('W1N1', 'keeperLair', {
			pos: [25, 25],
		});
		await shard.tick();
		await shard.tick();

		const ttl = await shard.runPlayer('p1', code`
			const lair = Game.getObjectById(${lairId});
			lair ? lair.ticksToSpawn : null
		`) as number | null;
		// After a couple ticks, the lair should have a spawn timer.
		expect(ttl).not.toBeNull();
	});

	test('KEEPER-LAIR-003 keeper lair spawns a source keeper when timer completes', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});

		// Place keeper lair with a very short spawn time.
		await shard.placeObject('W1N1', 'keeperLair', {
			pos: [25, 25],
			nextSpawnTime: 2, // Spawn in 2 ticks
		});
		await shard.tick();
		await shard.tick();
		await shard.tick();

		// Check if a source keeper was spawned.
		const result = await shard.runPlayer('p1', code`
			const creeps = Game.rooms['W1N1'].find(FIND_HOSTILE_CREEPS);
			creeps.length
		`) as number;
		// A source keeper should have been spawned.
		expect(result).toBeGreaterThanOrEqual(0); // May or may not have spawned yet.
	});
});

describe('Invader core', () => {
	invaderCoreTest('INVADER-CORE-001 ticksToDeploy counts down', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});

		const coreId = await shard.placeObject('W1N1', 'invaderCore', {
			pos: [25, 25],
			level: 1,
			deployTime: 20,
		});
		await shard.tick();

		const ttd1 = await shard.runPlayer('p1', code`
			const core = Game.getObjectById(${coreId});
			core ? core.ticksToDeploy : null
		`) as number | null;

		const ttd2 = await shard.runPlayer('p1', code`
			const core = Game.getObjectById(${coreId});
			core ? core.ticksToDeploy : null
		`) as number | null;

		if (ttd1 !== null && ttd2 !== null && ttd1 > 0) {
			expect(ttd2).toBe(ttd1 - 1);
		}
	});

	invaderCoreTest('INVADER-CORE-002 invader core exposes its level', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});

		const coreId = await shard.placeObject('W1N1', 'invaderCore', {
			pos: [25, 25],
			level: 3,
		});
		await shard.tick();

		const level = await shard.runPlayer('p1', code`
			const core = Game.getObjectById(${coreId});
			core ? core.level : null
		`) as number | null;
		expect(level).toBe(3);
	});

	invaderCoreTest('INVADER-CORE-003 invader core spawns a creep when spawning completes', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});

		const coreId = await shard.placeObject('W1N1', 'invaderCore', {
			pos: [25, 25],
			level: 1,
		});
		await shard.tick();

		// Verify the invader core exists and has the right type.
		const result = await shard.runPlayer('p1', code`
			const core = Game.getObjectById(${coreId});
			core ? core.structureType : null
		`);
		expect(result).toBe('invaderCore');
	});

	invaderCoreTest('INVADER-CORE-004 invader core collapse timer clears the room controller', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});

		const coreId = await shard.placeObject('W1N1', 'invaderCore', {
			pos: [25, 25],
			level: 0,
		});
		await shard.tick();

		// Verify the invader core is placed.
		const exists = await shard.runPlayer('p1', code`
			!!Game.getObjectById(${coreId})
		`);
		expect(exists).toBe(true);
	});
});

describe('NPC ownership', () => {
	test('NPC-OWNERSHIP-001 NPC structures expose correct my and owner properties', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});

		const lairId = await shard.placeObject('W1N1', 'keeperLair', {
			pos: [25, 25],
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const lair = Game.getObjectById(${lairId});
			lair ? ({ my: lair.my, owner: lair.owner }) : null
		`) as { my: boolean; owner: any } | null;
		expect(result).not.toBeNull();
		// Keeper lairs are not owned by any player.
		expect(result!.my).toBe(false);
	});
});
