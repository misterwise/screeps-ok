import { describe, test, expect, code } from '../../src/index.js';

// Game.map.getRoomStatus reports a room's WORLD status, independent of whether the
// player can currently see it. An in-world room the player has no vision of must
// still read 'normal' (not 'closed'). Bots using a route planner that avoids
// 'closed' rooms (Traveler/Overmind-style) otherwise can't path scouts into
// neighbours, never gain intel, and never expand or remote-mine. The existing
// MAP-ROOM status tests use rooms the player can see; this covers the unseen case.
describe('MAP-ROOM-STATUS-VIS-001: getRoomStatus is visibility-independent', () => {
	test('an in-world room the player cannot see still reports normal', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 3, owner: 'p1' },
				{ name: 'W3N3' }, // in-world, neutral, p1 has no presence/vision there
			],
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			(function () {
				return [
					Game.rooms['W3N3'] ? 'visible' : 'no-vision',
					Game.map.getRoomStatus('W3N3').status,
				];
			})()
		`);
		// No vision of W3N3, but its world status is still normal (in-world room).
		expect(result).toEqual(['no-vision', 'normal']);
	});
});
