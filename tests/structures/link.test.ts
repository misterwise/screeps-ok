import { describe, test, expect, code } from '../../src/index.js';

describe('StructureLink', () => {
	test('transferEnergy sends energy minus 3% to target link', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 5, owner: 'p1' }],
		});
		const link1 = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: 'link', owner: 'p1',
			store: { energy: 400 },
		});
		const link2 = await shard.placeStructure('W1N1', {
			pos: [25, 35], structureType: 'link', owner: 'p1',
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${link1}).transferEnergy(Game.getObjectById(${link2}), 100)
		`);
		expect(rc).toBe(0);
		await shard.tick();

		const src = await shard.getObject(link1);
		const dst = await shard.getObject(link2);
		if (src?.kind === 'structure' && 'store' in src) {
			expect((src as any).store.energy).toBe(300); // sent 100
		}
		if (dst?.kind === 'structure' && 'store' in dst) {
			expect((dst as any).store.energy).toBe(97); // received 100 - 3% = 97
		}
	});

	test('transferEnergy sets cooldown', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 5, owner: 'p1' }],
		});
		const link1 = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: 'link', owner: 'p1',
			store: { energy: 400 },
		});
		const link2 = await shard.placeStructure('W1N1', {
			pos: [25, 35], structureType: 'link', owner: 'p1',
		});

		await shard.runPlayer('p1', code`
			Game.getObjectById(${link1}).transferEnergy(Game.getObjectById(${link2}), 100)
		`);
		await shard.tick();

		const src = await shard.getObject(link1);
		if (src?.kind === 'structure' && 'cooldown' in src) {
			expect((src as any).cooldown).toBeGreaterThan(0);
		}
	});
});
