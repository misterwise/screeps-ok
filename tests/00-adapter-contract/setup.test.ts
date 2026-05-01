import { describe, test, expect, code, MOVE, CARRY, WORK, ATTACK, CLAIM, FIND_CREEPS, FIND_STRUCTURES, FIND_SOURCES, FIND_MINERALS, STRUCTURE_SPAWN, STRUCTURE_CONTAINER, STRUCTURE_ROAD, STRUCTURE_RAMPART, STRUCTURE_CONTROLLER, STRUCTURE_KEEPER_LAIR, STRUCTURE_INVADER_CORE, STRUCTURE_POWER_BANK, RESOURCE_ENERGY, CARRY_CAPACITY, CONTAINER_HITS, PWR_OPERATE_LAB, ERR_GCL_NOT_ENOUGH, CONSTRUCTION_COST, CONTROLLER_DOWNGRADE, CONTROLLER_LEVELS, CONTAINER_DECAY_TIME, CONTAINER_DECAY_TIME_OWNED, ROAD_DECAY_TIME, RAMPART_DECAY_TIME } from '../../src/index.js';
import {
	TERRAIN_FIXTURE_ROOM, TERRAIN_FIXTURE_SPEC, TERRAIN_FIXTURE_LANDMARKS,
} from '../../src/terrain-fixture.js';

describe('adapter contract: setup', () => {
	describe('createShard', () => {
		test('creates a shard with one player and one room', async ({ shard }) => {
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1' }],
			});
			const time = await shard.getGameTime();
			expect(typeof time).toBe('number');
		});

		test('creates multiple players', async ({ shard }) => {
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
			});
			// Both players can run code
			const r1 = await shard.runPlayer('p1', code`1 + 1`);
			const r2 = await shard.runPlayer('p2', code`2 + 2`);
			expect(r1).toBe(2);
			expect(r2).toBe(4);
		});

		test('creates multiple rooms', async ({ shard }) => {
			await shard.createShard({
				players: ['p1'],
				rooms: [
					{ name: 'W1N1', rcl: 1, owner: 'p1' },
					{ name: 'W2N1' },
				],
			});
			// Verify both rooms exist by placing objects in each
			const id1 = await shard.placeSource('W1N1', { pos: [10, 10] });
			const id2 = await shard.placeSource('W2N1', { pos: [10, 10] });
			await shard.tick();
			expect(await shard.getObject(id1)).not.toBeNull();
			expect(await shard.getObject(id2)).not.toBeNull();
		});

		test('sets room ownership and RCL', async ({ shard }) => {
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1', rcl: 4, owner: 'p1' }],
			});
			// Verify ownership via runPlayer — the player should see the room
			const result = await shard.runPlayer('p1', code`
				const room = Game.rooms['W1N1'];
				({
					hasRoom: !!room,
					level: room?.controller?.level,
					my: room?.controller?.my,
				})
			`);
			expect((result as any).hasRoom).toBe(true);
			expect((result as any).level).toBe(4);
			expect((result as any).my).toBe(true);
		});

		test('owned controller snapshot exposes default downgrade timer and progressTotal', async ({ shard }) => {
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
			});

			const structures = await shard.findInRoom('W1N1', FIND_STRUCTURES);
			const controller = structures.find(s => s.structureType === STRUCTURE_CONTROLLER);
			expect(controller).toMatchObject({
				ticksToDowngrade: CONTROLLER_DOWNGRADE[1],
				progressTotal: CONTROLLER_LEVELS[1],
			});
		});

		test('default room layout is canonical and sparse', async ({ shard }) => {
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1' }],
			});
			await shard.tick();

			const ctrlPos = await shard.getControllerPos('W1N1');
			const structures = await shard.findInRoom('W1N1', FIND_STRUCTURES);
			const sources = await shard.findInRoom('W1N1', FIND_SOURCES);
			const minerals = await shard.findInRoom('W1N1', FIND_MINERALS);

			expect(ctrlPos).toEqual({ x: 1, y: 1 });
			expect(structures).toHaveLength(1);
			expect(structures[0]).toMatchObject({
				kind: 'structure',
				structureType: 'controller',
			});
			expect(sources).toEqual([]);
			expect(minerals).toEqual([]);
		});

		test('getControllerPos returns null for rooms without a controller', async ({ shard }) => {
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1' }],
			});

			await expect(shard.getControllerPos('W9N9')).resolves.toBeNull();
		});

		test('PlayerSpec.gcl override is honored at user creation (gates extra claims)', async ({ shard }) => {
			// Contract: when a player spec sets a low `gcl`, the adapter must
			// write that value into the engine's user record so Game.gcl.level
			// reflects it. The cheapest end-to-end probe is the engine's own
			// claim cap: with gcl=0 the player can own at most 1 room, so a
			// second claimController() must return ERR_GCL_NOT_ENOUGH.
			await shard.createShard({
				players: [{ name: 'p1', gcl: 0 }],
				rooms: [
					{ name: 'W1N1', rcl: 1, owner: 'p1' },
					{ name: 'W2N1' },
				],
			});
			const ctrlPos = await shard.getControllerPos('W2N1');
			const creepId = await shard.placeCreep('W2N1', {
				pos: [ctrlPos!.x + 1, ctrlPos!.y],
				owner: 'p1',
				body: [CLAIM, MOVE],
			});
			await shard.tick();

			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${creepId}).claimController(
					Game.rooms['W2N1'].controller
				)
			`);
			expect(rc).toBe(ERR_GCL_NOT_ENOUGH);
		});

		// Spec §Terrain: "setTerrain() is part of the contract, but adapters
		// may reject it when the engine cannot mutate terrain after shard
		// creation. If so, the failure must be explicit and actionable."
		// Silent no-op (resolving without mutating) is a contract violation —
		// downstream tests would build on stale terrain assumptions.
		test('setTerrain after first tick either succeeds or throws explicitly', async ({ shard }) => {
			shard.requires('terrain', 'setTerrain post-tick contract requires terrain capability');
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
			});
			await shard.tick(); // arm any "first makeRuntime" caches

			const wallTerrain = new Array<0 | 1 | 2>(2500).fill(0);
			const wx = 25, wy = 25;
			wallTerrain[wy * 50 + wx] = 1; // TERRAIN_WALL

			let threw: Error | null = null;
			try {
				await shard.setTerrain('W1N1', wallTerrain);
			} catch (err) {
				threw = err as Error;
			}

			if (threw) {
				expect(threw.message.length).toBeGreaterThan(0);
				return;
			}

			// Resolved — must actually be observable via player APIs in the
			// next tick. PathFinder is the strict probe: a wall must force
			// a detour. If terrain only landed in the DB but the runtime
			// cache is stale, the path will go straight through.
			const result = await shard.runPlayer('p1', code`
				const wx = ${wx}, wy = ${wy};
				const terrain = Game.map.getRoomTerrain('W1N1');
				const result = PathFinder.search(
					new RoomPosition(wx - 1, wy, 'W1N1'),
					{ pos: new RoomPosition(wx + 1, wy, 'W1N1'), range: 0 },
					{ maxRooms: 1 },
				);
				const goesThroughWall = result.path.some(p => p.x === wx && p.y === wy);
				({ terrainMask: terrain.get(wx, wy), goesThroughWall })
			`) as { terrainMask: number; goesThroughWall: boolean };

			expect(result.terrainMask).toBe(1);
			expect(result.goesThroughWall).toBe(false);
		});

		test('terrain spec is honored end-to-end (room.getTerrain and PathFinder)', async ({ shard }) => {
			shard.requires('terrain', 'createShard.terrain spec is required for this contract test');
			// Contract: the terrain passed to createShard via RoomSpec.terrain
			// is observable to player code via Room.getTerrain AND respected
			// by PathFinder in the same tick the shard is created. Uses the
			// fixture room's isolatedWallTile — a single wall surrounded by
			// plains — so PathFinder must detour around it if the wall is
			// honored, and step through it if the wall is invisible.
			await shard.createShard({
				players: ['p1'],
				rooms: [
					{ name: 'W1N1', rcl: 1, owner: 'p1' },
					{ name: TERRAIN_FIXTURE_ROOM, terrain: TERRAIN_FIXTURE_SPEC },
				],
			});
			const [wx, wy] = TERRAIN_FIXTURE_LANDMARKS.isolatedWallTile;

			const result = await shard.runPlayer('p1', code`
				const wx = ${wx}, wy = ${wy};
				const terrain = Game.map.getRoomTerrain(${TERRAIN_FIXTURE_ROOM});
				// PathFinder.search across the wall: origin one tile west,
				// goal one tile east. Optimal Chebyshev path is 2 straight
				// RIGHT moves; if the wall is honored, the path must detour.
				// If the wall is invisible to the pathfinder, the returned
				// path will go straight through (wx, wy).
				const result = PathFinder.search(
					new RoomPosition(wx - 1, wy, ${TERRAIN_FIXTURE_ROOM}),
					{ pos: new RoomPosition(wx + 1, wy, ${TERRAIN_FIXTURE_ROOM}), range: 0 },
					{ maxRooms: 1 },
				);
				const goesThroughWall = result.path.some(p => p.x === wx && p.y === wy);
				({
					terrainMask: terrain.get(wx, wy),
					pathLen: result.path.length,
					goesThroughWall,
				})
			`) as { terrainMask: number; pathLen: number; goesThroughWall: boolean };

			// Wall must be readable through Room.getTerrain.
			expect(result.terrainMask).toBe(1);
			// Wall must block the pathfinder — the path must detour around it.
			expect(result.goesThroughWall).toBe(false);
		});
	});

	describe('default room terrain', () => {
		// Rooms without explicit RoomSpec.terrain must behave identically
		// across adapters: all-plain interior, all four exits open.
		test('default rooms have all-plain interior terrain', async ({ shard }) => {
			await shard.ownedRoom('p1');
			await shard.tick();

			const allPlain = await shard.runPlayer('p1', code`
				const t = Game.map.getRoomTerrain('W1N1');
				// Sample a grid of interior tiles (not edge tiles)
				let plain = true;
				for (const x of [5, 15, 25, 35, 45]) {
					for (const y of [5, 15, 25, 35, 45]) {
						if (t.get(x, y) !== 0) plain = false;
					}
				}
				plain
			`);
			expect(allPlain).toBe(true);
		});

		test('default rooms have all four exits open', async ({ shard }) => {
			await shard.ownedRoom('p1');
			await shard.tick();

			const exits = await shard.runPlayer('p1', code`
				Game.map.describeExits('W1N1')
			`) as Record<string, string>;
			expect(Object.keys(exits)).toHaveLength(4);
		});
	});

	describe('placeCreep', () => {
		test('places a creep and returns a valid ID', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const id = await shard.placeCreep('W1N1', {
				pos: [25, 25],
				owner: 'p1',
				body: [MOVE],
			});
			expect(typeof id).toBe('string');
			expect(id.length).toBeGreaterThan(0);
		});

		test('creep is retrievable by ID after tick', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const id = await shard.placeCreep('W1N1', {
				pos: [25, 25],
				owner: 'p1',
				body: [MOVE, CARRY, WORK],
			});
			await shard.tick();

			const creep = await shard.expectObject(id, 'creep');
			expect(creep.body).toHaveLength(3);
			expect(creep.owner).toBe('p1');
		});

		test('creep store is initialized', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const id = await shard.placeCreep('W1N1', {
				pos: [10, 10],
				owner: 'p1',
				body: [CARRY, MOVE],
				store: { energy: 25 },
			});
			await shard.tick();

			const creep = await shard.expectObject(id, 'creep');
			expect(creep.store.energy).toBe(25);
		});

		test('creep name is honored', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const id = await shard.placeCreep('W1N1', {
				pos: [25, 25],
				owner: 'p1',
				body: [MOVE],
				name: 'NamedCreep',
			});
			await shard.tick();

			const name = await shard.runPlayer('p1', code`
				Game.getObjectById(${id}).name
			`);
			expect(name).toBe('NamedCreep');
		});

		test('creep ticksToLive is honored', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const id = await shard.placeCreep('W1N1', {
				pos: [25, 25],
				owner: 'p1',
				body: [MOVE],
				ticksToLive: 500,
			});
			await shard.tick();

			const creep = await shard.expectObject(id, 'creep');
			// placeCreep(ttl: 500) + tick() = 1 tick consumed.
			// getObject observes without consuming a tick.
			expect(creep.ticksToLive).toBe(499);
		});

		test('creep is visible to bot code via Game.getObjectById', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const id = await shard.placeCreep('W1N1', {
				pos: [25, 25],
				owner: 'p1',
				body: [CARRY, MOVE],
				store: { energy: 25 },
			});
			await shard.tick();

			const result = await shard.runPlayer('p1', code`
				const c = Game.getObjectById(${id});
				c ? ({ hits: c.hits, carry: c.store.getUsedCapacity('energy') }) : null
			`);
			expect(result).not.toBeNull();
			expect((result as any).carry).toBe(25);
		});

		test('creep appears in findInRoom', async ({ shard }) => {
			await shard.ownedRoom('p1');
			await shard.placeCreep('W1N1', {
				pos: [25, 25],
				owner: 'p1',
				body: [MOVE],
			});
			await shard.tick();

			const creeps = await shard.findInRoom('W1N1', FIND_CREEPS);
			const placed = creeps.filter((c: any) => c.kind === 'creep');
			expect(placed.length).toBe(1);
		});

		test('srcKeeper NPC owner handle resolves without ShardSpec.players entry', async ({ shard }) => {
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1' }],
			});
			await shard.placeCreep('W1N1', {
				pos: [25, 25],
				owner: 'srcKeeper',
				body: [MOVE],
				name: 'SourceKeeperProbe',
			});
			await shard.tick();

			const creeps = await shard.findInRoom('W1N1', FIND_CREEPS);
			const creep = creeps.find(c => c.name === 'SourceKeeperProbe');
			expect(creep).toMatchObject({ owner: 'srcKeeper' });
		});

		test('spec.boosts tags the target body parts with the boost mineral', async ({ shard }) => {
			shard.requires('chemistry');
			await shard.ownedRoom('p1');
			// Body index 1 is ATTACK → boost with UH; index 2 is CARRY → boost
			// with KH (the only index combo that exercises a capacity boost).
			const id = await shard.placeCreep('W1N1', {
				pos: [25, 25],
				owner: 'p1',
				body: [MOVE, ATTACK, CARRY],
				boosts: { 1: 'UH', 2: 'KH' },
			});
			await shard.tick();

			const boosts = await shard.runPlayer('p1', code`
				Game.getObjectById(${id}).body.map(p => ({ type: p.type, boost: p.boost || null }))
			`);
			expect(boosts).toEqual([
				{ type: MOVE, boost: null },
				{ type: ATTACK, boost: 'UH' },
				{ type: CARRY, boost: 'KH' },
			]);
		});

		test('spec.boosts on a CARRY part extends the creep storeCapacity', async ({ shard }) => {
			shard.requires('chemistry');
			await shard.ownedRoom('p1');
			// Two CARRY parts, the second boosted with KH (×2 capacity). Total
			// capacity must reflect canonical formula: CARRY_CAPACITY × (1 + 2).
			const id = await shard.placeCreep('W1N1', {
				pos: [25, 25],
				owner: 'p1',
				body: [CARRY, CARRY],
				boosts: { 1: 'KH' },
			});
			await shard.tick();

			const capacity = await shard.runPlayer('p1', code`
				Game.getObjectById(${id}).store.getCapacity(RESOURCE_ENERGY)
			`);
			expect(capacity).toBe(CARRY_CAPACITY * 3);
		});

		test('spec.boosts keys target specific body indexes (no shift or reorder)', async ({ shard }) => {
			shard.requires('chemistry');
			await shard.ownedRoom('p1');
			// Three CARRY parts, indexes 0 and 2 boosted with different tiers.
			// Per-index boost tags AND the summed capacity are both asymmetric
			// across any index reordering, so together they pin the mapping.
			// Expected per index: KH (×2), unboosted, XKH2O (×4).
			// Expected capacity: CARRY_CAPACITY × (2 + 1 + 4) = 350.
			const id = await shard.placeCreep('W1N1', {
				pos: [25, 25],
				owner: 'p1',
				body: [CARRY, CARRY, CARRY],
				boosts: { 0: 'KH', 2: 'XKH2O' },
			});
			await shard.tick();

			const result = await shard.runPlayer('p1', code`
				const c = Game.getObjectById(${id});
				({
					boosts: c.body.map(p => p.boost || null),
					capacity: c.store.getCapacity(RESOURCE_ENERGY),
				})
			`);
			expect(result).toEqual({
				boosts: ['KH', null, 'XKH2O'],
				capacity: CARRY_CAPACITY * 7,
			});
		});
	});

	describe('placeStructure', () => {
		test('places a spawn', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const id = await shard.placeStructure('W1N1', {
				pos: [30, 30],
				structureType: STRUCTURE_SPAWN,
				owner: 'p1',
			});
			await shard.tick();

			const obj = await shard.getObject(id);
			expect(obj).not.toBeNull();
			expect(obj!.kind).toBe('structure');
		});

		test('places a container (unowned)', async ({ shard }) => {
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1' }],
			});
			const id = await shard.placeStructure('W1N1', {
				pos: [20, 20],
				structureType: STRUCTURE_CONTAINER,
			});
			await shard.tick();

			const obj = await shard.expectStructure(id, STRUCTURE_CONTAINER);
			expect(obj.structureType).toBe('container');
		});

		test('structure store is initialized', async ({ shard }) => {
			await shard.ownedRoom('p1');
			// Use a container: its store is not affected by per-tick processors
			// (unlike spawns, which regenerate 1 energy/tick when below capacity).
			const id = await shard.placeStructure('W1N1', {
				pos: [25, 25],
				structureType: STRUCTURE_CONTAINER,
				store: { energy: 200 },
			});
			await shard.tick();

			const result = await shard.runPlayer('p1', code`
				Game.getObjectById(${id}).store.getUsedCapacity('energy')
			`);
			expect(result).toBe(200);
		});

		test('structure hits is initialized', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const id = await shard.placeStructure('W1N1', {
				pos: [25, 25],
				structureType: STRUCTURE_CONTAINER,
				hits: 1000,
			});
			await shard.tick();

			const obj = await shard.expectStructure(id, STRUCTURE_CONTAINER);
			expect(obj.hits).toBe(1000);
		});

		// StructureSpec.ticksToDecay is part of the placement contract for any
		// decayable structure. Without it, decay-related tests cannot bound the
		// engine's default decay window (100..5000 ticks) into a runnable interval.
		// The contract is: the adapter must wire the spec value into whatever
		// engine field drives the structure's `ticksToDecay` getter so the
		// snapshot reflects the override on the very next tick.
		const decayableStructures = [
			{ type: STRUCTURE_CONTAINER, pos: [25, 25] as [number, number], owned: false },
			{ type: STRUCTURE_ROAD, pos: [26, 25] as [number, number], owned: false },
			{ type: STRUCTURE_RAMPART, pos: [27, 25] as [number, number], owned: true },
		];
		for (const { type, pos, owned } of decayableStructures) {
			test(`ticksToDecay override is honored for ${type}`, async ({ shard }) => {
				await shard.ownedRoom('p1');
				const id = await shard.placeStructure('W1N1', {
					pos,
					structureType: type,
					...(owned ? { owner: 'p1' } : {}),
					ticksToDecay: 5,
				});
				await shard.tick();

				const obj = await shard.expectStructure(id, type);
				// The placement tick may consume one tick from the timer, so allow
				// 4..5. If the adapter ignores the field, ticksToDecay will read
				// the engine default (>=99 for any decayable), failing this bound.
				expect((obj as { ticksToDecay: number }).ticksToDecay).toBeLessThanOrEqual(5);
				expect((obj as { ticksToDecay: number }).ticksToDecay).toBeGreaterThanOrEqual(3);
			});
		}

		const defaultDecayCases = [
			{ label: 'owned room container', room: 'W1N1', type: STRUCTURE_CONTAINER, pos: [25, 25] as [number, number], expected: CONTAINER_DECAY_TIME_OWNED },
			{ label: 'unowned room container', room: 'W2N1', type: STRUCTURE_CONTAINER, pos: [26, 25] as [number, number], expected: CONTAINER_DECAY_TIME },
			{ label: 'road', room: 'W1N1', type: STRUCTURE_ROAD, pos: [27, 25] as [number, number], expected: ROAD_DECAY_TIME },
			{ label: 'rampart', room: 'W1N1', type: STRUCTURE_RAMPART, pos: [28, 25] as [number, number], owner: 'p1', expected: RAMPART_DECAY_TIME },
		];
		for (const { label, room, type, pos, owner, expected } of defaultDecayCases) {
			test(`default ticksToDecay is canonical for ${label}`, async ({ shard }) => {
				await shard.createShard({
					players: ['p1'],
					rooms: [
						{ name: 'W1N1', rcl: 1, owner: 'p1' },
						{ name: 'W2N1' },
					],
				});

				const id = await shard.placeStructure(room, {
					pos,
					structureType: type,
					...(owner ? { owner } : {}),
				});

				const obj = await shard.expectStructure(id, type);
				expect(obj).toMatchObject({ ticksToDecay: expected });
			});
		}

		test('default decay schedule does not immediately destroy low-hit placements', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const specs = [
				{ type: STRUCTURE_CONTAINER, pos: [25, 25] as [number, number] },
				{ type: STRUCTURE_ROAD, pos: [26, 25] as [number, number] },
				{ type: STRUCTURE_RAMPART, pos: [27, 25] as [number, number], owner: 'p1' },
			];
			const ids = await Promise.all(specs.map(spec => shard.placeStructure('W1N1', {
				pos: spec.pos,
				structureType: spec.type,
				hits: 1,
				...(spec.owner ? { owner: spec.owner } : {}),
			})));

			await shard.tick();

			for (let i = 0; i < ids.length; i++) {
				const obj = await shard.expectStructure(ids[i], specs[i].type);
				expect(obj).toMatchObject({ hits: 1 });
			}
		});
	});

	// Per-player room visibility is a canonical Game API invariant, not an
	// adapter surface contract — covered by ROOM-VIS-001/002/003 in
	// tests/16-room-mechanics/16.3b-game-api.test.ts.

	describe('placeSite', () => {
		test('places a construction site', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const id = await shard.placeSite('W1N1', {
				pos: [25, 26],
				owner: 'p1',
				structureType: STRUCTURE_ROAD,
			});
			await shard.tick();

			const obj = await shard.expectObject(id, 'site');
			expect(obj.structureType).toBe('road');
			expect(obj.progress).toBe(0);
			expect(obj.progressTotal).toBe(CONSTRUCTION_COST[STRUCTURE_ROAD]);
		});
	});

	describe('placeSource', () => {
		test('places a source with default energy', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const id = await shard.placeSource('W1N1', {
				pos: [10, 10],
			});
			await shard.tick();

			const obj = await shard.expectObject(id, 'source');
			expect(obj.energyCapacity).toBe(3000);
			expect(obj.energy).toBe(3000);
		});

		test('places a depleted source', async ({ shard }) => {
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1' }],
			});
			const id = await shard.placeSource('W1N1', {
				pos: [10, 10],
				energy: 0,
				energyCapacity: 3000,
			});
			await shard.tick();

			const obj = await shard.expectObject(id, 'source');
			expect(obj.energy).toBe(0);
		});
	});

	describe('placeMineral', () => {
		test('places a mineral', async ({ shard }) => {
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1' }],
			});
			const id = await shard.placeMineral('W1N1', {
				pos: [40, 40],
				mineralType: 'H',
			});
			await shard.tick();

			const obj = await shard.expectObject(id, 'mineral');
			expect(obj.mineralType).toBe('H');
			expect(obj.mineralAmount).toBe(100000);
		});
	});

	describe('placeTombstone', () => {
		test('places a tombstone with creepName, store, and decay', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const id = await shard.placeTombstone('W1N1', {
				pos: [25, 25],
				creepName: 'fallen-hero',
				store: { energy: 50 },
				ticksToDecay: 100,
			});
			await shard.tick();

			const obj = await shard.expectObject(id, 'tombstone');
			expect(obj.creepName).toBe('fallen-hero');
			expect(obj.store.energy).toBe(50);
			expect(obj.ticksToDecay).toBeGreaterThan(0);
		});
	});

	describe('placeRuin', () => {
		test('places a ruin with structureType, store, and decay', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const id = await shard.placeRuin('W1N1', {
				pos: [25, 25],
				structureType: 'container',
				store: { energy: 75 },
				ticksToDecay: 200,
			});
			await shard.tick();

			const obj = await shard.expectObject(id, 'ruin');
			expect(obj.structureType).toBe('container');
			expect(obj.store.energy).toBe(75);
			expect(obj.ticksToDecay).toBeGreaterThan(0);
		});
	});

	describe('placeFlag', () => {
		test('places a flag retrievable by name in player code', async ({ shard }) => {
			await shard.ownedRoom('p1');
			await shard.placeFlag('W1N1', {
				pos: [25, 25],
				owner: 'p1',
				name: 'TestFlag',
				color: 1,
				secondaryColor: 2,
			});

			const result = await shard.runPlayer('p1', code`
				const flag = Game.flags['TestFlag'];
				flag ? ({
					name: flag.name,
					color: flag.color,
					secondaryColor: flag.secondaryColor,
					x: flag.pos.x,
					y: flag.pos.y,
				}) : null
			`);
			expect(result).not.toBeNull();
			expect((result as any).name).toBe('TestFlag');
			expect((result as any).color).toBe(1);
			expect((result as any).secondaryColor).toBe(2);
			expect((result as any).x).toBe(25);
			expect((result as any).y).toBe(25);
		});

		test('rejects flag names containing engine data delimiters', async ({ shard }) => {
			await shard.ownedRoom('p1');
			for (const name of ['Bad|Flag', 'Bad~Flag']) {
				let err: Error | null = null;
				try {
					await shard.placeFlag('W1N1', {
						pos: [25, 25],
						owner: 'p1',
						name,
					});
				} catch (e) {
					err = e as Error;
				}
				expect(err).not.toBeNull();
				expect(err!.message).toMatch(/[|~]/);
			}
		});
	});

	describe('placeDroppedResource', () => {
		test('places a dropped resource', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const id = await shard.placeDroppedResource('W1N1', {
				pos: [25, 25],
				resourceType: 'energy',
				amount: 100,
			});
			await shard.tick();

			const obj = await shard.expectObject(id, 'resource');
			expect(obj.resourceType).toBe('energy');
			// Contract test: verify placement round-trip, not decay behavior.
			// Amount may have decayed by ceil(100/1000)=1 during the tick.
			expect(obj.amount).toBeGreaterThan(0);
			expect(obj.amount).toBeLessThanOrEqual(100);
		});
	});

	describe('placePowerCreep', () => {
		test('places a power creep with specified powers accessible via Game.powerCreeps', async ({ shard }) => {
			shard.requires('powerCreeps');
			await shard.ownedRoom('p1', 'W1N1', 8);
			const id = await shard.placePowerCreep('W1N1', {
				pos: [25, 25],
				owner: 'p1',
				name: 'TestPC',
				powers: { [PWR_OPERATE_LAB]: 1 },
			});
			await shard.tick();

			const result = await shard.runPlayer('p1', code`
				const pc = Game.powerCreeps['TestPC'];
				pc ? ({
					name: pc.name,
					x: pc.pos.x,
					y: pc.pos.y,
					hasPower: !!pc.powers[PWR_OPERATE_LAB],
					powerLevel: pc.powers[PWR_OPERATE_LAB] ? pc.powers[PWR_OPERATE_LAB].level : 0,
				}) : null
			`) as { name: string; x: number; y: number; hasPower: boolean; powerLevel: number } | null;
			expect(result).not.toBeNull();
			expect(result!.name).toBe('TestPC');
			expect(result!.x).toBe(25);
			expect(result!.y).toBe(25);
			expect(result!.hasPower).toBe(true);
			expect(result!.powerLevel).toBe(1);
		});

		test('default power creep names are deterministic and collision-free', async ({ shard }) => {
			shard.requires('powerCreeps');
			await shard.ownedRoom('p1', 'W1N1', 8);
			const originalNow = Date.now;
			Date.now = () => 1234567890;
			try {
				await shard.placePowerCreep('W1N1', {
					pos: [25, 25],
					owner: 'p1',
					powers: {},
				});
				await shard.placePowerCreep('W1N1', {
					pos: [26, 25],
					owner: 'p1',
					powers: {},
				});
			} finally {
				Date.now = originalNow;
			}
			await shard.tick();

			const names = await shard.runPlayer('p1', code`
				Object.keys(Game.powerCreeps).sort()
			`) as string[];
			expect(names).toHaveLength(2);
			expect(new Set(names).size).toBe(2);
		});
	});

	describe('placeNuke', () => {
		test('places an in-flight nuke visible via FIND_NUKES with specified timeToLand', async ({ shard }) => {
			shard.requires('nuke');
			await shard.createShard({
				players: ['p1'],
				rooms: [
					{ name: 'W1N1', rcl: 8, owner: 'p1' },
					{ name: 'W2N1', rcl: 1, owner: 'p1' },
				],
			});
			await shard.placeNuke('W2N1', {
				pos: [25, 25],
				launchRoomName: 'W1N1',
				timeToLand: 10,
			});
			await shard.tick();

			const nukeInfo = await shard.runPlayer('p1', code`
				const nukes = Game.rooms['W2N1'].find(FIND_NUKES);
				nukes.length > 0 ? ({
					launchRoomName: nukes[0].launchRoomName,
					timeToLand: nukes[0].timeToLand,
					x: nukes[0].pos.x,
					y: nukes[0].pos.y,
				}) : null
			`) as { launchRoomName: string; timeToLand: number; x: number; y: number } | null;
			expect(nukeInfo).not.toBeNull();
			expect(nukeInfo!.launchRoomName).toBe('W1N1');
			expect(nukeInfo!.x).toBe(25);
			expect(nukeInfo!.y).toBe(25);
			// timeToLand should have decreased by 1 from the tick.
			expect(nukeInfo!.timeToLand).toBe(9);
		});
	});

	describe('setup helpers do not inject extra ticks', () => {
		// Spec §Execution: runPlayer() advances time by exactly 1 tick.
		// Placement helpers stage world state for the next flush but must
		// not run an engine tick even indirectly — otherwise absolute-time
		// fields (ticksToLive, deathTime, ticksToDecay) set during setup
		// would be off by the number of helpers called before runPlayer.
		// Each test asserts: (after-runPlayer) - (before-place) === 1.

		test('placeCreep + runPlayer advances exactly 1 tick', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const before = await shard.getGameTime();
			await shard.placeCreep('W1N1', { pos: [25, 25], owner: 'p1', body: [MOVE] });
			await shard.runPlayer('p1', code`1`);
			expect((await shard.getGameTime()) - before).toBe(1);
		});

		test('placeStructure + runPlayer advances exactly 1 tick', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const before = await shard.getGameTime();
			await shard.placeStructure('W1N1', { pos: [25, 25], structureType: STRUCTURE_CONTAINER });
			await shard.runPlayer('p1', code`1`);
			expect((await shard.getGameTime()) - before).toBe(1);
		});

		test('placeSite + runPlayer advances exactly 1 tick', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const before = await shard.getGameTime();
			await shard.placeSite('W1N1', { pos: [25, 25], owner: 'p1', structureType: STRUCTURE_CONTAINER });
			await shard.runPlayer('p1', code`1`);
			expect((await shard.getGameTime()) - before).toBe(1);
		});

		test('placeSource + runPlayer advances exactly 1 tick', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const before = await shard.getGameTime();
			await shard.placeSource('W1N1', { pos: [20, 20] });
			await shard.runPlayer('p1', code`1`);
			expect((await shard.getGameTime()) - before).toBe(1);
		});

		test('placeMineral + runPlayer advances exactly 1 tick', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const before = await shard.getGameTime();
			await shard.placeMineral('W1N1', { pos: [30, 30], mineralType: 'H' });
			await shard.runPlayer('p1', code`1`);
			expect((await shard.getGameTime()) - before).toBe(1);
		});

		test('placeFlag + runPlayer advances exactly 1 tick', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const before = await shard.getGameTime();
			await shard.placeFlag('W1N1', { pos: [25, 25], owner: 'p1', name: 'InvariantFlag' });
			await shard.runPlayer('p1', code`1`);
			expect((await shard.getGameTime()) - before).toBe(1);
		});

		test('placeTombstone + runPlayer advances exactly 1 tick', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const before = await shard.getGameTime();
			await shard.placeTombstone('W1N1', { pos: [25, 25], creepName: 'Dead' });
			await shard.runPlayer('p1', code`1`);
			expect((await shard.getGameTime()) - before).toBe(1);
		});

		test('placeRuin + runPlayer advances exactly 1 tick', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const before = await shard.getGameTime();
			await shard.placeRuin('W1N1', { pos: [25, 25], structureType: STRUCTURE_SPAWN });
			await shard.runPlayer('p1', code`1`);
			expect((await shard.getGameTime()) - before).toBe(1);
		});

		test('placeDroppedResource + runPlayer advances exactly 1 tick', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const before = await shard.getGameTime();
			await shard.placeDroppedResource('W1N1', { pos: [25, 25], resourceType: 'energy', amount: 100 });
			await shard.runPlayer('p1', code`1`);
			expect((await shard.getGameTime()) - before).toBe(1);
		});

		test('placePowerCreep + runPlayer advances exactly 1 tick', async ({ shard }) => {
			shard.requires('powerCreeps');
			await shard.ownedRoom('p1', 'W1N1', 8);
			const before = await shard.getGameTime();
			await shard.placePowerCreep('W1N1', { pos: [25, 25], owner: 'p1', name: 'TimePC', powers: {} });
			await shard.runPlayer('p1', code`1`);
			expect((await shard.getGameTime()) - before).toBe(1);
		});

		test('placeNuke + runPlayer advances exactly 1 tick', async ({ shard }) => {
			shard.requires('nuke');
			await shard.ownedRoom('p1', 'W1N1', 8);
			const before = await shard.getGameTime();
			await shard.placeNuke('W1N1', { pos: [25, 25], launchRoomName: 'W1N1', timeToLand: 100 });
			await shard.runPlayer('p1', code`1`);
			expect((await shard.getGameTime()) - before).toBe(1);
		});
	});

	describe('placeStructure required-field validation', () => {
		// Spec §Setup: StructureSpec.owner is optional at the type level
		// only because some structures are unowned (container, road,
		// constructedWall). For structure types the engine always
		// attributes to a user, omitting owner is a placement error and
		// must produce an actionable boundary error — not a cryptic crash
		// inside engine internals from a null assertion on owner.
		test('placeStructure for a spawn without owner throws with an actionable error', async ({ shard }) => {
			await shard.ownedRoom('p1');
			let err: Error | null = null;
			try {
				await shard.placeStructure('W1N1', {
					pos: [25, 25],
					structureType: STRUCTURE_SPAWN,
				});
				// Some adapters may defer the crash until flush; force it.
				await shard.tick();
			} catch (e) {
				err = e as Error;
			}
			expect(err).not.toBeNull();
			expect(err!.message).toMatch(/owner/i);
		});

		test('placeStructure rejects public object-only types with a placeObject hint', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const objectOnlyTypes = [
				STRUCTURE_INVADER_CORE,
				STRUCTURE_KEEPER_LAIR,
				STRUCTURE_POWER_BANK,
				'portal',
				'deposit',
			];
			const accepted: string[] = [];
			for (const structureType of objectOnlyTypes) {
				let err: Error | null = null;
				try {
					await shard.placeStructure('W1N1', {
						pos: [25, 25],
						structureType,
					});
				} catch (e) {
					err = e as Error;
				}
				if (!err) accepted.push(structureType);
				else expect(err.message).toMatch(/placeObject/);
			}
			expect(accepted).toEqual([]);
		});
	});

	describe('setTerrain after runPlayer', () => {
		// Spec §Terrain: terrain is a setup-only property. Once runPlayer
		// has started simulating user code, an adapter may have built
		// player sandboxes, cached world blobs, or otherwise committed to
		// the current terrain. Late-mutating terrain is not a supported
		// runtime scenario — tests should not rely on mid-run terrain
		// changes. Adapters must reject the call with an actionable error
		// rather than silently accept a mutation that isn't visible to
		// player code.
		test('setTerrain after runPlayer throws with an actionable error', async ({ shard }) => {
			shard.requires('terrain');
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
			});
			await shard.runPlayer('p1', code`1`);

			const wall = new Array<0 | 1 | 2>(2500).fill(0);
			wall[25 * 50 + 25] = 1;

			let err: Error | null = null;
			try {
				await shard.setTerrain('W1N1', wall);
			} catch (e) {
				err = e as Error;
			}
			expect(err).not.toBeNull();
			expect(err!.message.length).toBeGreaterThan(0);
		});
	});
});
