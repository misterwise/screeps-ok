import { describe, test, expect, code,
	MOVE,
	FIND_EXIT_TOP, FIND_EXIT_RIGHT, FIND_EXIT_BOTTOM, FIND_EXIT_LEFT, FIND_EXIT,
	FIND_MY_CREEPS, FIND_HOSTILE_CREEPS,
} from '../../src/index.js';
import { knownParityGap } from '../support/parity-gaps.js';

describe('Room.find exit constants', () => {
	knownParityGap('describe-exits-topology')('ROOM-FIND-003 FIND_EXIT_TOP/RIGHT/BOTTOM/LEFT return walkable border positions on that side', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const room = Game.rooms['W1N1'];
			const top = room.find(FIND_EXIT_TOP);
			const right = room.find(FIND_EXIT_RIGHT);
			const bottom = room.find(FIND_EXIT_BOTTOM);
			const left = room.find(FIND_EXIT_LEFT);
			({
				topCount: top.length,
				topAllY0: top.every(p => p.y === 0),
				topXRange: top.every(p => p.x >= 0 && p.x <= 49),
				rightCount: right.length,
				rightAllX49: right.every(p => p.x === 49),
				rightYRange: right.every(p => p.y >= 0 && p.y <= 49),
				bottomCount: bottom.length,
				bottomAllY49: bottom.every(p => p.y === 49),
				bottomXRange: bottom.every(p => p.x >= 0 && p.x <= 49),
				leftCount: left.length,
				leftAllX0: left.every(p => p.x === 0),
				leftYRange: left.every(p => p.y >= 0 && p.y <= 49),
			})
		`) as {
			topCount: number; topAllY0: boolean; topXRange: boolean;
			rightCount: number; rightAllX49: boolean; rightYRange: boolean;
			bottomCount: number; bottomAllY49: boolean; bottomXRange: boolean;
			leftCount: number; leftAllX0: boolean; leftYRange: boolean;
		};

		// Each side should return at least one exit position.
		expect(result.topCount).toBeGreaterThan(0);
		expect(result.topAllY0).toBe(true);
		expect(result.topXRange).toBe(true);

		expect(result.rightCount).toBeGreaterThan(0);
		expect(result.rightAllX49).toBe(true);
		expect(result.rightYRange).toBe(true);

		expect(result.bottomCount).toBeGreaterThan(0);
		expect(result.bottomAllY49).toBe(true);
		expect(result.bottomXRange).toBe(true);

		expect(result.leftCount).toBeGreaterThan(0);
		expect(result.leftAllX0).toBe(true);
		expect(result.leftYRange).toBe(true);
	});

	test('ROOM-FIND-004 FIND_EXIT returns the concatenation of all four side-specific exit sets', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const room = Game.rooms['W1N1'];
			const top = room.find(FIND_EXIT_TOP);
			const right = room.find(FIND_EXIT_RIGHT);
			const bottom = room.find(FIND_EXIT_BOTTOM);
			const left = room.find(FIND_EXIT_LEFT);
			const all = room.find(FIND_EXIT);
			const sidesTotal = top.length + right.length + bottom.length + left.length;
			({
				allCount: all.length,
				sidesTotal,
				allOnBorder: all.every(p =>
					p.x === 0 || p.x === 49 || p.y === 0 || p.y === 49
				),
			})
		`) as { allCount: number; sidesTotal: number; allOnBorder: boolean };

		expect(result.allCount).toBe(result.sidesTotal);
		expect(result.allCount).toBeGreaterThan(0);
		expect(result.allOnBorder).toBe(true);
	});
});

describe('Room.find player-relative creep constants', () => {
	test('ROOM-FIND-006 FIND_MY_CREEPS and FIND_HOSTILE_CREEPS evaluate from the current player perspective', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE], name: 'Alpha',
		});
		await shard.placeCreep('W1N1', {
			pos: [26, 25], owner: 'p2', body: [MOVE], name: 'Bravo',
		});
		await shard.tick();

		// From p1's perspective: Alpha is mine, Bravo is hostile.
		const p1View = await shard.runPlayer('p1', code`
			const room = Game.rooms['W1N1'];
			({
				myNames: room.find(FIND_MY_CREEPS).map(c => c.name).sort(),
				hostileNames: room.find(FIND_HOSTILE_CREEPS).map(c => c.name).sort(),
			})
		`) as { myNames: string[]; hostileNames: string[] };

		expect(p1View.myNames).toEqual(['Alpha']);
		expect(p1View.hostileNames).toEqual(['Bravo']);
	});
});
