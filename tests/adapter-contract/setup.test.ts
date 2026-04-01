import { describe, test, expect, code } from '../../src/index.js';

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
	});

	describe('placeCreep', () => {
		test('places a creep and returns a valid ID', async ({ shard }) => {
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
			});
			const id = await shard.placeCreep('W1N1', {
				pos: [25, 25],
				owner: 'p1',
				body: ['move'],
			});
			expect(typeof id).toBe('string');
			expect(id.length).toBeGreaterThan(0);
		});

		test('creep is retrievable by ID after tick', async ({ shard }) => {
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
			});
			const id = await shard.placeCreep('W1N1', {
				pos: [25, 25],
				owner: 'p1',
				body: ['move', 'carry', 'work'],
			});
			await shard.tick();

			const creep = await shard.getObject(id);
			expect(creep).not.toBeNull();
			expect(creep!.kind).toBe('creep');
			if (creep!.kind === 'creep') {
				expect(creep!.body).toHaveLength(3);
				expect(creep!.owner).toBe('p1');
			}
		});

		test('creep store is initialized', async ({ shard }) => {
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
			});
			const id = await shard.placeCreep('W1N1', {
				pos: [10, 10],
				owner: 'p1',
				body: ['carry', 'move'],
				store: { energy: 25 },
			});
			await shard.tick();

			const creep = await shard.getObject(id);
			expect(creep).not.toBeNull();
			if (creep?.kind === 'creep') {
				expect(creep.store.energy).toBe(25);
			}
		});

		test('creep appears in findInRoom', async ({ shard }) => {
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
			});
			await shard.placeCreep('W1N1', {
				pos: [25, 25],
				owner: 'p1',
				body: ['move'],
			});
			await shard.tick();

			const creeps = await shard.findInRoom('W1N1', 'creeps');
			const placed = creeps.filter((c: any) => c.kind === 'creep');
			expect(placed.length).toBeGreaterThanOrEqual(1);
		});
	});

	describe('placeStructure', () => {
		test('places a spawn', async ({ shard }) => {
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
			});
			const id = await shard.placeStructure('W1N1', {
				pos: [30, 30],
				structureType: 'spawn',
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
				structureType: 'container',
			});
			await shard.tick();

			const obj = await shard.getObject(id);
			expect(obj).not.toBeNull();
			if (obj?.kind === 'structure') {
				expect(obj.structureType).toBe('container');
			}
		});
	});

	describe('placeSite', () => {
		test('places a construction site', async ({ shard }) => {
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
			});
			const id = await shard.placeSite('W1N1', {
				pos: [25, 26],
				owner: 'p1',
				structureType: 'road',
			});
			await shard.tick();

			const obj = await shard.getObject(id);
			expect(obj).not.toBeNull();
			expect(obj!.kind).toBe('site');
			if (obj!.kind === 'site') {
				expect(obj!.structureType).toBe('road');
				expect(obj!.progress).toBe(0);
				expect(obj!.progressTotal).toBeGreaterThan(0);
			}
		});
	});

	describe('placeSource', () => {
		test('places a source with default energy', async ({ shard }) => {
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
			});
			const id = await shard.placeSource('W1N1', {
				pos: [10, 10],
			});
			await shard.tick();

			const obj = await shard.getObject(id);
			expect(obj).not.toBeNull();
			expect(obj!.kind).toBe('source');
			if (obj!.kind === 'source') {
				expect(obj!.energyCapacity).toBe(3000);
				expect(obj!.energy).toBe(3000);
			}
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

			const obj = await shard.getObject(id);
			if (obj?.kind === 'source') {
				expect(obj.energy).toBe(0);
			}
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

			const obj = await shard.getObject(id);
			expect(obj).not.toBeNull();
			expect(obj!.kind).toBe('mineral');
			if (obj!.kind === 'mineral') {
				expect(obj!.mineralType).toBe('H');
				expect(obj!.mineralAmount).toBe(100000);
			}
		});
	});
});
