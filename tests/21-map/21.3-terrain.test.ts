import { describe, test, expect, code } from '../../src/index.js';
import { roomTerrainCases, roomTerrainLayout } from '../../src/matrices/room-terrain.js';

describe('Game.map terrain', () => {
	test('MAP-TERRAIN-001 getRoomTerrain returns a Room.Terrain for visible and non-visible rooms', async ({ shard }) => {
		shard.requires('terrain', 'custom terrain setup is required for terrain access assertions');
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1', terrain: roomTerrainLayout },
				{ name: 'W2N1', terrain: roomTerrainLayout },
			],
		});

		const result = await shard.runPlayer('p1', code`
			const read = name => {
				const terrain = Game.map.getRoomTerrain(name);
				return {
					visible: name in Game.rooms,
					isTerrain: terrain instanceof Room.Terrain,
					masks: ${roomTerrainCases.map(({ pos }) => pos)}.map(({ x, y }) => terrain.get(x, y)),
				};
			};
			({ owned: read('W1N1'), unseen: read('W2N1') })
		`) as Record<'owned' | 'unseen', { visible: boolean; isTerrain: boolean; masks: number[] }>;

		const masks = roomTerrainCases.map(({ expectedMask }) => expectedMask);
		expect(result.owned).toEqual({ visible: true, isTerrain: true, masks });
		expect(result.unseen).toEqual({ visible: false, isTerrain: true, masks });
	});
});
