import { describe, test, expect, code,
	OK,
	STRUCTURE_NUKER,
	NUKER_ENERGY_CAPACITY, NUKER_GHODIUM_CAPACITY,
	NUKE_LAND_TIME,
} from '../../src/index.js';
import { nukeFlightVisibilityCases } from '../../src/matrices/nuke-flight-visibility.js';

describe('Nuke flight', () => {
	// ---- NUKE-FLIGHT-001: launching creates a Nuke object in the target room ----
	test('NUKE-FLIGHT-001 launching a nuke creates a Nuke object in the target room with launchRoomName and timeToLand', async ({ shard }) => {
		shard.requires('nuke');
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 8, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});

		const nukerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_NUKER, owner: 'p1',
			store: { energy: NUKER_ENERGY_CAPACITY, G: NUKER_GHODIUM_CAPACITY },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const nuker = Game.getObjectById(${nukerId});
			nuker.launchNuke(new RoomPosition(25, 25, 'W2N1'))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		// Read from p2 who owns the target room and thus has visibility.
		const nukeInfo = await shard.runPlayer('p2', code`
			const nukes = Game.rooms['W2N1'] ? Game.rooms['W2N1'].find(FIND_NUKES) : [];
			nukes.length > 0 ? {
				launchRoomName: nukes[0].launchRoomName,
				timeToLand: nukes[0].timeToLand,
				x: nukes[0].pos.x,
				y: nukes[0].pos.y,
			} : null
		`) as { launchRoomName: string; timeToLand: number; x: number; y: number } | null;
		expect(nukeInfo).not.toBeNull();
		expect(nukeInfo!.launchRoomName).toBe('W1N1');
		expect(nukeInfo!.timeToLand).toBeGreaterThan(0);
		expect(nukeInfo!.timeToLand).toBeLessThanOrEqual(NUKE_LAND_TIME);
		expect(nukeInfo!.x).toBe(25);
		expect(nukeInfo!.y).toBe(25);
	});

	// ---- NUKE-FLIGHT-002: timeToLand decreases by 1 each tick ----
	test('NUKE-FLIGHT-002 nuke.timeToLand decreases by 1 each tick', async ({ shard }) => {
		shard.requires('nuke');
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 8, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});

		const nukerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_NUKER, owner: 'p1',
			store: { energy: NUKER_ENERGY_CAPACITY, G: NUKER_GHODIUM_CAPACITY },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${nukerId}).launchNuke(new RoomPosition(25, 25, 'W2N1'))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const ttl1 = await shard.runPlayer('p2', code`
			const nukes = Game.rooms['W2N1'] ? Game.rooms['W2N1'].find(FIND_NUKES) : [];
			nukes.length > 0 ? nukes[0].timeToLand : null
		`) as number | null;
		expect(ttl1).not.toBeNull();

		await shard.tick(3);

		// runPlayer is another tick, so total elapsed since ttl1 read = 3 + 1 = 4.
		const ttl2 = await shard.runPlayer('p2', code`
			const nukes = Game.rooms['W2N1'] ? Game.rooms['W2N1'].find(FIND_NUKES) : [];
			nukes.length > 0 ? nukes[0].timeToLand : null
		`) as number | null;
		expect(ttl2).not.toBeNull();
		expect(ttl2).toBe(ttl1! - 4);
	});

	// ---- NUKE-FLIGHT-003: in-flight nuke is visible in target room ----
	test('NUKE-FLIGHT-003 an in-flight nuke is visible via FIND_NUKES in the target room', async ({ shard }) => {
		shard.requires('nuke');
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 8, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});

		const nukerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_NUKER, owner: 'p1',
			store: { energy: NUKER_ENERGY_CAPACITY, G: NUKER_GHODIUM_CAPACITY },
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Game.getObjectById(${nukerId}).launchNuke(new RoomPosition(25, 25, 'W2N1'))
		`);
		await shard.tick();

		const nukeCount = await shard.runPlayer('p2', code`
			const nukes = Game.rooms['W2N1'] ? Game.rooms['W2N1'].find(FIND_NUKES) : [];
			nukes.length
		`);
		expect(nukeCount).toBe(1);

		await shard.tick(5);

		const nukeCountLater = await shard.runPlayer('p2', code`
			const nukes = Game.rooms['W2N1'] ? Game.rooms['W2N1'].find(FIND_NUKES) : [];
			nukes.length
		`);
		expect(nukeCountLater).toBe(1);
	});

	for (const row of nukeFlightVisibilityCases) {
		test(`NUKE-FLIGHT-004:${row.label} in-flight nuke visibility follows player perspective`, async ({ shard }) => {
			shard.requires('nuke');
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [
					{ name: 'W1N1', rcl: 8, owner: 'p1' },
					{ name: 'W2N1', rcl: 1, owner: 'p2' },
				],
			});

			const nukerId = await shard.placeStructure('W1N1', {
				pos: [25, 25], structureType: STRUCTURE_NUKER, owner: 'p1',
				store: { energy: NUKER_ENERGY_CAPACITY, G: NUKER_GHODIUM_CAPACITY },
			});
			await shard.tick();

			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${nukerId}).launchNuke(new RoomPosition(25, 25, 'W2N1'))
			`);
			expect(rc).toBe(OK);
			await shard.tick();

			const observed = await shard.runPlayer(row.observer, code`
				const room = Game.rooms[${row.roomName}];
				room
					? { hasRoom: true, nukeCount: room.find(FIND_NUKES).length }
					: { hasRoom: false, nukeCount: null }
			`) as { hasRoom: boolean; nukeCount: number | null };
			expect(observed).toEqual({
				hasRoom: row.expectedHasRoom,
				nukeCount: row.expectedNukeCount,
			});
		});
	}

	test('NUKE-FLIGHT-005 landed nuke object is removed and no longer appears in FIND_NUKES', async ({ shard }) => {
		shard.requires('nuke');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});
		const nukeId = await shard.placeNuke('W1N1', {
			pos: [25, 25],
			launchRoomName: 'W2N1',
			timeToLand: 3,
		});

		const before = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].find(FIND_NUKES).length
		`);
		expect(before).toBe(1);

		await shard.tick(3);
		const after = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].find(FIND_NUKES).length
		`);
		expect(after).toBe(0);
		expect(await shard.getObject(nukeId)).toBeNull();
	});
});
