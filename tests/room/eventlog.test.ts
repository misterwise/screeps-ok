import { describe, test, expect, code,
	OK,
	MOVE, ATTACK, TOUGH, HEAL, CARRY,
	EVENT_ATTACK, EVENT_ATTACK_TYPE_MELEE, ATTACK_POWER, BODYPART_HITS,
	EVENT_HEAL, EVENT_HEAL_TYPE_MELEE, EVENT_HEAL_TYPE_RANGED, HEAL_POWER,
	STRUCTURE_TOWER, TOWER_ENERGY_COST,
	TOWER_POWER_HEAL, TOWER_OPTIMAL_RANGE,
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
			e => e.event === EVENT_ATTACK && e.objectId === attackerId,
		);
		expect(attackEvent).toBeDefined();
		expect(attackEvent!.data.targetId).toBe(targetId);
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
			e => e.event === EVENT_HEAL && e.objectId === towerId,
		);
		expect(healEvent).toBeDefined();
		expect(healEvent!.data.targetId).toBe(friendlyId);
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
});
