import { describe, test, expect, code } from '../../src/index.js';

describe('StructureTower', () => {
	test('tower.attack() deals 600 damage at range ≤5', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 3, owner: 'p1' }],
		});
		const towerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: 'tower', owner: 'p1',
			store: { energy: 1000 },
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 28], owner: 'p2', // range 3
			body: ['tough', 'tough', 'tough', 'tough', 'tough',
			       'tough', 'tough', 'tough', 'tough', 'move'],
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${towerId}).attack(Game.getObjectById(${targetId}))
		`);
		expect(rc).toBe(0);
		await shard.tick();

		const target = await shard.getObject(targetId);
		if (target?.kind === 'creep') {
			expect(target.hits).toBe(1000 - 600); // max damage at close range
		}

		// Tower should have used 10 energy
		const tower = await shard.getObject(towerId);
		if (tower?.kind === 'structure' && 'store' in tower) {
			expect((tower as any).store.energy).toBe(990);
		}
	});

	test('tower.attack() damage falls off linearly beyond range 5', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 3, owner: 'p1' }],
		});
		const towerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: 'tower', owner: 'p1',
			store: { energy: 1000 },
		});
		// Range 20 — well into falloff range
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 45], owner: 'p2',
			body: ['tough', 'tough', 'tough', 'tough', 'tough',
			       'tough', 'tough', 'tough', 'tough', 'move'],
		});

		await shard.runPlayer('p1', code`
			Game.getObjectById(${towerId}).attack(Game.getObjectById(${targetId}))
		`);
		await shard.tick();

		const target = await shard.getObject(targetId);
		if (target?.kind === 'creep') {
			// Damage should be less than 600 due to falloff
			expect(target.hits).toBeGreaterThan(1000 - 600);
			expect(target.hits).toBeLessThan(1000);
		}
	});

	test('tower.heal() heals 400 HP at range ≤5', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 3, owner: 'p1' }],
		});
		const towerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: 'tower', owner: 'p1',
			store: { energy: 1000 },
		});

		// First damage a creep, then heal it
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 27], owner: 'p2',
			body: ['attack', 'move'],
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 28], owner: 'p1',
			body: ['tough', 'tough', 'tough', 'tough', 'tough',
			       'tough', 'tough', 'tough', 'tough', 'move'],
		});

		// p2 attacks, p1 tower heals
		await shard.runPlayer('p2', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
		`);
		await shard.runPlayer('p1', code`
			Game.getObjectById(${towerId}).heal(Game.getObjectById(${targetId}))
		`);
		await shard.tick();

		const target = await shard.getObject(targetId);
		if (target?.kind === 'creep') {
			// 30 attack damage - 400 heal = net +370 (but can't exceed max)
			expect(target.hits).toBe(1000); // healed more than damaged
		}
	});

	test('tower.repair() repairs 800 HP at range ≤5', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 3, owner: 'p1' }],
		});
		const towerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: 'tower', owner: 'p1',
			store: { energy: 1000 },
		});
		const roadId = await shard.placeStructure('W1N1', {
			pos: [25, 28], structureType: 'road', hits: 100,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${towerId}).repair(Game.getObjectById(${roadId}))
		`);
		expect(rc).toBe(0);
		await shard.tick();

		const road = await shard.getObject(roadId);
		if (road?.kind === 'structure' && road.hits !== undefined) {
			expect(road.hits).toBe(900); // 100 + 800 repair at close range
		}
	});

	test('tower returns ERR_NOT_ENOUGH_ENERGY without energy', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 3, owner: 'p1' }],
		});
		const towerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: 'tower', owner: 'p1',
			// no energy
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 28], owner: 'p2',
			body: ['tough', 'move'],
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${towerId}).attack(Game.getObjectById(${targetId}))
		`);
		expect(rc).toBe(-6);
	});
});
