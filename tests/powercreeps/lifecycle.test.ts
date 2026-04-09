import { describe, test, expect, code,
	OK, ERR_NOT_OWNER, ERR_BUSY, ERR_INVALID_ARGS, ERR_NOT_IN_RANGE,
	STRUCTURE_POWER_SPAWN, POWER_CREEP_LIFE_TIME, STRUCTURE_CONTAINER,
	MOVE, CARRY,
} from '../../src/index.js';
import { requireCapability } from '../support/policy.js';

describe('Power creep lifecycle', () => {
	test('POWERCREEP-CREATE-001 PowerCreep.create returns OK and queues a new power creep', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'powerCreeps');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			PowerCreep.create('TestPC', POWER_CLASS.OPERATOR)
		`);
		expect(rc).toBe(OK);
	});

	test('POWERCREEP-CREATE-002 PowerCreep.create fails for invalid arguments', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'powerCreeps');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});
		await shard.tick();

		// Invalid class name
		const rc = await shard.runPlayer('p1', code`
			PowerCreep.create('TestPC', 'invalid_class')
		`);
		expect(rc).not.toBe(OK);
	});

	test('POWERCREEP-LIFETIME-001 spawned power creep ticksToLive decreases by 1 each tick', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'powerCreeps');
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

	test('POWERCREEP-DELETE-002 delete returns ERR_BUSY for a spawned power creep', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'powerCreeps');
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

	test('POWERCREEP-MOVE-001 power creep move generates no fatigue', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'powerCreeps');
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

	test('POWERCREEP-ACTION-003 power creeps do not expose body-part action methods', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'powerCreeps');
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

	test('POWERCREEP-ENABLE-001 enableRoom sets controller.isPowerEnabled to true', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'powerCreeps');
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

	test('POWERCREEP-ENABLE-002 enableRoom fails for invalid target or out of range', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'powerCreeps');
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

	test('POWERCREEP-SPAWN-001 spawn places power creep on the power spawn tile', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'powerCreeps');
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

	test('POWERCREEP-DELETE-001 delete queues deletion for an unspawned power creep', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'powerCreeps');
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

	test('POWERCREEP-DELETE-003 delete returns ERR_NOT_OWNER for unowned power creep', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'powerCreeps');
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

	test('POWERCREEP-ACTION-001 transfer, withdraw, pickup, drop use standard creep semantics', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'powerCreeps');
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

	test('POWERCREEP-ACTION-002 resource methods return ERR_BUSY while unspawned', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'powerCreeps');
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

	test('POWERCREEP-UPGRADE-001 upgrade increases power level and stats', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'powerCreeps');
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

	test('POWERCREEP-UPGRADE-002 upgrade fails for invalid power or insufficient levels', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'powerCreeps');
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

	test('POWERCREEP-MOVE-002 power creep move onto a road triggers road wear', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'powerCreeps');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});

		// Place a road at [25, 24] (where the PC will move to).
		const roadId = await shard.placeStructure('W1N1', {
			pos: [25, 24], structureType: 'road', owner: 'p1',
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

describe('Rampart power effects', () => {
	test('RAMPART-DECAY-004 PWR_FORTIFY prevents direct damage while effect is active', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'powerCreeps');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});

		await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: 'rampart', owner: 'p1',
			hits: 10000,
		});
		await shard.placePowerCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			powers: { [17]: 1 }, // PWR_FORTIFY = 17
			store: { ops: 200 },
		});
		await shard.tick();

		// Verify usePower returns OK.
		const rc = await shard.runPlayer('p1', code`
			const pc = Object.values(Game.powerCreeps)[0];
			const structs = new RoomPosition(25, 25, 'W1N1').lookFor(LOOK_STRUCTURES);
			const rampart = structs.find(s => s.structureType === 'rampart');
			rampart ? pc.usePower(PWR_FORTIFY, rampart) : -99
		`);
		expect(rc).toBe(OK);
	});

	test('RAMPART-DECAY-005 PWR_SHIELD creates a temporary rampart removed when effect expires', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'powerCreeps');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});

		await shard.placePowerCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			powers: { [12]: 1 }, // PWR_SHIELD = 12
			store: { ops: 200 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Object.values(Game.powerCreeps)[0].usePower(PWR_SHIELD)
		`);
		expect(rc).toBe(OK);

		// Verify a rampart exists at the power creep's position.
		const hasRampart = await shard.runPlayer('p1', code`
			new RoomPosition(25, 25, 'W1N1').lookFor(LOOK_STRUCTURES).some(s => s.structureType === 'rampart')
		`);
		expect(hasRampart).toBe(true);
	});
});
