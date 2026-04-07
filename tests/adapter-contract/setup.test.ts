import { describe, test, expect, code, MOVE, CARRY, WORK, FIND_CREEPS, STRUCTURE_SPAWN, STRUCTURE_CONTAINER, STRUCTURE_ROAD, RESOURCE_ENERGY, CONTAINER_HITS } from '../../src/index.js';
import { hasDocumentedAdapterLimitation } from '../support/limitations.js';

// Vanilla's mockup runtime disables users that own no room objects, so a
// "headless" second player cannot execute code there today.
const supportsHeadlessMultiPlayer = !hasDocumentedAdapterLimitation('headlessMultiPlayer');
const multiPlayerTest = supportsHeadlessMultiPlayer ? test : test.skip;

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

		multiPlayerTest('creates multiple players', async ({ shard }) => {
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
			expect(placed.length).toBeGreaterThanOrEqual(1);
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

		const supportsCustomHits = !hasDocumentedAdapterLimitation('structureCustomHits');
		const customHitsTest = supportsCustomHits ? test : test.skip;

		customHitsTest('structure hits is initialized', async ({ shard }) => {
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
	});

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
			expect(obj.progressTotal).toBeGreaterThan(0);
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
		// xxscreeps simulate().player() uses runForUser (no TickPayload), so
		// Game.flags is never populated. Same root cause as Memory/RawMemory.
		// Tracked for upstream fix: simulate() needs TickPayload-aware player mode.
		test.skip('places a flag retrievable by name in player code', async ({ shard }) => {
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
});
