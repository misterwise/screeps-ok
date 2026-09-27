import { describe, test, expect, code,
	OK, ERR_NOT_OWNER, ERR_NOT_ENOUGH_RESOURCES, ERR_RCL_NOT_ENOUGH,
	STRUCTURE_POWER_SPAWN, POWER_SPAWN_ENERGY_RATIO, POWER_SPAWN_ENERGY_CAPACITY, POWER_SPAWN_POWER_CAPACITY,
	POWER_INFO, PWR_OPERATE_POWER, RESOURCE_OPS, RESOURCE_POWER, powerDuration, powerOps,
} from '../../src/index.js';
import type { ShardFixture } from '../../src/fixture.js';

describe('StructurePowerSpawn processPower', () => {
	// ---- POWER-SPAWN-001: processPower() returns OK, consumes resources, adds GPL progress ----
	test('POWER-SPAWN-001 processPower returns OK and consumes 1 power + POWER_SPAWN_ENERGY_RATIO energy', async ({ shard }) => {
		shard.requires('powerSpawn');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});
		const psId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_POWER_SPAWN, owner: 'p1',
			store: { energy: POWER_SPAWN_ENERGY_CAPACITY, [RESOURCE_POWER]: POWER_SPAWN_POWER_CAPACITY },
		});

		const [gplBefore, rc] = await shard.runPlayer('p1', code`
			[Game.gpl.progress, Game.getObjectById(${psId}).processPower()]
		`) as [number, number];
		expect(rc).toBe(OK);
		const ps = await shard.expectStructure(psId, STRUCTURE_POWER_SPAWN);
		expect(ps.store).toEqual({
			energy: POWER_SPAWN_ENERGY_CAPACITY - POWER_SPAWN_ENERGY_RATIO,
			[RESOURCE_POWER]: POWER_SPAWN_POWER_CAPACITY - 1,
		});
		expect(await shard.runPlayer('p1', code`Game.gpl.progress`)).toBe(gplBefore + 1);
	});

	// ---- POWER-SPAWN-002: PWR_OPERATE_POWER increases power consumed, capped by what is stored ----
	const operatePower = POWER_INFO[PWR_OPERATE_POWER];
	async function operatedPowerSpawn(shard: ShardFixture, level: number, power: number) {
		shard.requires('powerSpawn');
		shard.requires('powerCreeps');
		shard.requires('powerEffects');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1', powerEnabled: true }],
		});
		const psId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_POWER_SPAWN, owner: 'p1',
			store: { energy: POWER_SPAWN_ENERGY_CAPACITY, [RESOURCE_POWER]: power },
		});
		await shard.placePowerCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			powers: { [PWR_OPERATE_POWER]: level },
			store: { [RESOURCE_OPS]: powerOps(PWR_OPERATE_POWER, level) },
		});
		const useRc = await shard.runPlayer('p1', code`
			Object.values(Game.powerCreeps)[0].usePower(PWR_OPERATE_POWER, Game.getObjectById(${psId}))
		`);
		expect(useRc).toBe(OK);
		return psId;
	}

	test('POWER-SPAWN-002:boosted processPower under PWR_OPERATE_POWER converts 1 + effect power', async ({ shard }) => {
		const level = 1;
		const amount = 1 + operatePower.effect![level - 1];
		const psId = await operatedPowerSpawn(shard, level, POWER_SPAWN_POWER_CAPACITY);

		const [gplBefore, rc] = await shard.runPlayer('p1', code`
			[Game.gpl.progress, Game.getObjectById(${psId}).processPower()]
		`) as [number, number];
		expect(rc).toBe(OK);
		const ps = await shard.expectStructure(psId, STRUCTURE_POWER_SPAWN);
		expect(ps.store).toEqual({
			energy: POWER_SPAWN_ENERGY_CAPACITY - amount * POWER_SPAWN_ENERGY_RATIO,
			[RESOURCE_POWER]: POWER_SPAWN_POWER_CAPACITY - amount,
		});
		expect(await shard.runPlayer('p1', code`Game.gpl.progress`)).toBe(gplBefore + amount);
	});

	test('POWER-SPAWN-002:capped on the effect\'s last tick processPower converts only the power stored', async ({ shard }) => {
		// On its last tick the effect is gone from `effects` (rooms.js:1656-1657),
		// so processPower asks for 1 power, but the processor still applies it,
		// capped by the power stored (power-spawns/process-power.js:16-19).
		const level = 2;
		const stored = operatePower.effect![level - 1];
		const psId = await operatedPowerSpawn(shard, level, stored);

		await shard.tick(powerDuration(PWR_OPERATE_POWER, level) - 2);
		const [ticksRemaining, gplBefore] = await shard.runPlayer('p1', code`
			[Game.getObjectById(${psId}).effects[0].ticksRemaining, Game.gpl.progress]
		`) as [number, number];
		expect(ticksRemaining).toBe(1);
		const [effects, rc] = await shard.runPlayer('p1', code`
			const ps = Game.getObjectById(${psId});
			[ps.effects.length, ps.processPower()]
		`) as [number, number];
		expect([effects, rc]).toEqual([0, OK]);
		// The store getter reads 0 for a resource the snapshot leaves out.
		const ps = await shard.expectStructure(psId, STRUCTURE_POWER_SPAWN);
		expect({ energy: ps.store.energy, power: ps.store[RESOURCE_POWER] ?? 0 }).toEqual({
			energy: POWER_SPAWN_ENERGY_CAPACITY - stored * POWER_SPAWN_ENERGY_RATIO,
			power: 0,
		});
		expect(await shard.runPlayer('p1', code`Game.gpl.progress`)).toBe(gplBefore + stored);
	}, 60_000);

	// ---- POWER-SPAWN-003: ERR_NOT_ENOUGH_RESOURCES when lacking power or energy ----
	test('POWER-SPAWN-003 processPower returns ERR_NOT_ENOUGH_RESOURCES when lacking power', async ({ shard }) => {
		shard.requires('powerSpawn');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});

		// Enough energy but no power.
		const psId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_POWER_SPAWN, owner: 'p1',
			store: { energy: 1000 },
		});
		await shard.tick();

		const beforeGpl = await shard.runPlayer('p1', code`
			Game.gpl.progress
		`) as number;

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${psId}).processPower()
		`);
		expect(rc).toBe(ERR_NOT_ENOUGH_RESOURCES);

		const afterGpl = await shard.runPlayer('p1', code`
			Game.gpl.progress
		`) as number;
		expect(afterGpl).toBe(beforeGpl);
	});

	test('POWER-SPAWN-003 processPower returns ERR_NOT_ENOUGH_RESOURCES when lacking energy', async ({ shard }) => {
		shard.requires('powerSpawn');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});

		// Has power but insufficient energy (need POWER_SPAWN_ENERGY_RATIO = 50).
		const psId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_POWER_SPAWN, owner: 'p1',
			store: { energy: 10, power: 5 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${psId}).processPower()
		`);
		expect(rc).toBe(ERR_NOT_ENOUGH_RESOURCES);
	});

	// ---- POWER-SPAWN-004: ERR_RCL_NOT_ENOUGH when inactive (RCL < 8) ----
	test('POWER-SPAWN-004 processPower returns ERR_RCL_NOT_ENOUGH when RCL < 8', async ({ shard }) => {
		shard.requires('powerSpawn');
		// Power spawn requires RCL 8 — place at RCL 7 where isActive() is false.
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 7, owner: 'p1' }],
		});

		const psId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_POWER_SPAWN, owner: 'p1',
			store: { energy: 1000, power: 10 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${psId}).processPower()
		`);
		expect(rc).toBe(ERR_RCL_NOT_ENOUGH);
	});

	// ---- POWER-SPAWN-005: ERR_NOT_OWNER when not owned by player ----
	test('POWER-SPAWN-005 processPower returns ERR_NOT_OWNER when not owned by the player', async ({ shard }) => {
		shard.requires('powerSpawn');
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 8, owner: 'p1' },
				{ name: 'W2N1', rcl: 8, owner: 'p2' },
			],
		});

		// Place power spawn owned by p2 in p1's room.
		const psId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_POWER_SPAWN, owner: 'p2',
			store: { energy: 1000, power: 10 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const ps = Game.getObjectById(${psId});
			ps ? ps.processPower() : -99
		`);
		expect(rc).toBe(ERR_NOT_OWNER);
	});
});
