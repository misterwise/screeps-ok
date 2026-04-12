import { describe, test, expect, code, TERRAIN_WALL, TERRAIN_SWAMP } from '../../src/index.js';

describe('Game.map terrain', () => {
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
