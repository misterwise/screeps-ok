import {
	describe, test, expect, code, WORK, CARRY, MOVE,
	FIND_CREEPS, FIND_STRUCTURES, FIND_CONSTRUCTION_SITES, FIND_SOURCES,
	FIND_MINERALS, STRUCTURE_ROAD, STRUCTURE_SPAWN, STRUCTURE_CONTAINER,
	STRUCTURE_LAB, OK, REACTION_TIME,
} from '../../src/index.js';

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
			await shard.ownedRoom('p1');
			const id = await shard.placeCreep('W1N1', {
				pos: [25, 25],
				owner: 'p1',
				body: [WORK, CARRY, MOVE],
				name: 'TestCreep',
				store: { energy: 10 },
			});
			await shard.tick();

			const obj = await shard.expectObject(id, 'creep');
			expect(obj.id).toBeDefined();
			expect(obj.name).toBe('TestCreep');
			expect(obj.pos.x).toBe(25);
			expect(obj.pos.y).toBe(25);
			expect(obj.pos.roomName).toBe('W1N1');
			expect(typeof obj.hits).toBe('number');
			expect(typeof obj.hitsMax).toBe('number');
			expect(typeof obj.fatigue).toBe('number');
			expect(obj.body).toHaveLength(3);
			expect(obj.owner).toBe('p1');
			expect(typeof obj.ticksToLive).toBe('number');
			expect(typeof obj.spawning).toBe('boolean');
			expect(typeof obj.store).toBe('object');
			expect(typeof obj.storeCapacity).toBe('number');
		});

		test('structure snapshot has correct kind', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const id = await shard.placeStructure('W1N1', {
				pos: [30, 30],
				structureType: STRUCTURE_ROAD,
			});
			await shard.tick();

			const obj = await shard.expectStructure(id, STRUCTURE_ROAD);
			expect(obj.pos.x).toBe(30);
			expect(obj.pos.y).toBe(30);
		});

		test('site snapshot has progress fields', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const id = await shard.placeSite('W1N1', {
				pos: [25, 26],
				owner: 'p1',
				structureType: STRUCTURE_ROAD,
			});
			await shard.tick();

			const obj = await shard.expectObject(id, 'site');
			expect(typeof obj.progress).toBe('number');
			expect(typeof obj.progressTotal).toBe('number');
			expect(obj.owner).toBe('p1');
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

			const obj = await shard.expectObject(id, 'source');
			expect(typeof obj.energy).toBe('number');
			expect(typeof obj.energyCapacity).toBe('number');
			expect(typeof obj.ticksToRegeneration).toBe('number');
		});

		test('runPlayer preserves undefined as null in return values', async ({ shard }) => {
			await shard.ownedRoom('p1');
			const srcId = await shard.placeSource('W1N1', {
				pos: [10, 10],
				energy: 3000,
				energyCapacity: 3000,
			});
			await shard.tick();

			// Engine returns undefined for ticksToRegeneration on a full source.
			// runPlayer must preserve this (as null via JSON), not normalize to 0.
			const result = await shard.runPlayer('p1', code`
				Game.getObjectById(${srcId}).ticksToRegeneration
			`);
			expect(result).toBeNull();
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

			const obj = await shard.expectObject(id, 'mineral');
			expect(obj.mineralType).toBe('O');
			expect(obj.mineralAmount).toBe(50000);
		});
	});

	describe('findInRoom', () => {
		test('finds creeps', async ({ shard }) => {
			await shard.ownedRoom('p1');
			await shard.placeCreep('W1N1', {
				pos: [25, 25], owner: 'p1', body: [MOVE],
			});
			await shard.placeCreep('W1N1', {
				pos: [26, 25], owner: 'p1', body: [MOVE],
			});
			await shard.tick();

			const creeps = await shard.findInRoom('W1N1', FIND_CREEPS);
			expect(creeps.length).toBeGreaterThanOrEqual(2);
			expect(creeps.every((c: any) => c.kind === 'creep')).toBe(true);
		});

		test('finds structures', async ({ shard }) => {
			await shard.ownedRoom('p1');
			// Place a known structure so we don't rely on controller detection
			await shard.placeStructure('W1N1', {
				pos: [30, 30],
				structureType: STRUCTURE_ROAD,
			});
			await shard.tick();

			const structures = await shard.findInRoom('W1N1', FIND_STRUCTURES);
			expect(structures.length).toBeGreaterThan(0);
			expect(structures.every((s: any) => s.kind === 'structure')).toBe(true);
		});

		test('finds construction sites', async ({ shard }) => {
			await shard.ownedRoom('p1');
			await shard.placeSite('W1N1', {
				pos: [20, 20], owner: 'p1', structureType: STRUCTURE_ROAD,
			});
			await shard.tick();

			const sites = await shard.findInRoom('W1N1', FIND_CONSTRUCTION_SITES);
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

			const sources = await shard.findInRoom('W1N1', FIND_SOURCES);
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

			const minerals = await shard.findInRoom('W1N1', FIND_MINERALS);
			expect(minerals.length).toBeGreaterThanOrEqual(1);
			expect(minerals.every((m: any) => m.kind === 'mineral')).toBe(true);
		});

		test('returns empty array for empty room type', async ({ shard }) => {
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1' }],
			});
			await shard.tick();

			const creeps = await shard.findInRoom('W1N1', FIND_CREEPS);
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

	describe('lab snapshot', () => {
		test('lab mineralType reflects stored mineral after runReaction', async ({ shard }) => {
			shard.requires('chemistry');
			await shard.ownedRoom('p1', 'W1N1', 6);

			const labId = await shard.placeStructure('W1N1', {
				pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
				store: { energy: 2000 },
			});
			const lab1 = await shard.placeStructure('W1N1', {
				pos: [25, 27], structureType: STRUCTURE_LAB, owner: 'p1',
				store: { energy: 2000, H: 100 },
			});
			const lab2 = await shard.placeStructure('W1N1', {
				pos: [27, 25], structureType: STRUCTURE_LAB, owner: 'p1',
				store: { energy: 2000, O: 100 },
			});

			// H + O → OH
			const rc = await shard.runPlayer('p1', code`
				const lab = Game.getObjectById(${labId});
				lab.runReaction(Game.getObjectById(${lab1}), Game.getObjectById(${lab2}))
			`);
			expect(rc).toBe(OK);
			await shard.tick();

			const lab = await shard.expectStructure(labId, STRUCTURE_LAB);
			// The adapter must derive mineralType from the lab's store,
			// since the engine does not store a mineralType field in the DB.
			expect(lab.mineralType).toBe('OH');
		});

	});

	describe('snapshot timer relativity', () => {
		// Snapshot timer fields name themselves after the player API getters
		// (Source.ticksToRegeneration, Container.ticksToDecay, etc.) which
		// always report ticks-remaining (relative to Game.time). The contract
		// is that snapshot field == player-code observable value. Adapters
		// that pass through raw absolute DB fields break this.

		test('controller snapshot ticksToDowngrade matches player-code value', async ({ shard }) => {
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1', ticksToDowngrade: 500 }],
			});
			await shard.tick();

			const sites = await shard.findInRoom('W1N1', FIND_STRUCTURES);
			const ctrl = sites.find((s: any) =>
				s.kind === 'structure' && s.structureType === 'controller') as any;
			const playerView = await shard.runPlayer('p1', code`
				Game.rooms['W1N1'].controller.ticksToDowngrade
			`) as number;

			expect(ctrl).toBeDefined();
			expect(typeof ctrl.ticksToDowngrade).toBe('number');
			// findInRoom and runPlayer's user code both observe the current
			// gameTime; with no tick between them, the snapshot field must
			// equal what player code reads. A snapshot that returns the raw
			// absolute DB field (downgradeTime) will diverge by Game.time.
			expect(ctrl.ticksToDowngrade).toBe(playerView);
			// Sanity: must be a remaining-tick count near the configured 500,
			// not a multi-thousand absolute timestamp.
			expect(ctrl.ticksToDowngrade).toBeLessThan(600);
		});

		test('controller snapshot safeMode matches player-code value when active', async ({ shard }) => {
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1', safeMode: 200 }],
			});
			await shard.tick();

			const sites = await shard.findInRoom('W1N1', FIND_STRUCTURES);
			const ctrl = sites.find((s: any) =>
				s.kind === 'structure' && s.structureType === 'controller') as any;
			const playerView = await shard.runPlayer('p1', code`
				Game.rooms['W1N1'].controller.safeMode || 0
			`) as number;

			expect(typeof ctrl.safeMode).toBe('number');
			expect(ctrl.safeMode).toBe(playerView);
			// Must be a remaining-tick count near 200, not an absolute timestamp.
			expect(ctrl.safeMode).toBeLessThan(300);
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
				body: [MOVE],
			});
			await shard.tick();

			const creep = await shard.expectObject(id, 'creep');
			expect(creep.owner).toBe('alice');
		});
	});
});
