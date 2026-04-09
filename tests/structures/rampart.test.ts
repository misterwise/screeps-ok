import { describe, test, expect, code,
	OK, ERR_NOT_OWNER,
	STRUCTURE_RAMPART, STRUCTURE_TOWER, STRUCTURE_NUKER, STRUCTURE_SPAWN,
	ATTACK, MOVE, TOUGH, body,
	ATTACK_POWER, TOWER_POWER_ATTACK,
	RAMPART_DECAY_AMOUNT, RAMPART_DECAY_TIME,
	NUKE_DAMAGE, NUKER_ENERGY_CAPACITY, NUKER_GHODIUM_CAPACITY,
} from '../../src/index.js';
import { rampartHitsMaxCases } from '../support/matrices/rampart-hitsmax.js';

describe('StructureRampart', () => {
	for (const { rcl, expectedHitsMax } of rampartHitsMaxCases) {
		test(`RAMPART-DECAY-003 [rcl=${rcl}] owned rampart hitsMax matches the canonical table`, async ({ shard }) => {
			await shard.ownedRoom('p1', 'W1N1', rcl);
			const rampartId = await shard.placeStructure('W1N1', {
				pos: [25, 25],
				structureType: STRUCTURE_RAMPART,
				owner: 'p1',
				hits: 1,
			});
			await shard.tick();

			const rampart = await shard.expectStructure(rampartId, STRUCTURE_RAMPART);
			expect(rampart.hitsMax).toBe(expectedHitsMax);
		});
	}

	test('RAMPART-PROTECT-001 tower.attack on a tile with a rampart damages the rampart, not the creep', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 3, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const towerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
			store: { energy: 1000 },
		});
		const rampartId = await shard.placeStructure('W1N1', {
			pos: [25, 28], structureType: STRUCTURE_RAMPART, owner: 'p1',
			hits: 10000000,
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 28], owner: 'p2',
			body: body(5, TOUGH, MOVE),
		});

		// Tower attacks the creep, but the rampart on that tile absorbs damage.
		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${towerId}).attack(Game.getObjectById(${creepId}))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		// Creep takes zero damage; rampart absorbs the tower hit.
		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.hits).toBe(600); // 6 parts (5 TOUGH + 1 MOVE) * 100

		const rampart = await shard.expectStructure(rampartId, STRUCTURE_RAMPART);
		expect(rampart.hits).toBe(10000000 - TOWER_POWER_ATTACK);
	});

	test('RAMPART-PROTECT-002 creep.attack on a rampart-covered structure damages the rampart', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 3, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const towerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
			store: { energy: 1000 },
		});
		const rampartId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_RAMPART, owner: 'p1',
			hits: 10000000,
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2',
			body: [ATTACK, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p2', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${towerId}))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		// Tower takes zero damage; rampart absorbs the creep attack.
		const tower = await shard.expectStructure(towerId, STRUCTURE_TOWER);
		expect(tower.hits).toBe(3000);

		const rampart = await shard.expectStructure(rampartId, STRUCTURE_RAMPART);
		expect(rampart.hits).toBe(10000000 - ATTACK_POWER);
	});

	test('RAMPART-PROTECT-003 a non-public hostile rampart blocks hostile creep movement', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 3, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_RAMPART, owner: 'p1',
			hits: 10000,
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2',
			body: [MOVE],
		});
		await shard.tick();

		// Rampart is non-public by default — hostile cannot move onto it.
		const rc = await shard.runPlayer('p2', code`
			Game.getObjectById(${creepId}).move(TOP)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		// Creep should remain at [25,26] — blocked by the non-public rampart.
		expect(creep.pos.y).toBe(26);
	});

	test('RAMPART-PROTECT-004 hostile creep can move onto a public rampart', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 3, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_RAMPART, owner: 'p1',
			hits: 10000,
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2',
			body: [MOVE],
		});
		await shard.tick();

		// Make the rampart public, then move onto it next tick.
		await shard.runPlayer('p1', code`
			const structs = Game.rooms['W1N1'].lookForAt(LOOK_STRUCTURES, 25, 25);
			const rampart = structs.find(s => s.structureType === 'rampart');
			rampart.setPublic(true)
		`);
		await shard.tick();

		const rc = await shard.runPlayer('p2', code`
			Game.getObjectById(${creepId}).move(TOP)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.pos.y).toBe(25);
	});

	test('RAMPART-PROTECT-005 setPublic(true) sets isPublic to true', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const rampartId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_RAMPART, owner: 'p1',
			hits: 10000,
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${rampartId}).setPublic(true)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const isPublic = await shard.runPlayer('p1', code`
			Game.getObjectById(${rampartId}).isPublic
		`);
		expect(isPublic).toBe(true);
	});

	test('RAMPART-PROTECT-006 setPublic(false) sets isPublic to false', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const rampartId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_RAMPART, owner: 'p1',
			hits: 10000,
		});
		await shard.tick();

		// First set it public, then revert.
		await shard.runPlayer('p1', code`
			Game.getObjectById(${rampartId}).setPublic(true)
		`);
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${rampartId}).setPublic(false)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const isPublic = await shard.runPlayer('p1', code`
			Game.getObjectById(${rampartId}).isPublic
		`);
		expect(isPublic).toBe(false);
	});

	test('RAMPART-PROTECT-007 setPublic returns ERR_NOT_OWNER on a rampart not owned by the player', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 2, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_RAMPART, owner: 'p1',
			hits: 10000,
		});
		// Place p2 creep in the room so p2 has visibility.
		await shard.placeCreep('W1N1', {
			pos: [26, 25], owner: 'p2', body: [MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p2', code`
			const structs = Game.rooms['W1N1'].lookForAt(LOOK_STRUCTURES, 25, 25);
			const rampart = structs.find(s => s.structureType === 'rampart');
			rampart ? rampart.setPublic(true) : -99
		`);
		expect(rc).toBe(ERR_NOT_OWNER);
	});

	// ── Rampart Decay ───────────────────────────────────────────

	test('RAMPART-DECAY-001 a rampart loses RAMPART_DECAY_AMOUNT hits per decay interval', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const rampartId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_RAMPART, owner: 'p1',
			hits: 100000,
			ticksToDecay: 5,
		});

		const before = await shard.expectStructure(rampartId, STRUCTURE_RAMPART);
		expect(before.hits).toBe(100000);

		// Tick past the decay point.
		await shard.tick(5);

		const after = await shard.expectStructure(rampartId, STRUCTURE_RAMPART);
		expect(before.hits - after.hits).toBe(RAMPART_DECAY_AMOUNT);
	});

	test('RAMPART-DECAY-002 a rampart is removed when decay reduces hits to 0', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const rampartId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_RAMPART, owner: 'p1',
			hits: RAMPART_DECAY_AMOUNT,
			ticksToDecay: 3,
		});

		await shard.tick(3);

		const obj = await shard.getObject(rampartId);
		expect(obj).toBeNull();
	});

	// ── Nuke Damage ────────────────────────────────────────────

	test('RAMPART-PROTECT-008 nuke damage is applied to the rampart before other structures on the same tile', async ({ shard }) => {
		shard.requires('nuke');
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 8, owner: 'p1' },
			],
		});

		// Rampart with enough hits to fully absorb nuke ground-zero damage (10M).
		const nukeDamage = NUKE_DAMAGE[0]; // 10,000,000
		const rampartHits = nukeDamage + 1000000; // 11M — survives with 1M remaining.
		const rampartId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_RAMPART, owner: 'p1',
			hits: rampartHits,
		});
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
		});

		// Place an in-flight nuke landing in 3 ticks.
		await shard.placeNuke('W1N1', {
			pos: [25, 25],
			launchRoomName: 'W2N1',
			timeToLand: 3,
		});
		await shard.tick();

		const spawnBefore = await shard.expectStructure(spawnId, STRUCTURE_SPAWN);
		const spawnHitsBefore = spawnBefore.hits;

		// Advance until nuke lands.
		await shard.tick(3);

		// After landing: rampart absorbed the full nuke damage, spawn is undamaged.
		const rampart = await shard.expectStructure(rampartId, STRUCTURE_RAMPART);
		expect(rampart.hits).toBe(rampartHits - nukeDamage);

		const spawnAfter = await shard.expectStructure(spawnId, STRUCTURE_SPAWN);
		expect(spawnAfter.hits).toBe(spawnHitsBefore);
	});
});
