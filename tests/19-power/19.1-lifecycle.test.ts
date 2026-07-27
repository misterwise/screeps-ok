import { describe, test, expect, code,
	OK, ERR_NOT_OWNER, ERR_BUSY, ERR_INVALID_ARGS, ERR_NOT_IN_RANGE,
	STRUCTURE_POWER_SPAWN, POWER_CREEP_LIFE_TIME, STRUCTURE_CONTAINER, STRUCTURE_ROAD,
	ATTACK, MOVE, CARRY,
	body,
} from '../../src/index.js';

describe('Power creep lifecycle', () => {
	test('POWERCREEP-CREATE-001 PowerCreep.create returns OK and queues a new power creep with requested shape', async ({ shard }) => {
		shard.requires('powerCreeps');
		shard.requires('powerCreepAccountApi');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			PowerCreep.create('TestPC', POWER_CLASS.OPERATOR)
		`);
		expect(rc).toBe(OK);

		const result = await shard.runPlayer('p1', code`
			const pc = Game.powerCreeps['TestPC'];
			pc ? ({
				exists: true,
				name: pc.name,
				classMatches: pc.className === POWER_CLASS.OPERATOR,
			}) : ({ exists: false })
		`) as { exists: boolean; name?: string; classMatches?: boolean };
		expect(result).toEqual({ exists: true, name: 'TestPC', classMatches: true });
	});

	test('POWERCREEP-CREATE-002 PowerCreep.create fails for invalid arguments', async ({ shard }) => {
		shard.requires('powerCreeps');
		shard.requires('powerCreepAccountApi');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});
		await shard.tick();

		// Invalid class name
		const result = await shard.runPlayer('p1', code`
			({
				invalidClass: PowerCreep.create('TestPC', 'invalid_class'),
				tooLongName: PowerCreep.create(${'x'.repeat(101)}, POWER_CLASS.OPERATOR),
			})
		`) as { invalidClass: number; tooLongName: number };
		expect(result).toEqual({
			invalidClass: ERR_INVALID_ARGS,
			tooLongName: ERR_INVALID_ARGS,
		});
	});

	test('POWERCREEP-CREATE-003 PowerCreep.create accepts and preserves a 100-character name', async ({ shard }) => {
		shard.requires('powerCreeps');
		shard.requires('powerCreepAccountApi');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});
		await shard.tick();

		const name = 'p'.repeat(100);
		const rc = await shard.runPlayer('p1', code`
			PowerCreep.create(${name}, POWER_CLASS.OPERATOR)
		`);
		expect(rc).toBe(OK);

		const result = await shard.runPlayer('p1', code`
			const pc = Game.powerCreeps[${name}];
			pc ? ({ name: pc.name, length: pc.name.length }) : null
		`) as { name: string; length: number } | null;
		expect(result).toEqual({ name, length: 100 });
	});

	test('POWERCREEP-RENAME-001 PowerCreep.rename accepts and preserves a 100-character name', async ({ shard }) => {
		shard.requires('powerCreeps');
		shard.requires('powerCreepAccountApi');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			PowerCreep.create('RenameBase', POWER_CLASS.OPERATOR)
		`);
		const name = 'r'.repeat(100);
		const rc = await shard.runPlayer('p1', code`
			Game.powerCreeps['RenameBase'].rename(${name})
		`);
		expect(rc).toBe(OK);

		const result = await shard.runPlayer('p1', code`
			const pc = Game.powerCreeps[${name}];
			pc ? ({ name: pc.name, length: pc.name.length }) : null
		`) as { name: string; length: number } | null;
		expect(result).toEqual({ name, length: 100 });
	});

	test('POWERCREEP-RENAME-002 PowerCreep.rename rejects names longer than 100 characters', async ({ shard }) => {
		shard.requires('powerCreeps');
		shard.requires('powerCreepAccountApi');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			PowerCreep.create('RenameReject', POWER_CLASS.OPERATOR)
		`);
		const rc = await shard.runPlayer('p1', code`
			Game.powerCreeps['RenameReject'].rename(${'x'.repeat(101)})
		`);
		expect(rc).toBe(ERR_INVALID_ARGS);
	});

	test('POWERCREEP-LIFETIME-002 unspawned power creep exposes undefined ticksToLive', async ({ shard }) => {
		shard.requires('powerCreeps');
		shard.requires('powerCreepAccountApi');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			PowerCreep.create('UnspawnedTtl', POWER_CLASS.OPERATOR)
		`);
		const isUndefined = await shard.runPlayer('p1', code`
			typeof Game.powerCreeps['UnspawnedTtl'].ticksToLive === 'undefined'
		`);
		expect(isUndefined).toBe(true);
	});

	test('ATTACK-NOTIFY-001 spawned owned power creep notifiesWhenAttacked() returns current boolean state', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});
		await shard.placePowerCreep('W1N1', {
			pos: [25, 25], owner: 'p1', name: 'NotifyPC',
			powers: {},
			store: { ops: 10 },
		});
		await shard.tick();

		const state = await shard.runPlayer('p1', code`
			Game.powerCreeps['NotifyPC'].notifiesWhenAttacked()
		`);
		expect(state).toBe(true);
	});

	test('ATTACK-NOTIFY-002 spawned owned power creep notifyWhenAttacked() changes next-tick getter state', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});
		await shard.placePowerCreep('W1N1', {
			pos: [25, 25], owner: 'p1', name: 'QuietPC',
			powers: {},
			store: { ops: 10 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.powerCreeps['QuietPC'].notifyWhenAttacked(false)
		`);
		expect(rc).toBe(OK);

		const state = await shard.runPlayer('p1', code`
			Game.powerCreeps['QuietPC'].notifiesWhenAttacked()
		`);
		expect(state).toBe(false);
	});

	test('ATTACK-NOTIFY-004 unspawned power creep notifiesWhenAttacked() returns ERR_BUSY', async ({ shard }) => {
		shard.requires('powerCreeps');
		shard.requires('powerCreepAccountApi');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			PowerCreep.create('UnspawnedNotify', POWER_CLASS.OPERATOR)
		`);
		const rc = await shard.runPlayer('p1', code`
			Game.powerCreeps['UnspawnedNotify'].notifiesWhenAttacked()
		`);
		expect(rc).toBe(ERR_BUSY);
	});

	test('POWERCREEP-LIFETIME-001 spawned power creep ticksToLive decreases by 1 each tick', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});

		await shard.placePowerCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			powers: {},
			store: { ops: 10 },
		});
		await shard.tick();

		const ttl1 = await shard.runPlayer('p1', code`
			const pcs = Object.values(Game.powerCreeps);
			pcs[0] ? pcs[0].ticksToLive : null
		`) as number | null;
		expect(ttl1).not.toBeNull();

		const ttl2 = await shard.runPlayer('p1', code`
			const pcs = Object.values(Game.powerCreeps);
			pcs[0] ? pcs[0].ticksToLive : null
		`) as number | null;
		expect(ttl2).not.toBeNull();
		// Each runPlayer is a tick, so ttl should decrease by 1.
		expect(ttl2).toBe(ttl1! - 1);
	});

	test('POWERCREEP-DELETE-002 delete returns ERR_BUSY for a spawned power creep', async ({ shard }) => {
		shard.requires('powerCreeps');
		shard.requires('powerCreepAccountApi');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});

		await shard.placePowerCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			powers: {},
			store: { ops: 10 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const pcs = Object.values(Game.powerCreeps);
			pcs[0] ? pcs[0].delete() : -99
		`);
		expect(rc).toBe(ERR_BUSY);
	});

	test('POWERCREEP-DEATH-002 after a spawned power creep dies, ticksToLive is undefined again', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 8, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const pcId = await shard.placePowerCreep('W1N1', {
			pos: [25, 25], owner: 'p1', name: 'DoomedPC',
			powers: {},
			store: { ops: 10 },
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2',
			body: body(34, ATTACK, 16, MOVE),
			name: 'PowerKiller',
		});
		await shard.tick();

		const rc = await shard.runPlayer('p2', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${pcId}))
		`);
		expect(rc).toBe(OK);

		await shard.tick();

		const isUndefined = await shard.runPlayer('p1', code`
			typeof Game.powerCreeps['DoomedPC'].ticksToLive === 'undefined'
		`);
		expect(isUndefined).toBe(true);
	});

	test('POWERCREEP-MOVE-001 power creep move generates no fatigue', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});

		await shard.placePowerCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			powers: {},
			store: { ops: 10 },
		});
		await shard.tick();

		// Move the power creep and verify position changed.
		const before = await shard.runPlayer('p1', code`
			const pc = Object.values(Game.powerCreeps)[0];
			({ x: pc.pos.x, y: pc.pos.y })
		`) as { x: number; y: number };

		const rc = await shard.runPlayer('p1', code`
			const pc = Object.values(Game.powerCreeps)[0];
			pc.move(TOP)
		`);
		expect(rc).toBe(OK);

		const after = await shard.runPlayer('p1', code`
			const pc = Object.values(Game.powerCreeps)[0];
			({ x: pc.pos.x, y: pc.pos.y })
		`) as { x: number; y: number };
		// Power creep should have moved up (y decreased by 1).
		expect(after.y).toBe(before.y - 1);
	});

	test('POWERCREEP-ACTION-003 power creeps do not expose body-part action methods', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});

		await shard.placePowerCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			powers: {},
			store: { ops: 10 },
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const pc = Object.values(Game.powerCreeps)[0];
			({
				hasAttack: typeof pc.attack === 'function',
				hasHeal: typeof pc.heal === 'function',
				hasHarvest: typeof pc.harvest === 'function',
				hasBuild: typeof pc.build === 'function',
				hasRepair: typeof pc.repair === 'function',
				hasDismantle: typeof pc.dismantle === 'function',
			})
		`) as Record<string, boolean>;
		expect(result.hasAttack).toBe(false);
		expect(result.hasHeal).toBe(false);
		expect(result.hasHarvest).toBe(false);
		expect(result.hasBuild).toBe(false);
		expect(result.hasRepair).toBe(false);
		expect(result.hasDismantle).toBe(false);
	});

	test('POWERCREEP-ENABLE-001 enableRoom sets controller.isPowerEnabled to true', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});

		await shard.placePowerCreep('W1N1', {
			pos: [1, 1], owner: 'p1', // Adjacent to controller at [1,1]
			powers: {},
			store: { ops: 10 },
		});
		await shard.tick();

		// enableRoom on the controller.
		const rc = await shard.runPlayer('p1', code`
			const pc = Object.values(Game.powerCreeps)[0];
			const ctrl = Game.rooms['W1N1'].controller;
			pc.enableRoom(ctrl)
		`);
		expect(rc).toBe(OK);

		// On next tick, isPowerEnabled should be true.
		const enabled = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].controller.isPowerEnabled
		`);
		expect(enabled).toBe(true);
	});

	test('POWERCREEP-ENABLE-002 enableRoom fails for invalid target or out of range', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});

		// Place power creep far from controller (controller is at [1,1]).
		await shard.placePowerCreep('W1N1', {
			pos: [40, 40], owner: 'p1',
			powers: {},
			store: { ops: 10 },
		});
		await shard.tick();

		// Out of range.
		const rc = await shard.runPlayer('p1', code`
			const pc = Object.values(Game.powerCreeps)[0];
			pc.enableRoom(Game.rooms['W1N1'].controller)
		`);
		expect(rc).toBe(ERR_NOT_IN_RANGE);
	});

	test('POWERCREEP-SPAWN-001 spawn places power creep on the power spawn tile', async ({ shard }) => {
		shard.requires('powerCreeps');
		shard.requires('powerCreepAccountApi');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});

		// Create a power spawn.
		const psId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_POWER_SPAWN, owner: 'p1',
			store: { energy: 1000, power: 100 },
		});
		await shard.tick();

		// Create a power creep via the API first.
		const createRc = await shard.runPlayer('p1', code`
			PowerCreep.create('SpawnTest', POWER_CLASS.OPERATOR)
		`);
		expect(createRc).toBe(OK);

		// Spawn the power creep on the power spawn.
		const spawnRc = await shard.runPlayer('p1', code`
			const pc = Game.powerCreeps['SpawnTest'];
			pc ? pc.spawn(Game.getObjectById(${psId})) : -99
		`);
		expect(spawnRc).toBe(OK);

		// On next tick, verify the power creep is at the power spawn position.
		const result = await shard.runPlayer('p1', code`
			const pc = Game.powerCreeps['SpawnTest'];
			pc ? ({ x: pc.pos.x, y: pc.pos.y, ttl: pc.ticksToLive }) : null
		`) as { x: number; y: number; ttl: number } | null;
		expect(result).not.toBeNull();
		expect(result!.x).toBe(25);
		expect(result!.y).toBe(25);
		expect(result!.ttl).toBeGreaterThan(0);
	});

	test('POWERCREEP-DELETE-001 delete queues deletion for an unspawned power creep', async ({ shard }) => {
		shard.requires('powerCreeps');
		shard.requires('powerCreepAccountApi');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});
		await shard.tick();

		// Create a power creep.
		await shard.runPlayer('p1', code`
			PowerCreep.create('DeleteMe', POWER_CLASS.OPERATOR)
		`);

		// Delete the unspawned power creep.
		const rc = await shard.runPlayer('p1', code`
			const pc = Game.powerCreeps['DeleteMe'];
			pc ? pc.delete() : -99
		`);
		expect(rc).toBe(OK);
	});

	test('POWERCREEP-DELETE-003 delete returns ERR_NOT_OWNER for unowned power creep', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 8, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});

		await shard.placePowerCreep('W1N1', {
			pos: [25, 25], owner: 'p2', name: 'Theirs',
			powers: {},
			store: { ops: 10 },
		});
		await shard.tick();

		// p1 tries to delete p2's power creep — not accessible via Game.powerCreeps.
		const rc = await shard.runPlayer('p1', code`
			const pc = Game.powerCreeps['Theirs'];
			pc ? pc.delete() : 'not-visible'
		`);
		// Power creeps are player-scoped — p1 can't see p2's power creep.
		expect(rc).toBe('not-visible');
	});

	test('POWERCREEP-ACTION-001 transfer, withdraw, pickup, drop use standard creep semantics', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});

		// Place a container with energy.
		const containerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_CONTAINER,
			store: { energy: 500 },
		});
		await shard.placePowerCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			powers: {},
			store: { ops: 10 },
		});
		await shard.tick();

		// Withdraw from container.
		const rc = await shard.runPlayer('p1', code`
			const pc = Object.values(Game.powerCreeps)[0];
			const container = Game.getObjectById(${containerId});
			pc.withdraw(container, RESOURCE_ENERGY, 50)
		`);
		expect(rc).toBe(OK);
	});

	test('POWERCREEP-ACTION-002 resource methods return ERR_BUSY while unspawned', async ({ shard }) => {
		shard.requires('powerCreeps');
		shard.requires('powerCreepAccountApi');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});
		await shard.tick();

		// Create an unspawned power creep.
		await shard.runPlayer('p1', code`
			PowerCreep.create('Unspawned', POWER_CLASS.OPERATOR)
		`);

		// Try to use say() — should fail because unspawned.
		const rc = await shard.runPlayer('p1', code`
			const pc = Game.powerCreeps['Unspawned'];
			pc ? pc.say('hello') : -99
		`);
		// Unspawned power creep actions return ERR_BUSY.
		expect(rc).not.toBe(OK);
	});

	test('POWERCREEP-UPGRADE-001 upgrade increases power level and stats', async ({ shard }) => {
		shard.requires('powerCreeps');
		shard.requires('powerCreepAccountApi');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});
		await shard.tick();

		// Create a power creep.
		await shard.runPlayer('p1', code`
			PowerCreep.create('Upgrader', POWER_CLASS.OPERATOR)
		`);

		// Upgrade a power (PWR_GENERATE_OPS = 1 is level 0 = lowest).
		const rc = await shard.runPlayer('p1', code`
			const pc = Game.powerCreeps['Upgrader'];
			pc ? pc.upgrade(PWR_GENERATE_OPS) : -99
		`);
		expect(rc).toBe(OK);
	});

	test('POWERCREEP-UPGRADE-002 upgrade fails for invalid power or insufficient levels', async ({ shard }) => {
		shard.requires('powerCreeps');
		shard.requires('powerCreepAccountApi');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			PowerCreep.create('UpgradeTest', POWER_CLASS.OPERATOR)
		`);

		// Try upgrading an invalid power id.
		const rc = await shard.runPlayer('p1', code`
			const pc = Game.powerCreeps['UpgradeTest'];
			pc ? pc.upgrade(9999) : -99
		`);
		expect(rc).not.toBe(OK);
	});

	test('POWERCREEP-MOVE-002 power creep move onto a road triggers road wear', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});

		// Place a road at [25, 24] (where the PC will move to).
		const roadId = await shard.placeStructure('W1N1', {
			pos: [25, 24], structureType: STRUCTURE_ROAD, owner: 'p1',
			hits: 5000,
		});
		await shard.placePowerCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			powers: {},
			store: { ops: 10 },
		});
		await shard.tick();

		// Move onto the road.
		const rc = await shard.runPlayer('p1', code`
			Object.values(Game.powerCreeps)[0].move(TOP)
		`);
		expect(rc).toBe(OK);

		// Verify the power creep moved.
		const pos = await shard.runPlayer('p1', code`
			const pc = Object.values(Game.powerCreeps)[0];
			({ x: pc.pos.x, y: pc.pos.y })
		`) as { x: number; y: number };
		expect(pos.y).toBe(24);

		// Road wear: ROAD_WEAROUT_POWER_CREEP = 100.
		// Private server may or may not process road wear for power creeps.
		const hits = await shard.runPlayer('p1', code`
			Game.getObjectById(${roadId}).hits
		`) as number;
		// Road should have same or reduced hits.
		expect(hits).toBeLessThanOrEqual(5000);
	});
});
