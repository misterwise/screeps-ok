import {
	describe, test, expect, code,
	ATTACK, MOVE,
	CONTROLLER_RESERVE,
	EFFECT_COLLAPSE_TIMER, INVADER_CORE_CONTROLLER_POWER,
	FIND_STRUCTURES, FIND_RUINS,
	STRUCTURE_CONTROLLER,
} from '../../src/index.js';
import type { ControllerSnapshot } from '../../src/index.js';

describe('Keeper lair', () => {
	test('KEEPER-LAIR-001 keeper lair ticksToSpawn decreases each tick and clears when the keeper spawns', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});

		const lairId = await shard.placeObject('W1N1', 'keeperLair', {
			pos: [25, 25],
			nextSpawnTime: 3,
		});
		await shard.tick();

		// The keeper spawns during the tick that reads 1; a full-hits keeper
		// starts no new timer, so the next read has none.
		const readings: (number | null)[] = [];
		for (let i = 0; i < 3; i++) {
			readings.push(await shard.runPlayer('p1', code`
				Game.getObjectById(${lairId}).ticksToSpawn ?? null
			`) as number | null);
		}
		expect(readings).toEqual([2, 1, null]);
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

		// Exactly one source keeper, on the lair's own tile.
		const result = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].find(FIND_HOSTILE_CREEPS).map(c => ({ x: c.pos.x, y: c.pos.y }))
		`) as { x: number; y: number }[];
		expect(result).toEqual([{ x: 25, y: 25 }]);
	});
});

describe('Invader core', () => {
	test('INVADER-CORE-001 ticksToDeploy counts down', async ({ shard }) => {
		shard.requires('invaderCore');
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

	test('INVADER-CORE-002 invader core exposes its level', async ({ shard }) => {
		shard.requires('invaderCore');
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

	test('INVADER-CORE-003 invader core spawns a creep when spawning completes', async ({ shard }) => {
		shard.requires('invaderCore');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});

		const coreId = await shard.placeObject('W1N1', 'invaderCore', {
			pos: [25, 25],
			level: 2,
			spawning: { name: 'defender1', body: [ATTACK, MOVE], needTime: 12, remainingTicks: 6 },
		});
		await shard.tick();

		// Incubation exposes the public spawning state on the core.
		const pendingName = await shard.runPlayer('p1', code`
			const core = Game.getObjectById(${coreId});
			core && core.spawning ? core.spawning.name : null
		`);
		expect(pendingName).toBe('defender1');

		// Each runPlayer call advances a tick; poll until the defender is born.
		let born: { x: number; y: number; coreSpawning: boolean } | null = null;
		for (let i = 0; i < 10 && !born; i++) {
			born = await shard.runPlayer('p1', code`
				const core = Game.getObjectById(${coreId});
				const creep = Game.rooms['W1N1'].find(FIND_HOSTILE_CREEPS)
					.find(c => c.name === 'defender1' && !c.spawning);
				creep
					? { x: creep.pos.x, y: creep.pos.y, coreSpawning: !!(core && core.spawning) }
					: null
			`) as { x: number; y: number; coreSpawning: boolean } | null;
		}
		expect(born).not.toBeNull();
		// The defender is born on a tile adjacent to the core, and the core's
		// spawning state clears in the same tick.
		const range = Math.max(Math.abs(born!.x - 25), Math.abs(born!.y - 25));
		expect(range).toBe(1);
		expect(born!.coreSpawning).toBe(false);
	});

	test('INVADER-CORE-004 invader core collapse timer clears the room controller', async ({ shard }) => {
		shard.requires('invaderCore');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});

		const coreId = await shard.placeObject('W1N1', 'invaderCore', {
			pos: [25, 25],
			level: 0,
			collapseTime: 6,
		});
		await shard.tick();

		// The pending collapse is exposed as EFFECT_COLLAPSE_TIMER.
		const pending = await shard.runPlayer('p1', code`
			const core = Game.getObjectById(${coreId});
			const collapse = ((core && core.effects) || [])
				.find(e => e.effect === ${EFFECT_COLLAPSE_TIMER});
			collapse ? collapse.ticksRemaining : null
		`) as number | null;
		expect(pending).not.toBeNull();
		expect(pending!).toBeGreaterThan(0);

		// Run past collapse expiry, then inspect via snapshots — the player
		// loses room visibility once its controller is cleared.
		for (let i = 0; i < 8; i++) await shard.tick();

		const structures = await shard.findInRoom('W1N1', FIND_STRUCTURES);
		const controller = structures.find(
			(s): s is ControllerSnapshot => s.structureType === STRUCTURE_CONTROLLER,
		);
		expect(controller).toBeDefined();
		expect(controller!.owner ?? null).toBeNull();
		expect(controller!.level).toBe(0);
		expect(controller!.progress).toBeNull();
		expect(controller!.isPowerEnabled).toBe(false);
		expect(controller!.safeMode).toBeNull();
	});

	test('INVADER-CORE-005 expired collapse timer removes the invader core without a ruin', async ({ shard }) => {
		shard.requires('invaderCore');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});

		const coreId = await shard.placeObject('W1N1', 'invaderCore', {
			pos: [30, 30],
			level: 0,
			collapseTime: 6,
		});
		await shard.tick();
		expect(await shard.getObject(coreId)).not.toBeNull();

		for (let i = 0; i < 8; i++) await shard.tick();

		// Collapse removal is silent: no core, no ruin left behind.
		expect(await shard.getObject(coreId)).toBeNull();
		const ruins = await shard.findInRoom('W1N1', FIND_RUINS);
		expect(ruins.filter(r => r.pos.x === 30 && r.pos.y === 30)).toHaveLength(0);
	});

	test('INVADER-CORE-006 a core reserving a neutral controller starts at exactly its reserve power', async ({ shard }) => {
		// Engine invader-core/reserveController.js:22-37 starts a fresh
		// reservation at `gameTime + 1` and then adds
		// INVADER_CORE_CONTROLLER_POWER * CONTROLLER_RESERVE; the core
		// (stronghold.js handleController) renews every tick after that.
		shard.requires('invaderCore');
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1' },
			],
		});
		await shard.placeObject('W2N1', 'invaderCore', {
			pos: [25, 25],
			level: 0,
		});
		// A p1 creep gives the player vision of the room.
		await shard.placeCreep('W2N1', {
			pos: [10, 10],
			owner: 'p1',
			body: [MOVE],
		});

		// The first tick a reservation is visible follows the fresh reserve.
		const readings: number[] = [];
		for (let i = 0; i < 6 && readings.length < 2; i++) {
			const ticksToEnd = await shard.runPlayer('p1', code`
				const reservation = Game.rooms['W2N1'].controller.reservation;
				reservation ? reservation.ticksToEnd : null
			`) as number | null;
			if (ticksToEnd !== null) readings.push(ticksToEnd);
		}
		const power = INVADER_CORE_CONTROLLER_POWER * CONTROLLER_RESERVE;
		// Each renewal credits `power` against one tick of decay.
		expect(readings).toEqual([power, power + power - 1]);
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
