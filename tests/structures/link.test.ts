import { describe, test, expect, code, OK, ERR_TIRED, STRUCTURE_LINK, LINK_LOSS_RATIO } from '../../src/index.js';

describe('StructureLink', () => {
	test('LINK-003 transferEnergy sends energy minus link loss to the target link', async ({ shard }) => {
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
		expect(dst.store.energy).toBe(100 - Math.ceil(100 * LINK_LOSS_RATIO));
	});

	test('LINK-004 transferEnergy keeps the source link unusable for 9 subsequent ticks after a distance-10 transfer and usable on the 10th', async ({ shard }) => {
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

		for (let tick = 1; tick <= 9; tick += 1) {
			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${link1}).transferEnergy(Game.getObjectById(${link2}), 100)
			`);
			expect(rc).toBe(ERR_TIRED);
			await shard.tick();
		}

		const ready = await shard.runPlayer('p1', code`
			Game.getObjectById(${link1}).transferEnergy(Game.getObjectById(${link2}), 100)
		`);
		expect(ready).toBe(OK);
	});
});
