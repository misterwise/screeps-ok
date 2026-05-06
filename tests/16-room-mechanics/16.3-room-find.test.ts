import { describe, test, expect, code,
	MOVE,
	FIND_EXIT_TOP, FIND_EXIT_RIGHT, FIND_EXIT_BOTTOM, FIND_EXIT_LEFT, FIND_EXIT,
	FIND_MY_CREEPS, FIND_HOSTILE_CREEPS,
	FIND_MY_STRUCTURES, FIND_HOSTILE_STRUCTURES,
	STRUCTURE_SPAWN,
} from '../../src/index.js';

describe('Room.find exit constants', () => {
	test('ROOM-FIND-003 FIND_EXIT_TOP/RIGHT/BOTTOM/LEFT return walkable border tiles on that side, with no duplicates', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const room = Game.rooms['W1N1'];
			const terrain = room.getTerrain();
			const sides = {
				top: { positions: room.find(FIND_EXIT_TOP), edge: 'y0' },
				right: { positions: room.find(FIND_EXIT_RIGHT), edge: 'x49' },
				bottom: { positions: room.find(FIND_EXIT_BOTTOM), edge: 'y49' },
				left: { positions: room.find(FIND_EXIT_LEFT), edge: 'x0' },
			};
			const summary = {};
			for (const [side, { positions, edge }] of Object.entries(sides)) {
				const onEdge = positions.every(p => {
					if (edge === 'y0') return p.y === 0;
					if (edge === 'y49') return p.y === 49;
					if (edge === 'x0') return p.x === 0;
					if (edge === 'x49') return p.x === 49;
				});
				const inRange = positions.every(p =>
					p.x >= 0 && p.x <= 49 && p.y >= 0 && p.y <= 49
				);
				const walkable = positions.every(p =>
					terrain.get(p.x, p.y) !== TERRAIN_MASK_WALL
				);
				const keys = positions.map(p => p.x + ',' + p.y);
				const unique = keys.length === new Set(keys).size;
				const isRoomPos = positions.every(p =>
					p instanceof RoomPosition && p.roomName === 'W1N1'
				);
				summary[side] = {
					count: positions.length,
					onEdge, inRange, walkable, unique, isRoomPos,
				};
			}
			summary
		`) as Record<'top'|'right'|'bottom'|'left', {
			count: number;
			onEdge: boolean;
			inRange: boolean;
			walkable: boolean;
			unique: boolean;
			isRoomPos: boolean;
		}>;

		for (const side of ['top', 'right', 'bottom', 'left'] as const) {
			expect(result[side].count).toBeGreaterThan(0);
			expect(result[side].onEdge).toBe(true);
			expect(result[side].inRange).toBe(true);
			expect(result[side].walkable).toBe(true);
			expect(result[side].unique).toBe(true);
			expect(result[side].isRoomPos).toBe(true);
		}
	});

	test('ROOM-FIND-004 FIND_EXIT returns the union (as a set) of the four side-specific exit sets', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const room = Game.rooms['W1N1'];
			const serialize = ps => ps.map(p => p.x + ',' + p.y).sort();
			const sides = [
				...room.find(FIND_EXIT_TOP),
				...room.find(FIND_EXIT_RIGHT),
				...room.find(FIND_EXIT_BOTTOM),
				...room.find(FIND_EXIT_LEFT),
			];
			const all = room.find(FIND_EXIT);
			({
				sidesKeys: serialize(sides),
				allKeys: serialize(all),
				allOnBorder: all.every(p =>
					p.x === 0 || p.x === 49 || p.y === 0 || p.y === 49
				),
				allUnique: all.length === new Set(serialize(all)).size,
			})
		`) as { sidesKeys: string[]; allKeys: string[]; allOnBorder: boolean; allUnique: boolean };

		expect(result.allKeys.length).toBeGreaterThan(0);
		expect(result.allKeys).toEqual(result.sidesKeys);
		expect(result.allOnBorder).toBe(true);
		expect(result.allUnique).toBe(true);
	});
});

describe('Room.find player-relative perspective', () => {
	test('ROOM-FIND-006 player-relative FIND constants invert when evaluated from each player\'s perspective', async ({ shard }) => {
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
		await shard.placeStructure('W1N1', {
			pos: [24, 25], owner: 'p1', structureType: STRUCTURE_SPAWN,
		});
		await shard.placeStructure('W1N1', {
			pos: [27, 25], owner: 'p2', structureType: STRUCTURE_SPAWN,
		});
		await shard.tick();

		const probe = code`
			const room = Game.rooms['W1N1'];
			({
				myCreeps: room.find(FIND_MY_CREEPS).map(c => c.name).sort(),
				hostileCreeps: room.find(FIND_HOSTILE_CREEPS).map(c => c.name).sort(),
				myStructures: room.find(FIND_MY_STRUCTURES).map(s => s.structureType).sort(),
				hostileStructures: room.find(FIND_HOSTILE_STRUCTURES).map(s => s.structureType).sort(),
			})
		`;
		const views = await shard.runPlayers({ p1: probe, p2: probe }) as Record<'p1'|'p2', {
			myCreeps: string[];
			hostileCreeps: string[];
			myStructures: string[];
			hostileStructures: string[];
		}>;

		expect(views.p1).toEqual({
			myCreeps: ['Alpha'],
			hostileCreeps: ['Bravo'],
			myStructures: ['controller', 'spawn'],
			hostileStructures: ['spawn'],
		});
		// p2 sees the inverse: Bravo is mine, Alpha is hostile, p1's controller
		// and spawn are hostile-owned, p2 has no structures of its own.
		expect(views.p2).toEqual({
			myCreeps: ['Bravo'],
			hostileCreeps: ['Alpha'],
			myStructures: ['spawn'],
			hostileStructures: ['controller', 'spawn'],
		});
	});
});
