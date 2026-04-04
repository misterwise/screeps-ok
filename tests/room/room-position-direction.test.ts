import { describe, test, expect, code } from '../../src/index.js';
import { roomPositionDirectionCases } from '../support/matrices/roompos-direction.js';

describe('RoomPosition.getDirectionTo()', () => {
	for (const { label, target, expectedDirection } of roomPositionDirectionCases) {
		test(`ROOMPOS-SPATIAL-005 [${label}] getDirectionTo() returns the expected direction constant`, async ({ shard }) => {
			await shard.ownedRoom('p1');

			const direction = await shard.runPlayer('p1', code`
				new RoomPosition(25, 25, 'W1N1').getDirectionTo(${target.x}, ${target.y})
			`);

			expect(direction).toBe(expectedDirection);
		});
	}
});
