import { describe, test, expect, code, OK, STRUCTURE_TERMINAL, STRUCTURE_STORAGE } from '../../src/index.js';

// `room.storage` / `room.terminal` are shortcuts to the BUILT structure. A
// ConstructionSite carries the same `structureType`, so an implementation that
// scans room objects by structureType alone hands the bot a ConstructionSite —
// which has no isActive/store/send. A real bot's first call on it throws
// (`this.room.terminal.isActive is not a function`) and takes down whatever was
// running. Previously uncovered: every existing test builds the structure first,
// so the site-present-but-structure-absent window is never exercised.
describe('ROOM-SHORTCUT-SITE-001: room.storage/room.terminal are never a construction site', () => {
	test('a terminal/storage construction site does not populate the shortcut', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});
		await shard.tick();

		const placed = await shard.runPlayer('p1', code`
			[
				Game.rooms['W1N1'].createConstructionSite(20, 20, ${STRUCTURE_TERMINAL}),
				Game.rooms['W1N1'].createConstructionSite(22, 20, ${STRUCTURE_STORAGE}),
			]
		`);
		expect(placed).toEqual([OK, OK]);
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			(function () {
				const rm = Game.rooms['W1N1'];
				return {
					terminal: rm.terminal === undefined ? 'undefined' : typeof rm.terminal.isActive,
					storage: rm.storage === undefined ? 'undefined' : typeof rm.storage.isActive,
					sites: Object.keys(Game.constructionSites).length,
				};
			})()
		`) as { terminal: string; storage: string; sites: number };

		expect(result.sites).toBe(2);
		expect(result.terminal).toBe('undefined');
		expect(result.storage).toBe('undefined');
	});
});

// Two documented Room methods that are easy to leave out because nothing else
// depends on them internally.
describe('ROOM-API-001: Room.getPositionAt and Room.findExitTo', () => {
	test('getPositionAt returns a RoomPosition in this room and null out of bounds', async ({ shard }) => {
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

	test('findExitTo agrees with Game.map.describeExits', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }, { name: 'W2N1' }],
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			(function () {
				const exits = Game.map.describeExits('W1N1');
				let expected = null;
				for (const dir in exits) { if (exits[dir] === 'W2N1') expected = Number(dir); }
				return [Game.rooms['W1N1'].findExitTo('W2N1'), expected];
			})()
		`) as [number, number];

		expect(result[0]).toBe(result[1]);
	});
});
