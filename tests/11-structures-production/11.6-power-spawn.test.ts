import { describe, test, expect, code,
	OK, ERR_NOT_OWNER, ERR_NOT_ENOUGH_RESOURCES, ERR_RCL_NOT_ENOUGH,
	STRUCTURE_POWER_SPAWN, POWER_SPAWN_ENERGY_RATIO,
	POWER_INFO, PWR_OPERATE_POWER,
} from '../../src/index.js';

describe('StructurePowerSpawn processPower', () => {
	// ---- POWER-SPAWN-001: processPower() returns OK, consumes resources, adds GPL progress ----
	test('POWER-SPAWN-001 processPower returns OK and consumes 1 power + POWER_SPAWN_ENERGY_RATIO energy', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});

		const startEnergy = 1000;
		const startPower = 10;
		const psId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_POWER_SPAWN, owner: 'p1',
			store: { energy: startEnergy, power: startPower },
		});
		await shard.tick();

		// Submit the processPower intent.
		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${psId}).processPower()
		`);
		expect(rc).toBe(OK);

		// Observe store changes on next tick.
		const after = await shard.runPlayer('p1', code`
			const ps = Game.getObjectById(${psId});
			({
				energy: ps.store.energy,
				power: ps.store[RESOURCE_POWER] ?? 0,
				gpl: Game.gpl.progress,
			})
		`) as { energy: number; power: number; gpl: number };

		// Should consume 1 power and POWER_SPAWN_ENERGY_RATIO (50) energy.
		expect(after.power).toBe(startPower - 1);
		expect(after.energy).toBe(startEnergy - POWER_SPAWN_ENERGY_RATIO);
		// GPL progress should increase by 1.
		expect(after.gpl).toBeGreaterThanOrEqual(1);
	});

	// ---- POWER-SPAWN-002: PWR_OPERATE_POWER increases power consumed ----
	test('POWER-SPAWN-002 processPower with PWR_OPERATE_POWER consumes boosted power', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});

		const powerLevel = 1;
		const extraPower = (POWER_INFO as Record<number, { effect: number[] }>)[PWR_OPERATE_POWER].effect[powerLevel - 1];
		const expectedPowerConsumed = 1 + extraPower;

		const startEnergy = 5000;
		const startPower = 50;
		const psId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_POWER_SPAWN, owner: 'p1',
			store: { energy: startEnergy, power: startPower },
		});

		// Place a power creep with PWR_OPERATE_POWER at level 1.
		await shard.placePowerCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			powers: { [PWR_OPERATE_POWER]: powerLevel },
			store: { ops: 200 },
		});
		await shard.tick();

		// Activate PWR_OPERATE_POWER on the power spawn.
		await shard.runPlayer('p1', code`
			const pcs = Object.values(Game.powerCreeps);
			const pc = pcs[0];
			const ps = Game.getObjectById(${psId});
			pc.usePower(PWR_OPERATE_POWER, ps)
		`);

		// Power effect applies next tick. Now processPower.
		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${psId}).processPower()
		`);
		expect(rc).toBe(OK);

		// Observe store changes on the next tick.
		const after = await shard.runPlayer('p1', code`
			const ps = Game.getObjectById(${psId});
			({
				energy: ps.store.energy,
				power: ps.store[RESOURCE_POWER] ?? 0,
			})
		`) as { energy: number; power: number };

		// Should consume (1 + effect[level-1]) power per processPower.
		expect(after.power).toBe(startPower - expectedPowerConsumed);
		// Energy consumed is still POWER_SPAWN_ENERGY_RATIO per 1 base power.
		// With boosted power, energy consumed = expectedPowerConsumed * POWER_SPAWN_ENERGY_RATIO.
		expect(after.energy).toBe(startEnergy - expectedPowerConsumed * POWER_SPAWN_ENERGY_RATIO);
	});

	// ---- POWER-SPAWN-003: ERR_NOT_ENOUGH_RESOURCES when lacking power or energy ----
	test('POWER-SPAWN-003 processPower returns ERR_NOT_ENOUGH_RESOURCES when lacking power', async ({ shard }) => {
		shard.requires('powerCreeps');
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

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${psId}).processPower()
		`);
		expect(rc).toBe(ERR_NOT_ENOUGH_RESOURCES);
	});

	test('POWER-SPAWN-003 processPower returns ERR_NOT_ENOUGH_RESOURCES when lacking energy', async ({ shard }) => {
		shard.requires('powerCreeps');
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
		shard.requires('powerCreeps');
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
		shard.requires('powerCreeps');
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
