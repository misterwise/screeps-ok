import { describe, test, expect, code } from '../../src/index.js';

describe('adapter contract: inspection', () => {
	describe('getObject', () => {
		test('returns null for nonexistent ID', async ({ shard }) => {
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1' }],
			});
			const obj = await shard.getObject('nonexistent-id-12345');
			expect(obj).toBeNull();
		});

		test('creep snapshot has correct kind and required fields', async ({ shard }) => {
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
			});
			const id = await shard.placeCreep('W1N1', {
				pos: [25, 25],
				owner: 'p1',
				body: ['work', 'carry', 'move'],
				name: 'TestCreep',
				store: { energy: 10 },
			});
			await shard.tick();

			const obj = await shard.getObject(id);
			expect(obj).not.toBeNull();
			expect(obj!.kind).toBe('creep');

			if (obj!.kind === 'creep') {
				expect(obj!.id).toBeDefined();
				expect(obj!.name).toBe('TestCreep');
				expect(obj!.pos.x).toBe(25);
				expect(obj!.pos.y).toBe(25);
				expect(obj!.pos.roomName).toBe('W1N1');
				expect(typeof obj!.hits).toBe('number');
				expect(typeof obj!.hitsMax).toBe('number');
				expect(typeof obj!.fatigue).toBe('number');
				expect(obj!.body).toHaveLength(3);
				expect(obj!.owner).toBe('p1');
				expect(typeof obj!.ticksToLive).toBe('number');
				expect(typeof obj!.spawning).toBe('boolean');
				expect(typeof obj!.store).toBe('object');
				expect(typeof obj!.storeCapacity).toBe('number');
			}
		});

		test('structure snapshot has correct kind', async ({ shard }) => {
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
			});
			const id = await shard.placeStructure('W1N1', {
				pos: [30, 30],
				structureType: 'road',
			});
			await shard.tick();

			const obj = await shard.getObject(id);
			expect(obj).not.toBeNull();
			expect(obj!.kind).toBe('structure');
			if (obj!.kind === 'structure') {
				expect(obj!.structureType).toBe('road');
				expect(obj!.pos.x).toBe(30);
				expect(obj!.pos.y).toBe(30);
			}
		});

		test('site snapshot has progress fields', async ({ shard }) => {
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
				expect(typeof obj!.progress).toBe('number');
				expect(typeof obj!.progressTotal).toBe('number');
				expect(obj!.owner).toBe('p1');
			}
		});

		test('source snapshot has energy fields', async ({ shard }) => {
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1' }],
			});
			const id = await shard.placeSource('W1N1', {
				pos: [10, 10],
				energy: 1500,
				energyCapacity: 3000,
			});
			await shard.tick();

			const obj = await shard.getObject(id);
			expect(obj).not.toBeNull();
			expect(obj!.kind).toBe('source');
			if (obj!.kind === 'source') {
				expect(typeof obj!.energy).toBe('number');
				expect(typeof obj!.energyCapacity).toBe('number');
				expect(typeof obj!.ticksToRegeneration).toBe('number');
			}
		});

		test('mineral snapshot has mineral fields', async ({ shard }) => {
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1' }],
			});
			const id = await shard.placeMineral('W1N1', {
				pos: [40, 40],
				mineralType: 'O',
				mineralAmount: 50000,
			});
			await shard.tick();

			const obj = await shard.getObject(id);
			expect(obj).not.toBeNull();
			expect(obj!.kind).toBe('mineral');
			if (obj!.kind === 'mineral') {
				expect(obj!.mineralType).toBe('O');
				expect(obj!.mineralAmount).toBe(50000);
			}
		});
	});

	describe('findInRoom', () => {
		test('finds creeps', async ({ shard }) => {
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
			});
			await shard.placeCreep('W1N1', {
				pos: [25, 25], owner: 'p1', body: ['move'],
			});
			await shard.placeCreep('W1N1', {
				pos: [26, 25], owner: 'p1', body: ['move'],
			});
			await shard.tick();

			const creeps = await shard.findInRoom('W1N1', 'creeps');
			expect(creeps.length).toBeGreaterThanOrEqual(2);
			expect(creeps.every((c: any) => c.kind === 'creep')).toBe(true);
		});

		test('finds structures', async ({ shard }) => {
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
			});
			// Place a known structure so we don't rely on controller detection
			await shard.placeStructure('W1N1', {
				pos: [30, 30],
				structureType: 'road',
			});
			await shard.tick();

			const structures = await shard.findInRoom('W1N1', 'structures');
			expect(structures.length).toBeGreaterThan(0);
			expect(structures.every((s: any) => s.kind === 'structure')).toBe(true);
		});

		test('finds construction sites', async ({ shard }) => {
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
			});
			await shard.placeSite('W1N1', {
				pos: [20, 20], owner: 'p1', structureType: 'road',
			});
			await shard.tick();

			const sites = await shard.findInRoom('W1N1', 'constructionSites');
			expect(sites.length).toBeGreaterThanOrEqual(1);
			expect(sites.every((s: any) => s.kind === 'site')).toBe(true);
		});

		test('finds sources', async ({ shard }) => {
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1' }],
			});
			await shard.placeSource('W1N1', { pos: [10, 10] });
			await shard.tick();

			const sources = await shard.findInRoom('W1N1', 'sources');
			expect(sources.length).toBeGreaterThanOrEqual(1);
			expect(sources.every((s: any) => s.kind === 'source')).toBe(true);
		});

		test('finds minerals', async ({ shard }) => {
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1' }],
			});
			await shard.placeMineral('W1N1', { pos: [40, 40], mineralType: 'H' });
			await shard.tick();

			const minerals = await shard.findInRoom('W1N1', 'minerals');
			expect(minerals.length).toBeGreaterThanOrEqual(1);
			expect(minerals.every((m: any) => m.kind === 'mineral')).toBe(true);
		});

		test('returns empty array for empty room type', async ({ shard }) => {
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1' }],
			});
			await shard.tick();

			const creeps = await shard.findInRoom('W1N1', 'creeps');
			expect(creeps).toEqual([]);
		});
	});

	describe('getGameTime', () => {
		test('returns a positive number', async ({ shard }) => {
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1' }],
			});
			const time = await shard.getGameTime();
			expect(typeof time).toBe('number');
			expect(time).toBeGreaterThan(0);
		});
	});

	describe('player handle mapping', () => {
		test('snapshot owner matches player handle, not engine ID', async ({ shard }) => {
			await shard.createShard({
				players: ['alice'],
				rooms: [{ name: 'W1N1', rcl: 1, owner: 'alice' }],
			});
			const id = await shard.placeCreep('W1N1', {
				pos: [25, 25],
				owner: 'alice',
				body: ['move'],
			});
			await shard.tick();

			const creep = await shard.getObject(id);
			if (creep?.kind === 'creep') {
				expect(creep.owner).toBe('alice');
			}
		});
	});
});
