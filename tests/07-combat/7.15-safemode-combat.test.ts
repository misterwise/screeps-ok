import { describe, test, expect, code,
	OK,
	MOVE, TOUGH, body,
	STRUCTURE_TOWER, STRUCTURE_SPAWN,
	TOWER_POWER_ATTACK,
	BODYPART_HITS,
	FIND_CONSTRUCTION_SITES,
} from '../../src/index.js';

// Section 7.15 — Safe Mode combat effects.
//
// CTRL-SAFEMODE-006 (section 6.8) already covers the broader claim that hostile
// attack/rangedAttack/rangedMassAttack/dismantle intents are blocked while safe mode
// is active. The two entries here cover the orthogonal positive cases:
//   - Owned-room defenses (towers) continue to operate.
//   - Hostile creeps walking onto a player's construction sites do NOT destroy them
//     while safe mode is active.

describe('Safe mode combat effects', () => {
	test('SAFEMODE-COMBAT-001 a tower in a safe-moded room can still attack a hostile creep', async ({ shard }) => {
		// Engine: tower processor (@screeps/engine/src/processor/intents/towers/attack.js)
		// has no safeMode check; the runtime API check (game/structures.js:766+) also
		// has no safeMode gate. Towers operate normally during the room owner's safe mode.
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 3, owner: 'p1', safeModeAvailable: 1 },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const towerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
			store: { energy: 1000 },
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2', // adjacent (range 1) — full TOWER_POWER_ATTACK
			body: [...body(9, TOUGH), MOVE],
		});

		// Activate safe mode.
		const safeRc = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].controller.activateSafeMode()
		`);
		expect(safeRc).toBe(OK);
		await shard.tick();

		const before = await shard.expectObject(targetId, 'creep');
		const targetHitsBefore = before.hits;

		// Tower attacks hostile creep during the room owner's safe mode.
		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${towerId}).attack(Game.getObjectById(${targetId}))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		// Damage applied: tower operates during safe mode.
		const after = await shard.expectObject(targetId, 'creep');
		expect(after.hits).toBe(targetHitsBefore - TOWER_POWER_ATTACK);

		// Tower spent energy as usual.
		const tower = await shard.expectStructure(towerId, STRUCTURE_TOWER);
		expect(tower.store.energy).toBeLessThan(1000);
	});

	test('SAFEMODE-COMBAT-002 hostile creeps cannot stomp a player\'s construction sites during safe mode', async ({ shard }) => {
		// Engine: @screeps/engine/src/processor/intents/movement.js:224 — the
		// "destroy hostile site" branch is gated on
		// `!roomController || roomController.user === object.user || !(roomController.safeMode > gameTime)`.
		// While the room owner has active safe mode, a hostile creep that moves onto
		// the owner's construction site does NOT destroy it.
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 3, owner: 'p1', safeModeAvailable: 1 },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		// p1 owns the room. Place a p1 construction site at (25,25).
		const siteId = await shard.placeSite('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1', progress: 100,
		});

		// p2's hostile creep adjacent to the site, ready to walk onto it.
		// Note: hostile creeps cannot enter a safe-moded room without an existing
		// foothold (the runtime blocks new spawn-in), but a creep already in the
		// room before activation can still move within the room.
		const stomperId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2', body: [MOVE],
		});

		// Activate safe mode AFTER the hostile creep is in place.
		const safeRc = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].controller.activateSafeMode()
		`);
		expect(safeRc).toBe(OK);
		await shard.tick();

		// Hostile walks onto the site.
		const moveRc = await shard.runPlayer('p2', code`
			Game.getObjectById(${stomperId}).move(TOP)
		`);
		expect(moveRc).toBe(OK);
		await shard.tick();

		// Site still exists; safe mode protected it from stomping.
		const sites = await shard.findInRoom('W1N1', FIND_CONSTRUCTION_SITES);
		expect(sites.find(s => s.id === siteId)).toBeDefined();
	});
});
