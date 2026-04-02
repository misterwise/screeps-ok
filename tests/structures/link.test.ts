import { describe, test, expect, code, OK, STRUCTURE_LINK } from '../../src/index.js';

describe('StructureLink', () => {
	test('transferEnergy sends energy minus 3% to target link', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 5, owner: 'p1' }],
		});
		const link1 = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LINK, owner: 'p1',
			store: { energy: 400 },
		});
		const link2 = await shard.placeStructure('W1N1', {
			pos: [25, 35], structureType: STRUCTURE_LINK, owner: 'p1',
			store: { energy: 0 },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${link1}).transferEnergy(Game.getObjectById(${link2}), 100)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const src = await shard.expectStructure(link1, STRUCTURE_LINK);
		expect(src.store.energy).toBe(300); // sent 100
		const dst = await shard.expectStructure(link2, STRUCTURE_LINK);
		expect(dst.store.energy).toBe(97); // received 100 - 3% = 97
	});

	test('transferEnergy sets cooldown', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 5, owner: 'p1' }],
		});
		const link1 = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LINK, owner: 'p1',
			store: { energy: 400 },
		});
		const link2 = await shard.placeStructure('W1N1', {
			pos: [25, 35], structureType: STRUCTURE_LINK, owner: 'p1',
			store: { energy: 0 },
		});

		await shard.runPlayer('p1', code`
			Game.getObjectById(${link1}).transferEnergy(Game.getObjectById(${link2}), 100)
		`);
		await shard.tick();

		const src = await shard.expectStructure(link1, STRUCTURE_LINK);
		expect(src.cooldown).toBeGreaterThan(0);
	});
});
