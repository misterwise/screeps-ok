import { describe, test, expect, code,
	OK, ERR_INVALID_TARGET,
	MOVE, TOUGH, ATTACK, body,
	STRUCTURE_TOWER, STRUCTURE_RAMPART, STRUCTURE_ROAD,
	TOWER_POWER_ATTACK, TOWER_POWER_HEAL, TOWER_POWER_REPAIR,
	TOWER_ENERGY_COST, BODYPART_HITS, RAMPART_HITS,
} from '../../src/index.js';

describe('Tower intent priority', () => {
	// Shared setup for TOWER-INTENT-001/002/003:
	// Tower with energy, an enemy creep (attack target), a damaged friendly
	// creep (heal target), and a damaged friendly rampart (repair target).
	// All within optimal range (range <= 5) for deterministic amounts.

	test('TOWER-INTENT-001 a tower performs at most one of attack, heal, or repair in a tick', async ({ shard }) => {
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

		// Enemy creep at range 3 (attack target)
		const enemyId = await shard.placeCreep('W1N1', {
			pos: [25, 28], owner: 'p2',
			body: body(9, TOUGH, MOVE),
		});

		// Friendly creep at range 2 (heal target) — damage it first
		const friendlyId = await shard.placeCreep('W1N1', {
			pos: [25, 27], owner: 'p1',
			body: body(5, TOUGH, MOVE),
		});
		const damager = await shard.placeCreep('W1N1', {
			pos: [24, 27], owner: 'p2',
			body: body(10, ATTACK, MOVE),
		});
		await shard.runPlayer('p2', code`
			Game.getObjectById(${damager}).attack(Game.getObjectById(${friendlyId}))
		`);
		await shard.tick();

		const injured = await shard.expectObject(friendlyId, 'creep');
		expect(injured.hits).toBeLessThan(10 * BODYPART_HITS);

		// Damaged rampart at range 1 (repair target)
		const rampartId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_RAMPART, owner: 'p1',
			hits: RAMPART_HITS,
		});

		// Snapshot before intents
		const enemyBefore = await shard.expectObject(enemyId, 'creep');
		const friendlyBefore = await shard.expectObject(friendlyId, 'creep');
		const rampartBefore = await shard.expectStructure(rampartId, STRUCTURE_RAMPART);

		// Issue all three intents in one tick
		await shard.runPlayer('p1', code`
			const tower = Game.getObjectById(${towerId});
			const healRc = tower.heal(Game.getObjectById(${friendlyId}));
			const repairRc = tower.repair(Game.getObjectById(${rampartId}));
			const attackRc = tower.attack(Game.getObjectById(${enemyId}));
			({ healRc, repairRc, attackRc })
		`);
		await shard.tick();

		const enemyAfter = await shard.expectObject(enemyId, 'creep');
		const friendlyAfter = await shard.expectObject(friendlyId, 'creep');
		const rampartAfter = await shard.expectStructure(rampartId, STRUCTURE_RAMPART);

		// Count how many effects actually resolved
		const attackResolved = enemyAfter.hits < enemyBefore.hits;
		const healResolved = friendlyAfter.hits > friendlyBefore.hits;
		const repairResolved = rampartAfter.hits > rampartBefore.hits;
		const effectCount = [attackResolved, healResolved, repairResolved].filter(Boolean).length;

		expect(effectCount).toBe(1);

		// Tower spent exactly one action's energy
		const tower = await shard.expectStructure(towerId, STRUCTURE_TOWER);
		expect(tower.store.energy).toBe(1000 - TOWER_ENERGY_COST);
	});

	test('TOWER-INTENT-002 when heal, repair, and attack are all queued, heal is preferred', async ({ shard }) => {
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

		// Enemy creep at range 3
		const enemyId = await shard.placeCreep('W1N1', {
			pos: [25, 28], owner: 'p2',
			body: body(9, TOUGH, MOVE),
		});

		// Friendly creep with many HP so heal doesn't cap at hitsMax.
		// 20 parts = 2000 HP. 10-ATTACK deals 300 → 1700 remaining. Heal 400 → 2100 → capped at 2000.
		// Need even more parts. 30 parts = 3000 HP. 300 damage → 2700. Heal 400 → 3100 → cap 3000. Still caps.
		// Use a 1-ATTACK damager: deals 30 damage. 2000 - 30 = 1970. Heal 400 → 2370 → cap 2000. Still caps.
		// Better: big friendly (20 parts=2000), big attack (20 ATTACK = 600 dmg). 2000-600=1400. +400=1800. Under 2000.
		const friendlyId = await shard.placeCreep('W1N1', {
			pos: [25, 27], owner: 'p1',
			body: body(10, TOUGH, 10, MOVE),
		});
		const damager = await shard.placeCreep('W1N1', {
			pos: [24, 27], owner: 'p2',
			body: body(20, ATTACK, MOVE),
		});
		await shard.runPlayer('p2', code`
			Game.getObjectById(${damager}).attack(Game.getObjectById(${friendlyId}))
		`);
		await shard.tick();

		const injured = await shard.expectObject(friendlyId, 'creep');
		const injuredHits = injured.hits;
		expect(injuredHits).toBeLessThan(2000); // Should be 2000 - 600 = 1400

		// Damaged rampart at range 1
		const rampartId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_RAMPART, owner: 'p1',
			hits: RAMPART_HITS,
		});
		await shard.tick();

		// Issue all three intents — heal should win
		await shard.runPlayer('p1', code`
			const tower = Game.getObjectById(${towerId});
			tower.heal(Game.getObjectById(${friendlyId}));
			tower.repair(Game.getObjectById(${rampartId}));
			tower.attack(Game.getObjectById(${enemyId}));
		`);
		await shard.tick();

		const friendlyAfter = await shard.expectObject(friendlyId, 'creep');
		expect(friendlyAfter.hits).toBe(injuredHits + TOWER_POWER_HEAL);
	});

	test('TOWER-INTENT-003 lower-priority tower intents do not execute after the chosen action resolves', async ({ shard }) => {
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

		// Enemy creep at range 3
		const enemyId = await shard.placeCreep('W1N1', {
			pos: [25, 28], owner: 'p2',
			body: body(9, TOUGH, MOVE),
		});

		// Friendly creep at range 2 — damage it
		const friendlyId = await shard.placeCreep('W1N1', {
			pos: [25, 27], owner: 'p1',
			body: body(5, TOUGH, MOVE),
		});
		const damager = await shard.placeCreep('W1N1', {
			pos: [24, 27], owner: 'p2',
			body: body(10, ATTACK, MOVE),
		});
		await shard.runPlayer('p2', code`
			Game.getObjectById(${damager}).attack(Game.getObjectById(${friendlyId}))
		`);
		await shard.tick();

		// Damaged rampart at range 1
		const rampartId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_RAMPART, owner: 'p1',
			hits: RAMPART_HITS,
		});

		// Snapshot before
		const enemyBefore = await shard.expectObject(enemyId, 'creep');
		const rampartBefore = await shard.expectStructure(rampartId, STRUCTURE_RAMPART);

		// Issue all three — heal wins; repair and attack must not execute
		await shard.runPlayer('p1', code`
			const tower = Game.getObjectById(${towerId});
			tower.heal(Game.getObjectById(${friendlyId}));
			tower.repair(Game.getObjectById(${rampartId}));
			tower.attack(Game.getObjectById(${enemyId}));
		`);
		await shard.tick();

		const enemyAfter = await shard.expectObject(enemyId, 'creep');
		expect(enemyAfter.hits).toBe(enemyBefore.hits);

		const rampartAfter = await shard.expectStructure(rampartId, STRUCTURE_RAMPART);
		expect(rampartAfter.hits).toBe(rampartBefore.hits);
	});
});

describe('Tower target acceptance', () => {
	test('TOWER-ATTACK-003 tower.attack() accepts hostile creeps, rejects non-attackable targets', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 3, owner: 'p1' }],
		});
		const towerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
			store: { energy: 1000 },
		});

		// Hostile creep at range 3 — attack should return OK and deal damage
		const hostileId = await shard.placeCreep('W1N1', {
			pos: [25, 28], owner: 'p2',
			body: body(9, TOUGH, MOVE),
		});
		const attackRc = await shard.runPlayer('p1', code`
			Game.getObjectById(${towerId}).attack(Game.getObjectById(${hostileId}))
		`);
		expect(attackRc).toBe(OK);
		await shard.tick();

		const hostile = await shard.expectObject(hostileId, 'creep');
		expect(hostile.hits).toBe(1000 - TOWER_POWER_ATTACK);

		// Construction site — tower.attack on a non-attackable object returns ERR_INVALID_TARGET
		const siteId = await shard.placeSite('W1N1', {
			pos: [25, 27], owner: 'p1',
			structureType: STRUCTURE_ROAD,
		});
		const siteRc = await shard.runPlayer('p1', code`
			Game.getObjectById(${towerId}).attack(Game.getObjectById(${siteId}))
		`);
		expect(siteRc).toBe(ERR_INVALID_TARGET);
	});

	test('TOWER-REPAIR-003 tower.repair() accepts damaged structures, rejects creeps and non-repairable targets', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 3, owner: 'p1' }],
		});
		const towerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
			store: { energy: 1000 },
		});

		// Damaged rampart at range 1 — repair should return OK and restore HP
		const rampartId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_RAMPART, owner: 'p1',
			hits: RAMPART_HITS,
		});
		const repairRc = await shard.runPlayer('p1', code`
			Game.getObjectById(${towerId}).repair(Game.getObjectById(${rampartId}))
		`);
		expect(repairRc).toBe(OK);
		await shard.tick();

		const rampart = await shard.expectStructure(rampartId, STRUCTURE_RAMPART);
		expect(rampart.hits).toBe(RAMPART_HITS + TOWER_POWER_REPAIR);

		// Creep at range 2 — repair should return ERR_INVALID_TARGET
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 27], owner: 'p1',
			body: [TOUGH, MOVE],
		});
		const creepRc = await shard.runPlayer('p1', code`
			Game.getObjectById(${towerId}).repair(Game.getObjectById(${creepId}))
		`);
		expect(creepRc).toBe(ERR_INVALID_TARGET);
	});
});
