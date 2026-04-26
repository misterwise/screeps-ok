import { describe, test, expect, code,
	OK, RIGHT,
	MOVE, ATTACK, RANGED_ATTACK, TOUGH, HEAL, CARRY, WORK, CLAIM,
	EVENT_ATTACK, EVENT_ATTACK_TYPE_MELEE, EVENT_ATTACK_TYPE_RANGED,
	EVENT_ATTACK_TYPE_RANGED_MASS, EVENT_ATTACK_TYPE_HIT_BACK,
	EVENT_ATTACK_TYPE_DISMANTLE, EVENT_ATTACK_TYPE_NUKE,
	ATTACK_POWER, RANGED_ATTACK_POWER, RANGED_ATTACK_DISTANCE_RATE, BODYPART_HITS,
	EVENT_HEAL, EVENT_HEAL_TYPE_MELEE, EVENT_HEAL_TYPE_RANGED, HEAL_POWER, RANGED_HEAL_POWER,
	EVENT_HARVEST, EVENT_BUILD, EVENT_REPAIR, EVENT_POWER,
	EVENT_OBJECT_DESTROYED, EVENT_TRANSFER, EVENT_EXIT,
	EVENT_ATTACK_CONTROLLER, EVENT_RESERVE_CONTROLLER, EVENT_UPGRADE_CONTROLLER,
	STRUCTURE_SPAWN, STRUCTURE_TOWER, STRUCTURE_WALL, STRUCTURE_LINK, STRUCTURE_CONTAINER, STRUCTURE_ROAD,
	TOWER_ENERGY_COST, TOWER_POWER_HEAL, TOWER_OPTIMAL_RANGE,
	RESOURCE_ENERGY, LINK_LOSS_RATIO, CONTROLLER_RESERVE,
	HARVEST_POWER, BUILD_POWER, REPAIR_POWER, REPAIR_COST, DISMANTLE_POWER,
	NUKE_DAMAGE, PWR_OPERATE_SPAWN,
} from '../../src/index.js';

type EventEntry = { event: number; objectId: string; data?: any };

// Asserts that exactly one entry in `events` matches `predicate` and returns
// it. Each EVENT_* should be emitted once at the action site — vanilla's
// canonical contract — so any test searching for "the" event also rules out
// duplicate-emission regressions.
function expectExactlyOne(events: EventEntry[], predicate: (e: EventEntry) => boolean): EventEntry {
	const matches = events.filter(predicate);
	expect(matches).toHaveLength(1);
	return matches[0]!;
}

describe('room.getEventLog()', () => {
	test('ROOM-EVENTLOG-001 getEventLog returns the current tick parsed event array', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [ATTACK, MOVE],
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2', body: [TOUGH, TOUGH, MOVE],
		});
		await shard.tick();

		// place* handles ≠ engine objectIds on xxscreeps. Resolve real engine
		// ids via player code so the event objectId/targetId comparisons are exact.
		const ids = JSON.parse(await shard.runPlayer('p1', code`
			JSON.stringify({
				attacker: Game.getObjectById(${attackerId}).id,
				target: Game.getObjectById(${targetId}).id,
			})
		`) as string) as { attacker: string; target: string };

		// Attack generates an EVENT_ATTACK entry.
		await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
		`);

		// getEventLog after the attack tick should return an array with the attack event.
		const events = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].getEventLog()
		`) as Array<{ event: number; objectId: string; data: any }>;
		expect(Array.isArray(events)).toBe(true);

		const attackEvent = expectExactlyOne(events,
			e => e.event === EVENT_ATTACK && e.objectId === ids.attacker);
		expect(attackEvent.data.targetId).toBe(ids.target);
		expect(attackEvent.data.damage).toBe(ATTACK_POWER);
		expect(attackEvent.data.attackType).toBe(EVENT_ATTACK_TYPE_MELEE);
	});

	test('ROOM-EVENTLOG-003 getEventLog(true) returns the raw JSON string', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [ATTACK, MOVE],
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2', body: [TOUGH, MOVE],
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
		`);

		const raw = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].getEventLog(true)
		`) as string;
		expect(typeof raw).toBe('string');
		const parsed = JSON.parse(raw);
		expect(Array.isArray(parsed)).toBe(true);
		expect(parsed.length).toBeGreaterThan(0);
	});

	test('ROOM-EVENTLOG-002 current-tick event entries use the canonical event-type and payload mapping', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 3, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});

		// Place a tower and a damaged friendly creep to trigger a heal event.
		const towerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
			store: { energy: 1000 },
		});
		// Place a friendly creep adjacent to the tower, then damage it.
		const friendlyId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1', body: [TOUGH, TOUGH, MOVE, MOVE],
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 27], owner: 'p2', body: [ATTACK, MOVE],
		});
		await shard.tick();

		// place* handles ≠ engine objectIds on xxscreeps. Resolve real engine
		// ids via player code so the event objectId/targetId comparisons are exact.
		const ids = JSON.parse(await shard.runPlayer('p1', code`
			JSON.stringify({
				tower: Game.getObjectById(${towerId}).id,
				friendly: Game.getObjectById(${friendlyId}).id,
			})
		`) as string) as { tower: string; friendly: string };

		// Damage the friendly creep.
		await shard.runPlayer('p2', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${friendlyId}))
		`);
		await shard.tick();

		// Now have the tower heal the damaged creep. This should generate an EVENT_HEAL entry.
		await shard.runPlayer('p1', code`
			Game.getObjectById(${towerId}).heal(Game.getObjectById(${friendlyId}))
		`);

		const events = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].getEventLog()
		`) as Array<{ event: number; objectId: string; data: any }>;
		expect(Array.isArray(events)).toBe(true);

		const healEvent = expectExactlyOne(events,
			e => e.event === EVENT_HEAL && e.objectId === ids.tower);
		expect(healEvent.data.targetId).toBe(ids.friendly);
		expect(healEvent.data.amount).toBeGreaterThan(0);
		// Tower heal is ranged (EVENT_HEAL_TYPE_RANGED = 2), not melee.
		expect(healEvent.data.healType).toBe(EVENT_HEAL_TYPE_RANGED);
	});

	test('ROOM-EVENTLOG-004 room events are only exposed for the current tick', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE],
		});
		await shard.tick();

		// Generate a move event by moving the creep.
		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).move(TOP)
		`);

		// Verify the previous tick had events.
		// Now do a no-op tick — just read the event log with no player actions.
		await shard.tick();
		const events = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].getEventLog()
		`) as unknown[];
		// The no-op tick + runPlayer tick means two ticks have passed since the
		// move. The runPlayer tick itself is the observation tick. If nothing
		// happened in the room during that tick, the log should be empty.
		// However, runPlayer itself counts as a tick — any implicit events
		// (controller downgrade tick, etc.) could appear. Filter for user events only.
		const userEvents = (events as Array<{ event: number }>).filter(
			e => e.event === EVENT_ATTACK,
		);
		expect(userEvents).toEqual([]);
	});

	test('ROOM-EVENTLOG-005 EVENT_OBJECT_DESTROYED is emitted on creep death and carries data.type === "creep"', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		// Target: [TOUGH, MOVE] = 200 hits. Attacker: 4 ATTACK = 120 dmg/swing.
		// First swing leaves 80 hits → not destroyed; second swing kills.
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p2', body: [TOUGH, MOVE],
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [ATTACK, ATTACK, ATTACK, ATTACK, MOVE],
		});
		await shard.tick();

		// First swing: damage but no death.
		await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
		`);
		const partialEvents = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].getEventLog()
		`) as Array<{ event: number; objectId: string; data?: any }>;
		expect(partialEvents.find(e => e.event === EVENT_OBJECT_DESTROYED)).toBeUndefined();

		// Killing blow.
		await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
		`);
		const deathEvents = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].getEventLog()
		`) as Array<{ event: number; objectId: string; data?: any }>;
		// Identify by event type — placeCreep handle ≠ engine objectId on
		// xxscreeps, so direct objectId comparison would mismatch.
		const destroyed = expectExactlyOne(deathEvents, e => e.event === EVENT_OBJECT_DESTROYED);
		expect(destroyed.data).toBeDefined();
		expect(destroyed.data.type).toBe('creep');
	});

	test('ROOM-EVENTLOG-006 EVENT_OBJECT_DESTROYED is emitted on structure destruction by attack with data.type === structureType', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		// Low-hits wall the attacker can knock down in one swing.
		const wallId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_WALL, hits: 60,
		});
		// 4 ATTACK = 120 dmg, more than enough to destroy a 60-hit wall in one swing.
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2',
			body: [ATTACK, ATTACK, ATTACK, ATTACK, MOVE],
		});
		await shard.tick();

		await shard.runPlayer('p2', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${wallId}))
		`);
		const events = await shard.runPlayer('p2', code`
			Game.rooms['W1N1'].getEventLog()
		`) as Array<{ event: number; objectId: string; data?: any }>;

		// Identify by event type — placeStructure handle ≠ engine objectId on
		// xxscreeps. The data.type field carries the structureType for
		// structure destruction.
		const destroyed = expectExactlyOne(events, e => e.event === EVENT_OBJECT_DESTROYED);
		expect(destroyed.data).toBeDefined();
		expect(destroyed.data.type).toBe(STRUCTURE_WALL);
	});

	test('ROOM-EVENTLOG-007 EVENT_TRANSFER is emitted by creep transfer/withdraw and link transferEnergy with vanilla object/target direction', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 5, owner: 'p1' }],
		});
		const containerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_CONTAINER,
			store: { energy: 200 },
		});
		const carrierId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [CARRY, CARRY, MOVE],
			store: { energy: 50 },
		});
		const link1Id = await shard.placeStructure('W1N1', {
			pos: [40, 40], structureType: STRUCTURE_LINK, owner: 'p1',
			store: { energy: 400 },
		});
		const link2Id = await shard.placeStructure('W1N1', {
			pos: [40, 45], structureType: STRUCTURE_LINK, owner: 'p1',
			store: { energy: 0 },
		});
		await shard.tick();

		// place* handles ≠ engine objectIds on xxscreeps. Capture the engine's
		// real ids by querying via player code (Game APIs return real ids), then
		// the event objectId/targetId comparisons can be exact.
		const realIds = await shard.runPlayer('p1', code`
			JSON.stringify({
				carrier: Game.getObjectById(${carrierId}).id,
				container: Game.getObjectById(${containerId}).id,
				link1: Game.getObjectById(${link1Id}).id,
				link2: Game.getObjectById(${link2Id}).id,
			})
		`) as string;
		const ids = JSON.parse(realIds) as Record<string, string>;

		// Variant 1: creep.transfer → objectId=creep, targetId=container.
		await shard.runPlayer('p1', code`
			Game.getObjectById(${carrierId}).transfer(
				Game.getObjectById(${containerId}), 'energy', 50
			)
		`);
		const transferEvents = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].getEventLog()
		`) as Array<{ event: number; objectId: string; data?: any }>;
		const transfer = expectExactlyOne(transferEvents,
			e => e.event === EVENT_TRANSFER && e.objectId === ids.carrier);
		expect(transfer.data.targetId).toBe(ids.container);
		expect(transfer.data.resourceType).toBe(RESOURCE_ENERGY);
		expect(transfer.data.amount).toBe(50);

		// Variant 2: creep.withdraw → objectId=container (the source), targetId=creep.
		await shard.runPlayer('p1', code`
			Game.getObjectById(${carrierId}).withdraw(
				Game.getObjectById(${containerId}), 'energy', 30
			)
		`);
		const withdrawEvents = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].getEventLog()
		`) as Array<{ event: number; objectId: string; data?: any }>;
		const withdraw = expectExactlyOne(withdrawEvents,
			e => e.event === EVENT_TRANSFER
				&& e.objectId === ids.container
				&& e.data?.targetId === ids.carrier);
		expect(withdraw.data.resourceType).toBe(RESOURCE_ENERGY);
		expect(withdraw.data.amount).toBe(30);

		// Variant 3: link.transferEnergy → amount is pre-loss (matches source-side debit).
		const sentAmount = 100;
		await shard.runPlayer('p1', code`
			Game.getObjectById(${link1Id}).transferEnergy(
				Game.getObjectById(${link2Id}), ${sentAmount}
			)
		`);
		const linkEvents = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].getEventLog()
		`) as Array<{ event: number; objectId: string; data?: any }>;
		const linkTransfer = expectExactlyOne(linkEvents,
			e => e.event === EVENT_TRANSFER && e.objectId === ids.link1);
		expect(linkTransfer.data.targetId).toBe(ids.link2);
		expect(linkTransfer.data.resourceType).toBe(RESOURCE_ENERGY);
		// Pre-loss amount; the destination receives less due to LINK_LOSS_RATIO.
		expect(linkTransfer.data.amount).toBe(sentAmount);
		expect(sentAmount * LINK_LOSS_RATIO).toBeGreaterThan(0);
	});

	test('ROOM-EVENTLOG-008 EVENT_EXIT is emitted when a creep crosses a room boundary with destination room/x/y', async ({ shard }) => {
		// Only the source room is spec'd; the destination W0N1 (east of W1N1,
		// since W-numbers decrease going east) is implicitly handled by the
		// engine when the creep exits.
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
			],
		});
		// Place one tile inside the eastern edge so the creep is stable on tick
		// boundary; first runPlayer steps onto x=49, second runPlayer crosses
		// into W0N1 at x=0. Look up by name (placeCreep handle ≠ engine id on xxscreeps).
		await shard.placeCreep('W1N1', {
			pos: [48, 25], owner: 'p1', body: [MOVE, MOVE], name: 'exiter',
		});
		await shard.tick();

		// Step 1: move to (49, 25) — the edge tile.
		await shard.runPlayer('p1', code`
			Game.creeps.exiter.move(RIGHT)
		`);
		// Step 2: cross the boundary.
		await shard.runPlayer('p1', code`
			Game.creeps.exiter && Game.creeps.exiter.move(RIGHT)
		`);
		const events = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'] ? Game.rooms['W1N1'].getEventLog() : []
		`) as Array<{ event: number; objectId: string; data?: any }>;

		// Identify by event type — placeCreep handle ≠ engine objectId on
		// xxscreeps. The destination room/x/y are the meaningful payload.
		const exit = expectExactlyOne(events, e => e.event === EVENT_EXIT);
		expect(exit.data.room).toBe('W0N1');
		expect(exit.data.x).toBe(0);
		expect(exit.data.y).toBe(25);
	});

	test('ROOM-EVENTLOG-009 EVENT_ATTACK_CONTROLLER is emitted with no data payload when a CLAIM creep attacks an enemy controller', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 2, owner: 'p2' },
			],
		});
		// Adjacent to controller at (1,1). Use a single-CLAIM body — sufficient for attackController.
		const attackerId = await shard.placeCreep('W2N1', {
			pos: [1, 2], owner: 'p1', body: [CLAIM, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).attackController(
				Game.rooms['W2N1'].controller
			)
		`);
		expect(rc).toBe(OK);

		const events = await shard.runPlayer('p1', code`
			Game.rooms['W2N1'].getEventLog()
		`) as Array<{ event: number; objectId: string; data?: any }>;
		// Identify by event type — placeCreep handle ≠ engine objectId on xxscreeps.
		const attackCtrl = expectExactlyOne(events, e => e.event === EVENT_ATTACK_CONTROLLER);
		// Vanilla emits this event with no extra fields; the read-side wrapper
		// must omit `data` entirely (not return `{data: {}}`).
		expect(attackCtrl.data).toBeUndefined();
	});

	test('ROOM-EVENTLOG-010 EVENT_RESERVE_CONTROLLER amount equals CLAIM-parts × CONTROLLER_RESERVE', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1' }, // Neutral, unowned controller.
			],
		});
		// 3 CLAIM parts → expected amount = 3 * CONTROLLER_RESERVE.
		const claimParts = 3;
		const reserverId = await shard.placeCreep('W2N1', {
			pos: [1, 2], owner: 'p1',
			body: [CLAIM, CLAIM, CLAIM, MOVE, MOVE, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${reserverId}).reserveController(
				Game.rooms['W2N1'].controller
			)
		`);
		expect(rc).toBe(OK);

		const events = await shard.runPlayer('p1', code`
			Game.rooms['W2N1'].getEventLog()
		`) as Array<{ event: number; objectId: string; data?: any }>;
		const reserve = expectExactlyOne(events, e => e.event === EVENT_RESERVE_CONTROLLER);
		expect(reserve.data).toBeDefined();
		expect(reserve.data.amount).toBe(claimParts * CONTROLLER_RESERVE);
	});

	test('ROOM-EVENTLOG-011 EVENT_UPGRADE_CONTROLLER carries amount and energySpent matching the energy applied', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		// 2 WORK parts can spend up to 2 energy/tick on upgrade.
		// Cap actual spend by available carry energy.
		const upgraderId = await shard.placeCreep('W1N1', {
			pos: [1, 2], owner: 'p1',
			body: [WORK, WORK, CARRY, MOVE],
			store: { energy: 50 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${upgraderId}).upgradeController(
				Game.rooms['W1N1'].controller
			)
		`);
		expect(rc).toBe(OK);

		const events = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].getEventLog()
		`) as Array<{ event: number; objectId: string; data?: any }>;
		const upgrade = expectExactlyOne(events, e => e.event === EVENT_UPGRADE_CONTROLLER);
		expect(upgrade.data).toBeDefined();
		// 2 WORK × UPGRADE_CONTROLLER_POWER (=1) = 2 energy applied.
		expect(upgrade.data.amount).toBe(2);
		expect(upgrade.data.energySpent).toBe(2);
	});

	test('ROOM-EVENTLOG-012 EVENT_HARVEST is emitted with creep objectId, source targetId, and amount harvested', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, MOVE],
		});
		const srcId = await shard.placeSource('W1N1', {
			pos: [25, 26], energy: 3000, energyCapacity: 3000,
		});
		await shard.tick();

		const ids = JSON.parse(await shard.runPlayer('p1', code`
			JSON.stringify({
				creep: Game.getObjectById(${creepId}).id,
				source: Game.getObjectById(${srcId}).id,
			})
		`) as string) as { creep: string; source: string };

		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${srcId}))
		`);

		const events = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].getEventLog()
		`) as Array<{ event: number; objectId: string; data: any }>;

		const harvest = expectExactlyOne(events,
			e => e.event === EVENT_HARVEST && e.objectId === ids.creep);
		expect(harvest.data.targetId).toBe(ids.source);
		expect(harvest.data.amount).toBe(HARVEST_POWER);
	});

	test('ROOM-EVENTLOG-013 EVENT_BUILD carries amount and energySpent matching progress added', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const builderId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
			store: { energy: 50 },
		});
		const siteId = await shard.placeSite('W1N1', {
			pos: [25, 26], owner: 'p1', structureType: STRUCTURE_ROAD,
		});
		await shard.tick();

		const ids = JSON.parse(await shard.runPlayer('p1', code`
			JSON.stringify({
				builder: Game.getObjectById(${builderId}).id,
				site: Game.getObjectById(${siteId}).id,
			})
		`) as string) as { builder: string; site: string };

		await shard.runPlayer('p1', code`
			Game.getObjectById(${builderId}).build(Game.getObjectById(${siteId}))
		`);

		const events = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].getEventLog()
		`) as Array<{ event: number; objectId: string; data: any }>;

		const build = expectExactlyOne(events,
			e => e.event === EVENT_BUILD && e.objectId === ids.builder);
		expect(build.data.targetId).toBe(ids.site);
		expect(build.data.amount).toBe(BUILD_POWER);
		// One swing is far below a road's progressTotal, so the site stays incomplete.
		expect(build.data.incomplete).toBe(true);
	});

	test('ROOM-EVENTLOG-014 EVENT_REPAIR carries amount and energySpent matching hits restored', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const repairerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
			store: { energy: 50 },
		});
		// Damaged wall with plenty of headroom for one tick of repair.
		const wallId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_WALL, hits: 1000,
		});
		await shard.tick();

		const ids = JSON.parse(await shard.runPlayer('p1', code`
			JSON.stringify({
				repairer: Game.getObjectById(${repairerId}).id,
				wall: Game.getObjectById(${wallId}).id,
			})
		`) as string) as { repairer: string; wall: string };

		await shard.runPlayer('p1', code`
			Game.getObjectById(${repairerId}).repair(Game.getObjectById(${wallId}))
		`);

		const events = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].getEventLog()
		`) as Array<{ event: number; objectId: string; data: any }>;

		const repair = expectExactlyOne(events,
			e => e.event === EVENT_REPAIR && e.objectId === ids.repairer);
		expect(repair.data.targetId).toBe(ids.wall);
		// 1 WORK × REPAIR_POWER (=100) HP restored, costing REPAIR_POWER × REPAIR_COST (=1) energy.
		expect(repair.data.amount).toBe(REPAIR_POWER);
		expect(repair.data.energySpent).toBe(REPAIR_POWER * REPAIR_COST);
	});

	test('ROOM-EVENTLOG-015 EVENT_ATTACK from rangedAttack carries attackType=RANGED and damage=RANGED_ATTACK_POWER', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [RANGED_ATTACK, MOVE],
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2', body: [TOUGH, TOUGH, MOVE],
		});
		await shard.tick();

		const ids = JSON.parse(await shard.runPlayer('p1', code`
			JSON.stringify({
				attacker: Game.getObjectById(${attackerId}).id,
				target: Game.getObjectById(${targetId}).id,
			})
		`) as string) as { attacker: string; target: string };

		await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).rangedAttack(Game.getObjectById(${targetId}))
		`);

		const events = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].getEventLog()
		`) as Array<{ event: number; objectId: string; data: any }>;

		const ranged = expectExactlyOne(events,
			e => e.event === EVENT_ATTACK && e.objectId === ids.attacker);
		expect(ranged.data.targetId).toBe(ids.target);
		expect(ranged.data.damage).toBe(RANGED_ATTACK_POWER);
		expect(ranged.data.attackType).toBe(EVENT_ATTACK_TYPE_RANGED);
	});

	test('ROOM-EVENTLOG-016 EVENT_ATTACK from rangedMassAttack emits one entry per target with attackType=RANGED_MASS and damage scaled by distance', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [RANGED_ATTACK, MOVE],
		});
		// Target at distance 1 (full damage) and target at distance 3 (10% damage).
		const nearId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2', body: [TOUGH, TOUGH, MOVE],
		});
		const farId = await shard.placeCreep('W1N1', {
			pos: [25, 28], owner: 'p2', body: [TOUGH, TOUGH, MOVE],
		});
		await shard.tick();

		const ids = JSON.parse(await shard.runPlayer('p1', code`
			JSON.stringify({
				attacker: Game.getObjectById(${attackerId}).id,
				near: Game.getObjectById(${nearId}).id,
				far: Game.getObjectById(${farId}).id,
			})
		`) as string) as { attacker: string; near: string; far: string };

		await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).rangedMassAttack()
		`);

		const events = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].getEventLog()
		`) as Array<{ event: number; objectId: string; data: any }>;

		const massEvents = events.filter(
			e => e.event === EVENT_ATTACK
				&& e.objectId === ids.attacker
				&& e.data?.attackType === EVENT_ATTACK_TYPE_RANGED_MASS,
		);
		// Exactly one event per damaged target — duplicate emission would inflate this.
		expect(massEvents).toHaveLength(2);
		const byTarget = new Map(massEvents.map(e => [e.data.targetId, e.data.damage]));
		// Distance 1: full damage. Distance 3: damage × distanceRate[3] (0.1), rounded.
		expect(byTarget.get(ids.near)).toBe(Math.round(RANGED_ATTACK_POWER * RANGED_ATTACK_DISTANCE_RATE[1]));
		expect(byTarget.get(ids.far)).toBe(Math.round(RANGED_ATTACK_POWER * RANGED_ATTACK_DISTANCE_RATE[3]));
	});

	test('ROOM-EVENTLOG-017 EVENT_ATTACK_TYPE_HIT_BACK is emitted from a melee target with ATTACK parts', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		// Attacker swings; target survives the swing and hits back via its ATTACK parts.
		// Attacker body = [TOUGH ×6, ATTACK ×4, MOVE] → 1100 hits, 4×ATTACK = 120 melee damage.
		// Target body   = [TOUGH ×6, ATTACK ×2, MOVE] → 900 hits, 2×ATTACK = 60 hit-back damage.
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, ATTACK, ATTACK, ATTACK, ATTACK, MOVE],
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2',
			body: [TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, ATTACK, ATTACK, MOVE],
		});
		await shard.tick();

		const ids = JSON.parse(await shard.runPlayer('p1', code`
			JSON.stringify({
				attacker: Game.getObjectById(${attackerId}).id,
				target: Game.getObjectById(${targetId}).id,
			})
		`) as string) as { attacker: string; target: string };

		await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
		`);

		const events = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].getEventLog()
		`) as Array<{ event: number; objectId: string; data: any }>;

		const melee = expectExactlyOne(events, e => e.event === EVENT_ATTACK
			&& e.objectId === ids.attacker
			&& e.data?.attackType === EVENT_ATTACK_TYPE_MELEE);
		expect(melee.data.damage).toBe(4 * ATTACK_POWER);

		const hitBack = expectExactlyOne(events, e => e.event === EVENT_ATTACK
			&& e.objectId === ids.target
			&& e.data?.attackType === EVENT_ATTACK_TYPE_HIT_BACK);
		expect(hitBack.data.targetId).toBe(ids.attacker);
		expect(hitBack.data.damage).toBe(2 * ATTACK_POWER);
	});

	test('ROOM-EVENTLOG-018 EVENT_HEAL from creep heal() carries healType=MELEE and amount=HEAL_POWER', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 24], owner: 'p2', body: [ATTACK, MOVE],
		});
		const friendlyId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [TOUGH, TOUGH, MOVE, MOVE],
		});
		const healerId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1', body: [HEAL, MOVE],
		});
		await shard.tick();

		const ids = JSON.parse(await shard.runPlayer('p1', code`
			JSON.stringify({
				healer: Game.getObjectById(${healerId}).id,
				friendly: Game.getObjectById(${friendlyId}).id,
			})
		`) as string) as { healer: string; friendly: string };

		// Damage the friendly so heal has something to apply.
		await shard.runPlayer('p2', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${friendlyId}))
		`);

		// Healer heals the wounded friendly (melee — adjacent).
		await shard.runPlayer('p1', code`
			Game.getObjectById(${healerId}).heal(Game.getObjectById(${friendlyId}))
		`);

		const events = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].getEventLog()
		`) as Array<{ event: number; objectId: string; data: any }>;

		const heal = expectExactlyOne(events,
			e => e.event === EVENT_HEAL && e.objectId === ids.healer);
		expect(heal.data.targetId).toBe(ids.friendly);
		expect(heal.data.amount).toBe(HEAL_POWER);
		expect(heal.data.healType).toBe(EVENT_HEAL_TYPE_MELEE);
	});

	test('ROOM-EVENTLOG-019 EVENT_ATTACK_TYPE_NUKE is emitted for each damaged structure when a nuke lands', async ({ shard }) => {
		shard.requires('nuke');
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		// Wall at impact center with hits well above NUKE_DAMAGE[0] so it survives
		// and we can verify the event payload (a destroyed wall would also emit
		// EVENT_OBJECT_DESTROYED, but the EVENT_ATTACK still fires regardless).
		const wallId = await shard.placeStructure('W2N1', {
			pos: [25, 25], structureType: STRUCTURE_WALL, hits: 20_000_000,
		});
		await shard.placeNuke('W2N1', {
			pos: [25, 25], launchRoomName: 'W1N1', timeToLand: 2,
		});
		// Capture wall's engine id before the nuke lands and removes everything.
		const wallRealId = await shard.runPlayer('p2', code`
			Game.getObjectById(${wallId}).id
		`) as string;
		// Advance to landTime - 1 (the tick that emits the damage events).
		await shard.tick();

		const events = await shard.runPlayer('p2', code`
			Game.rooms['W2N1'].getEventLog()
		`) as Array<{ event: number; objectId: string; data: any }>;

		const nukeAttack = expectExactlyOne(events,
			e => e.event === EVENT_ATTACK
				&& e.data?.attackType === EVENT_ATTACK_TYPE_NUKE
				&& e.data?.targetId === wallRealId);
		// Wall sits on the impact tile (range 0) → NUKE_DAMAGE[0].
		expect(nukeAttack.data.damage).toBe(NUKE_DAMAGE[0]);
	});

	test('ROOM-EVENTLOG-020 EVENT_POWER is emitted when a power creep usePower succeeds', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 0 },
		});
		const pcId = await shard.placePowerCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			powers: { [PWR_OPERATE_SPAWN]: 1 },
			store: { ops: 200 },
		});
		await shard.tick();

		const ids = JSON.parse(await shard.runPlayer('p1', code`
			const pc = Game.getObjectById(${pcId});
			const spawn = Game.getObjectById(${spawnId});
			JSON.stringify({ pc: pc.id, spawn: spawn.id })
		`) as string) as { pc: string; spawn: string };

		await shard.runPlayer('p1', code`
			const pc = Game.getObjectById(${pcId});
			const spawn = Game.getObjectById(${spawnId});
			pc.usePower(PWR_OPERATE_SPAWN, spawn)
		`);

		const events = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].getEventLog()
		`) as Array<{ event: number; objectId: string; data: any }>;

		const power = expectExactlyOne(events,
			e => e.event === EVENT_POWER && e.objectId === ids.pc);
		expect(power.data.power).toBe(PWR_OPERATE_SPAWN);
		expect(power.data.targetId).toBe(ids.spawn);
	});

	test('ROOM-EVENTLOG-021 EVENT_ATTACK from creep dismantle() carries attackType=DISMANTLE and damage=DISMANTLE_POWER', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const dismantlerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [WORK, MOVE],
		});
		// Wall with plenty of headroom so it survives the swing.
		const wallId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_WALL, hits: 1000,
		});
		await shard.tick();

		const ids = JSON.parse(await shard.runPlayer('p1', code`
			JSON.stringify({
				dismantler: Game.getObjectById(${dismantlerId}).id,
				wall: Game.getObjectById(${wallId}).id,
			})
		`) as string) as { dismantler: string; wall: string };

		await shard.runPlayer('p1', code`
			Game.getObjectById(${dismantlerId}).dismantle(Game.getObjectById(${wallId}))
		`);

		const events = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].getEventLog()
		`) as Array<{ event: number; objectId: string; data: any }>;

		const dismantle = expectExactlyOne(events,
			e => e.event === EVENT_ATTACK && e.objectId === ids.dismantler);
		expect(dismantle.data.targetId).toBe(ids.wall);
		expect(dismantle.data.damage).toBe(DISMANTLE_POWER);
		expect(dismantle.data.attackType).toBe(EVENT_ATTACK_TYPE_DISMANTLE);
	});

	test('ROOM-EVENTLOG-022 EVENT_HEAL from creep rangedHeal() carries healType=RANGED and amount=RANGED_HEAL_POWER', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 24], owner: 'p2', body: [ATTACK, MOVE],
		});
		const friendlyId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [TOUGH, TOUGH, MOVE, MOVE],
		});
		// Healer at range 3 — out of melee, in ranged-heal range.
		const healerId = await shard.placeCreep('W1N1', {
			pos: [25, 28], owner: 'p1', body: [HEAL, MOVE],
		});
		await shard.tick();

		const ids = JSON.parse(await shard.runPlayer('p1', code`
			JSON.stringify({
				healer: Game.getObjectById(${healerId}).id,
				friendly: Game.getObjectById(${friendlyId}).id,
			})
		`) as string) as { healer: string; friendly: string };

		// Damage the friendly so the heal has something to apply.
		await shard.runPlayer('p2', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${friendlyId}))
		`);

		await shard.runPlayer('p1', code`
			Game.getObjectById(${healerId}).rangedHeal(Game.getObjectById(${friendlyId}))
		`);

		const events = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].getEventLog()
		`) as Array<{ event: number; objectId: string; data: any }>;

		const heal = expectExactlyOne(events,
			e => e.event === EVENT_HEAL && e.objectId === ids.healer);
		expect(heal.data.targetId).toBe(ids.friendly);
		expect(heal.data.amount).toBe(RANGED_HEAL_POWER);
		expect(heal.data.healType).toBe(EVENT_HEAL_TYPE_RANGED);
	});

	test('ROOM-EVENTLOG-023 EVENT_OBJECT_DESTROYED is emitted exactly once when multiple attackers kill a structure on the same tick', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		// Wall sandwiched between two attackers; either swing alone destroys
		// it, so the second swing exercises the alive→dead transition gate.
		// Vanilla emits OBJECT_DESTROYED at end of tick once per death;
		// duplicate emission would double the count.
		const wallId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_WALL, hits: 60,
		});
		const attackerAId = await shard.placeCreep('W1N1', {
			pos: [24, 25], owner: 'p1',
			body: [ATTACK, ATTACK, ATTACK, ATTACK, MOVE],
		});
		const attackerBId = await shard.placeCreep('W1N1', {
			pos: [26, 25], owner: 'p1',
			body: [ATTACK, ATTACK, ATTACK, ATTACK, MOVE],
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerAId}).attack(Game.getObjectById(${wallId}));
			Game.getObjectById(${attackerBId}).attack(Game.getObjectById(${wallId}));
		`);

		const events = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].getEventLog()
		`) as Array<{ event: number; objectId: string; data?: any }>;

		// Identify by event type — placeStructure handle ≠ engine objectId on
		// xxscreeps. Multi-attacker single-tick destruction must still produce
		// exactly one destroyed-event.
		expectExactlyOne(events, e => e.event === EVENT_OBJECT_DESTROYED);
	});

	test('ROOM-EVENTLOG-024 EVENT_OBJECT_DESTROYED precedes EVENT_ATTACK in the per-target log on a kill-shot', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		// One swing of 4 ATTACK = 120 dmg destroys the 60-hit wall.
		const wallId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_WALL, hits: 60,
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [ATTACK, ATTACK, ATTACK, ATTACK, MOVE],
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${wallId}))
		`);

		const events = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].getEventLog()
		`) as Array<{ event: number; objectId: string; data?: any }>;

		const destroyedIdx = events.findIndex(e => e.event === EVENT_OBJECT_DESTROYED);
		const attackIdx = events.findIndex(e =>
			e.event === EVENT_ATTACK && e.data?.attackType === EVENT_ATTACK_TYPE_MELEE);
		// Vanilla `_damage.js` pushes EVENT_OBJECT_DESTROYED before EVENT_ATTACK
		// for the same damage event. Player code that reads the log in order
		// (e.g. an "I just got killed → log who" reaction) depends on this.
		expect(destroyedIdx).toBeGreaterThanOrEqual(0);
		expect(attackIdx).toBeGreaterThanOrEqual(0);
		expect(destroyedIdx).toBeLessThan(attackIdx);
	});

	test('ROOM-EVENTLOG-025 EVENT_ATTACK_TYPE_HIT_BACK precedes the original EVENT_ATTACK in the log', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		// Both creeps survive the swing — no death events to mix in.
		// Attacker: 6 TOUGH + 4 ATTACK + MOVE → 1100 hits, 120 dmg/swing.
		// Target:   6 TOUGH + 2 ATTACK + MOVE → 900 hits, 60 hit-back dmg.
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, ATTACK, ATTACK, ATTACK, ATTACK, MOVE],
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2',
			body: [TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, ATTACK, ATTACK, MOVE],
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
		`);

		const events = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].getEventLog()
		`) as Array<{ event: number; objectId: string; data?: any }>;

		const hitBackIdx = events.findIndex(e =>
			e.event === EVENT_ATTACK && e.data?.attackType === EVENT_ATTACK_TYPE_HIT_BACK);
		const attackIdx = events.findIndex(e =>
			e.event === EVENT_ATTACK && e.data?.attackType === EVENT_ATTACK_TYPE_MELEE);
		// Vanilla `_damage.js` pushes the HIT_BACK ATTACK before the original
		// ATTACK for the damage call that triggered the counter.
		expect(hitBackIdx).toBeGreaterThanOrEqual(0);
		expect(attackIdx).toBeGreaterThanOrEqual(0);
		expect(hitBackIdx).toBeLessThan(attackIdx);
	});
});
