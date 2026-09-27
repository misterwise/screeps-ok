import { describe, test, expect, code,
	OK,
	MOVE, TOUGH, body,
	STRUCTURE_TOWER, STRUCTURE_SPAWN,
	TOWER_POWER_ATTACK, TOWER_ENERGY_COST, TOWER_CAPACITY,
	BODYPART_HITS, SAFE_MODE_DURATION,
} from '../../src/index.js';

// Section 7.15 — Safe Mode combat effects.
//
// Each hostile creep intent's safe-mode refusal is a condition of its
// validation row (COMBAT-MELEE-009:safeMode, …). The two entries here cover
// the orthogonal positive cases:
//   - Owned-room defenses (towers) continue to operate.
//   - Hostile creeps walking onto a player's construction sites do NOT destroy them
//     while safe mode is active.

describe('Safe mode combat effects', () => {
	test('SAFEMODE-COMBAT-001 a tower in a safe-moded room can still attack a hostile creep', async ({ shard }) => {
		// Neither the tower's API check (game/structures.js:766-783) nor its
		// processor (towers/attack.js) reads safe mode.
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 3, owner: 'p1', safeMode: SAFE_MODE_DURATION },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const towerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
			store: { energy: TOWER_CAPACITY },
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2',
			body: body(9, TOUGH, MOVE),
		});

		const result = await shard.runPlayer('p1', code`[
			Game.rooms.W1N1.controller.safeMode,
			Game.getObjectById(${towerId}).attack(Game.getObjectById(${targetId})),
		]`);
		expect(result).toEqual([SAFE_MODE_DURATION, OK]);
		expect((await shard.expectObject(targetId, 'creep')).hits).toBe(10 * BODYPART_HITS - TOWER_POWER_ATTACK);
		expect((await shard.expectStructure(towerId, STRUCTURE_TOWER)).store.energy).toBe(TOWER_CAPACITY - TOWER_ENERGY_COST);
	});

	test('SAFEMODE-COMBAT-002 hostile creeps cannot stomp a player\'s construction sites during safe mode', async ({ shard }) => {
		// Vanilla movement.js:224 destroys a hostile site only when the room's
		// controller isn't another player's in safe mode.
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 3, owner: 'p1', safeMode: SAFE_MODE_DURATION },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const progress = 100;
		const siteId = await shard.placeSite('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1', progress,
		});
		const stomperId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2', body: [MOVE],
		});

		const results = await shard.runPlayers({
			p1: code`Game.rooms.W1N1.controller.safeMode`,
			p2: code`Game.getObjectById(${stomperId}).move(TOP)`,
		});
		expect(results).toEqual({ p1: SAFE_MODE_DURATION, p2: OK });
		// The stomper stepped onto the site; safe mode only skipped the stomp.
		expect((await shard.expectObject(stomperId, 'creep')).pos).toMatchObject({ x: 25, y: 25 });
		expect((await shard.expectObject(siteId, 'site')).progress).toBe(progress);
	});
});
