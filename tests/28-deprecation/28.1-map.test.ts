import { describe, test, expect, code } from '../../src/index.js';

// Each row asserts a single register.deprecated log line emitted to the
// caller's console, naming the deprecated API and (when cataloged) the
// recommended replacement. The gameplay return value is unaffected.

describe('Game.map deprecation notices', () => {
	test('DEPRECATED-MAP-001 Game.map.isRoomAvailable emits a deprecation notice naming the replacement', async ({ shard }) => {
		shard.requires('deprecationNotices');
		await shard.ownedRoom('p1');

		const available = await shard.runPlayer('p1', code`
			Game.map.isRoomAvailable('W1N1')
		`);
		expect(available).toBe(true);

		const logs = await shard.captureConsoleLogs('p1');
		const matches = logs.filter(line =>
			line.includes('Game.map.isRoomAvailable') && line.includes('getRoomStatus'),
		);
		expect(matches).toHaveLength(1);
	});

	test('DEPRECATED-MAP-002 Game.map.getTerrainAt emits a deprecation notice recommending getRoomTerrain', async ({ shard }) => {
		shard.requires('deprecationNotices');
		await shard.ownedRoom('p1');

		// Cover both call shapes: positional (x, y, roomName) and pos object.
		const result = await shard.runPlayer('p1', code`
			({
				positional: Game.map.getTerrainAt(25, 25, 'W1N1'),
				object: Game.map.getTerrainAt(new RoomPosition(25, 25, 'W1N1')),
			})
		`) as { positional: string; object: string };
		expect(result.positional).toBe('plain');
		expect(result.object).toBe('plain');

		// Both call sites share the same message and dedup per tick → exactly one line.
		const logs = await shard.captureConsoleLogs('p1');
		const matches = logs.filter(line =>
			line.includes('Game.map.getTerrainAt') && line.includes('getRoomTerrain'),
		);
		expect(matches).toHaveLength(1);
	});
});
