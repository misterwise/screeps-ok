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

		// Each call shape in its own tick, since a tick logs a message once.
		const forms = [
			code`Game.map.getTerrainAt(25, 25, 'W1N1')`,
			code`Game.map.getTerrainAt(new RoomPosition(25, 25, 'W1N1'))`,
		];
		for (const form of forms) {
			expect(await shard.runPlayer('p1', form)).toBe('plain');
			const logs = await shard.captureConsoleLogs('p1');
			expect(logs.filter(line => line.includes('Game.map.getTerrainAt') && line.includes('getRoomTerrain'))).toHaveLength(1);
		}
	});
});
