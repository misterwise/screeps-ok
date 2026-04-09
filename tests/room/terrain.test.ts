import {
	describe, test, expect, code,
	TERRAIN_PLAIN, TERRAIN_WALL, TERRAIN_SWAMP,
} from '../../src/index.js';
import { roomTerrainCases, roomTerrainLayout } from '../support/matrices/room-terrain.js';

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

	test('ROOM-TERRAIN-002 Room.Terrain.getRawBuffer() returns the room terrain as a 2500-byte Uint8Array', async ({ shard }) => {
		shard.requires('terrain', 'custom terrain setup is required for terrain buffer assertions');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1', terrain: roomTerrainLayout }],
		});

		const result = await shard.runPlayer('p1', code`
			const buffer = new Room.Terrain('W1N1').getRawBuffer();
			({
				isUint8Array: buffer instanceof Uint8Array,
				length: buffer.length,
				samples: [buffer[10 * 50 + 10], buffer[10 * 50 + 11], buffer[10 * 50 + 12]],
			})
		`) as {
			isUint8Array: boolean;
			length: number;
			samples: number[];
		};

		expect(result).toEqual({
			isUint8Array: true,
			length: 2500,
			samples: [TERRAIN_PLAIN, TERRAIN_WALL, TERRAIN_SWAMP],
		});
	});

	test('ROOM-TERRAIN-003 Game.map.getRoomTerrain(roomName) provides equivalent terrain access to new Room.Terrain(roomName)', async ({ shard }) => {
		shard.requires('terrain', 'custom terrain setup is required for terrain access equivalence assertions');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1', terrain: roomTerrainLayout }],
		});

		const result = await shard.runPlayer('p1', code`
			const viaMap = Game.map.getRoomTerrain('W1N1');
			const viaCtor = new Room.Terrain('W1N1');
			({
				plain: [viaMap.get(10, 10), viaCtor.get(10, 10)],
				wall: [viaMap.get(11, 10), viaCtor.get(11, 10)],
				swamp: [viaMap.get(12, 10), viaCtor.get(12, 10)],
			})
		`) as {
			plain: [number, number];
			wall: [number, number];
			swamp: [number, number];
		};

		expect(result).toEqual({
			plain: [TERRAIN_PLAIN, TERRAIN_PLAIN],
			wall: [TERRAIN_WALL, TERRAIN_WALL],
			swamp: [TERRAIN_SWAMP, TERRAIN_SWAMP],
		});
	});
});
