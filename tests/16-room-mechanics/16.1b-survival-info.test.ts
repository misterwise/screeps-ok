import { describe, test, expect, code } from '../../src/index.js';

describe('room survival info', () => {
	test('ROOM-SURVIVAL-001 survivalInfo is undefined when no survival game is active', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const room = Game.rooms['W1N1'];
			({
				typeofValue: typeof room.survivalInfo,
				isUndefined: room.survivalInfo === undefined,
				hasKey: 'survivalInfo' in room,
			})
		`) as { typeofValue: string; isUndefined: boolean; hasKey: boolean };

		expect(result).toEqual({
			typeofValue: 'undefined',
			isUndefined: true,
			hasKey: true,
		});
	});
});
