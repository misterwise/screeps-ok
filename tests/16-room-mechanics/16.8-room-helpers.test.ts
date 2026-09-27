import { describe, test, expect, code, FIND_EXIT_LEFT } from '../../src/index.js';

// Two documented Room methods that are easy to leave out because nothing else
// depends on them internally.
describe('Room helpers: getPositionAt and findExitTo', () => {
	test('ROOM-API-001 getPositionAt returns a RoomPosition in this room and null out of bounds', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			(function () {
				const rm = Game.rooms['W1N1'];
				const p = rm.getPositionAt(12, 34);
				return {
					x: p.x, y: p.y, roomName: p.roomName,
					isPos: p instanceof RoomPosition,
					oob: rm.getPositionAt(50, 10),
				};
			})()
		`) as { x: number; y: number; roomName: string; isPos: boolean; oob: unknown };

		expect(result.x).toBe(12);
		expect(result.y).toBe(34);
		expect(result.roomName).toBe('W1N1');
		expect(result.isPos).toBe(true);
		expect(result.oob).toBe(null);
	});

	test('ROOM-API-002 findExitTo agrees with Game.map.describeExits', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }, { name: 'W2N1' }],
		});

		// W2N1 lies west: FIND_EXIT_LEFT, the value describeExits keys it under.
		const result = await shard.runPlayer('p1', code`
			[Game.rooms['W1N1'].findExitTo('W2N1'), Game.map.describeExits('W1N1')[${FIND_EXIT_LEFT}]]
		`);
		expect(result).toEqual([FIND_EXIT_LEFT, 'W2N1']);
	});
});
