import { describe, test, expect, code } from '../../src/index.js';

describe('Deprecation notice dedup', () => {
	test('DEPRECATED-DEDUP-001 identical notices in the same tick collapse to one log; the next tick re-emits', async ({ shard }) => {
		shard.requires('deprecationNotices');
		await shard.ownedRoom('p1');

		// Fire the same deprecated API twice in one tick.
		await shard.runPlayer('p1', code`
			Game.map.isRoomAvailable('W1N1');
			Game.map.isRoomAvailable('W1N1');
			null
		`);
		const firstTickLogs = await shard.captureConsoleLogs('p1');
		const firstMatches = firstTickLogs.filter(line =>
			line.includes('Game.map.isRoomAvailable'),
		);
		expect(firstMatches).toHaveLength(1);

		// Advance to a fresh tick. The same call must emit a fresh notice
		// because dedup scope is per-tick.
		await shard.runPlayer('p1', code`
			Game.map.isRoomAvailable('W1N1');
			null
		`);
		const secondTickLogs = await shard.captureConsoleLogs('p1');
		const secondMatches = secondTickLogs.filter(line =>
			line.includes('Game.map.isRoomAvailable'),
		);
		expect(secondMatches).toHaveLength(1);

		// Sibling APIs that emit the same string text dedup together within a
		// tick: Room.findPath({avoid}) and RoomPosition.findClosestByPath({avoid})
		// share one notice text.
		await shard.runPlayer('p1', code`
			const room = Game.rooms.W1N1;
			const from = new RoomPosition(10, 10, 'W1N1');
			const to = new RoomPosition(20, 20, 'W1N1');
			room.findPath(from, to, { avoid: [{ x: 15, y: 15 }] });
			from.findClosestByPath([to], { avoid: [{ x: 15, y: 15 }] });
			null
		`);
		const thirdTickLogs = await shard.captureConsoleLogs('p1');
		const avoidMatches = thirdTickLogs.filter(line =>
			line.includes('avoid') && line.includes('costCallback'),
		);
		expect(avoidMatches).toHaveLength(1);
	});
});
