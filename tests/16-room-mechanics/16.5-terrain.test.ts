import {
	describe, test, expect, code,
	TERRAIN_WALL, TERRAIN_SWAMP,
} from '../../src/index.js';
import { roomTerrainCases, roomTerrainLayout } from '../../src/matrices/room-terrain.js';

describe('Room terrain access', () => {
	for (const { label, pos, expectedMask } of roomTerrainCases) {
		test(`ROOM-TERRAIN-001 [${label}] Room.Terrain.get(x, y) returns the expected terrain mask`, async ({ shard }) => {
			shard.requires('terrain', 'custom terrain setup is required for terrain mask assertions');
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1', terrain: roomTerrainLayout }],
			});

			const terrainMask = await shard.runPlayer('p1', code`
				new Room.Terrain('W1N1').get(${pos.x}, ${pos.y})
			`);

			expect(terrainMask).toBe(expectedMask);
		});
	}

	test('ROOM-TERRAIN-002 Room.Terrain.getRawBuffer() returns a 2500-element Uint8Array indexed y * 50 + x', async ({ shard }) => {
		shard.requires('terrain', 'custom terrain setup is required for terrain buffer assertions');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1', terrain: roomTerrainLayout }],
		});

		const result = await shard.runPlayer('p1', code`
			const terrain = new Room.Terrain('W1N1');
			const buffer = terrain.getRawBuffer();
			const values = [];
			for (let y = 0; y < 50; y++) {
				for (let x = 0; x < 50; x++) values.push(terrain.get(x, y));
			}
			({ isUint8Array: buffer instanceof Uint8Array, buffer: Array.from(buffer), values })
		`) as { isUint8Array: boolean; buffer: number[]; values: number[] };

		expect(result.isUint8Array).toBe(true);
		expect(result.buffer).toHaveLength(2500);
		expect(result.buffer).toEqual(result.values);
		expect(result.buffer[10 * 50 + 11]).toBe(TERRAIN_WALL);
		expect(result.buffer[10 * 50 + 12]).toBe(TERRAIN_SWAMP);
	});

	test('ROOM-TERRAIN-004 Room.Terrain.getRawBuffer(destinationArray) fills and returns destinationArray', async ({ shard }) => {
		shard.requires('terrain', 'custom terrain setup is required for terrain buffer assertions');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1', terrain: roomTerrainLayout }],
		});

		const result = await shard.runPlayer('p1', code`
			const terrain = new Room.Terrain('W1N1');
			const destination = new Uint8Array(2500);
			const returned = terrain.getRawBuffer(destination);
			({ same: returned === destination, filled: Array.from(destination), copy: Array.from(terrain.getRawBuffer()) })
		`) as { same: boolean; filled: number[]; copy: number[] };

		expect(result.same).toBe(true);
		expect(result.filled).toEqual(result.copy);
		expect(result.filled[10 * 50 + 11]).toBe(TERRAIN_WALL);
	});
});
