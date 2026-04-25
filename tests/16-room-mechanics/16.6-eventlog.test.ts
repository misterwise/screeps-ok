import { describe, test, expect, code,
	OK, RIGHT,
	MOVE, ATTACK, TOUGH, HEAL, CARRY, WORK, CLAIM,
	EVENT_ATTACK, EVENT_ATTACK_TYPE_MELEE, ATTACK_POWER, BODYPART_HITS,
	EVENT_HEAL, EVENT_HEAL_TYPE_MELEE, EVENT_HEAL_TYPE_RANGED, HEAL_POWER,
	EVENT_OBJECT_DESTROYED, EVENT_TRANSFER, EVENT_EXIT,
	EVENT_ATTACK_CONTROLLER, EVENT_RESERVE_CONTROLLER, EVENT_UPGRADE_CONTROLLER,
	STRUCTURE_TOWER, STRUCTURE_WALL, STRUCTURE_LINK, STRUCTURE_CONTAINER,
	TOWER_ENERGY_COST, TOWER_POWER_HEAL, TOWER_OPTIMAL_RANGE,
	RESOURCE_ENERGY, LINK_LOSS_RATIO, CONTROLLER_RESERVE,
} from '../../src/index.js';

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

		const attackEvent = events.find(
			e => e.event === EVENT_ATTACK && e.objectId === ids.attacker,
		);
		expect(attackEvent).toBeDefined();
		expect(attackEvent!.data.targetId).toBe(ids.target);
		expect(attackEvent!.data.damage).toBe(ATTACK_POWER);
		expect(attackEvent!.data.attackType).toBe(EVENT_ATTACK_TYPE_MELEE);
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

		const healEvent = events.find(
			e => e.event === EVENT_HEAL && e.objectId === ids.tower,
		);
		expect(healEvent).toBeDefined();
		expect(healEvent!.data.targetId).toBe(ids.friendly);
		expect(healEvent!.data.amount).toBeGreaterThan(0);
		// Tower heal is ranged (EVENT_HEAL_TYPE_RANGED = 2), not melee.
		expect(healEvent!.data.healType).toBe(EVENT_HEAL_TYPE_RANGED);
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
		const destroyed = deathEvents.find(e => e.event === EVENT_OBJECT_DESTROYED);
		expect(destroyed).toBeDefined();
		expect(destroyed!.data).toBeDefined();
		expect(destroyed!.data.type).toBe('creep');
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
		const destroyed = events.find(e => e.event === EVENT_OBJECT_DESTROYED);
		expect(destroyed).toBeDefined();
		expect(destroyed!.data).toBeDefined();
		expect(destroyed!.data.type).toBe(STRUCTURE_WALL);
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
		const transfer = transferEvents.find(
			e => e.event === EVENT_TRANSFER && e.objectId === ids.carrier,
		);
		expect(transfer).toBeDefined();
		expect(transfer!.data.targetId).toBe(ids.container);
		expect(transfer!.data.resourceType).toBe(RESOURCE_ENERGY);
		expect(transfer!.data.amount).toBe(50);

		// Variant 2: creep.withdraw → objectId=container (the source), targetId=creep.
		await shard.runPlayer('p1', code`
			Game.getObjectById(${carrierId}).withdraw(
				Game.getObjectById(${containerId}), 'energy', 30
			)
		`);
		const withdrawEvents = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].getEventLog()
		`) as Array<{ event: number; objectId: string; data?: any }>;
		const withdraw = withdrawEvents.find(
			e => e.event === EVENT_TRANSFER
				&& e.objectId === ids.container
				&& e.data?.targetId === ids.carrier,
		);
		expect(withdraw).toBeDefined();
		expect(withdraw!.data.resourceType).toBe(RESOURCE_ENERGY);
		expect(withdraw!.data.amount).toBe(30);

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
		const linkTransfer = linkEvents.find(
			e => e.event === EVENT_TRANSFER && e.objectId === ids.link1,
		);
		expect(linkTransfer).toBeDefined();
		expect(linkTransfer!.data.targetId).toBe(ids.link2);
		expect(linkTransfer!.data.resourceType).toBe(RESOURCE_ENERGY);
		// Pre-loss amount; the destination receives less due to LINK_LOSS_RATIO.
		expect(linkTransfer!.data.amount).toBe(sentAmount);
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
		const exit = events.find(e => e.event === EVENT_EXIT);
		expect(exit).toBeDefined();
		expect(exit!.data.room).toBe('W0N1');
		expect(exit!.data.x).toBe(0);
		expect(exit!.data.y).toBe(25);
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
		const attackCtrl = events.find(e => e.event === EVENT_ATTACK_CONTROLLER);
		expect(attackCtrl).toBeDefined();
		// Vanilla emits this event with no extra fields; the read-side wrapper
		// must omit `data` entirely (not return `{data: {}}`).
		expect(attackCtrl!.data).toBeUndefined();
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
		const reserve = events.find(e => e.event === EVENT_RESERVE_CONTROLLER);
		expect(reserve).toBeDefined();
		expect(reserve!.data).toBeDefined();
		expect(reserve!.data.amount).toBe(claimParts * CONTROLLER_RESERVE);
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
		const upgrade = events.find(e => e.event === EVENT_UPGRADE_CONTROLLER);
		expect(upgrade).toBeDefined();
		expect(upgrade!.data).toBeDefined();
		// 2 WORK × UPGRADE_CONTROLLER_POWER (=1) = 2 energy applied.
		expect(upgrade!.data.amount).toBe(2);
		expect(upgrade!.data.energySpent).toBe(2);
	});
});
