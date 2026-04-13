import { describe, test, expect, code, TERRAIN_WALL, TERRAIN_SWAMP } from '../../src/index.js';

describe('Game.map terrain', () => {
	test('MAP-TERRAIN-001 getRoomTerrain returns terrain access for visible and non-visible rooms', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1' },
			],
		});

		const result = await shard.runPlayer('p1', code`
			const owned = Game.map.getRoomTerrain('W1N1');
			const nonVisible = Game.map.getRoomTerrain('W2N1');
			({
				ownedHasGet: typeof owned.get === 'function',
				nonVisibleHasGet: typeof nonVisible.get === 'function',
				ownedSample: owned.get(0, 0),
				nonVisibleSample: nonVisible.get(0, 0),
			})
		`) as { ownedHasGet: boolean; nonVisibleHasGet: boolean; ownedSample: number; nonVisibleSample: number };
		expect(result.ownedHasGet).toBe(true);
		expect(result.nonVisibleHasGet).toBe(true);
		expect(typeof result.ownedSample).toBe('number');
		expect(typeof result.nonVisibleSample).toBe('number');
	});

	test('MAP-TERRAIN-002 terrain.get(x, y) returns 0, TERRAIN_MASK_WALL, or TERRAIN_MASK_SWAMP', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const terrain = Game.map.getRoomTerrain('W1N1');
			const values = new Set();
			for (let x = 0; x < 50; x++) {
				for (let y = 0; y < 50; y++) {
					values.add(terrain.get(x, y));
				}
			}
			Array.from(values).sort((a, b) => a - b)
		`) as number[];
		expect(result.length).toBeGreaterThanOrEqual(1);
		for (const v of result) {
			expect([0, TERRAIN_WALL, TERRAIN_SWAMP]).toContain(v);
		}
	});

	test('MAP-TERRAIN-003 terrain.getRawBuffer() returns a 2500-element buffer matching get()', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const terrain = Game.map.getRoomTerrain('W1N1');
			const buf = terrain.getRawBuffer(new Uint8Array(2500));
			let mismatch = 0;
			for (let x = 0; x < 50; x++) {
				for (let y = 0; y < 50; y++) {
					if (buf[y * 50 + x] !== terrain.get(x, y)) mismatch++;
				}
			}
			({ length: buf.length, mismatch })
		`) as { length: number; mismatch: number };
		expect(result.length).toBe(2500);
		expect(result.mismatch).toBe(0);
	});
});
