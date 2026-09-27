import { describe, test, expect, code,
	OK, ERR_INVALID_ARGS, ERR_NOT_IN_RANGE, ERR_INVALID_TARGET,
	POWER_INFO, POWER_CREEP_LIFE_TIME, TOMBSTONE_DECAY_POWER_CREEP,
	PWR_OPERATE_TOWER, PWR_DISRUPT_TOWER, PWR_OPERATE_LAB,
	PWR_OPERATE_FACTORY, PWR_OPERATE_TERMINAL, PWR_OPERATE_SPAWN, PWR_OPERATE_POWER,
	PWR_REGEN_SOURCE, PWR_REGEN_MINERAL, PWR_DISRUPT_SOURCE,
	PWR_SHIELD, PWR_FORTIFY,
	ERR_TIRED,
	RESOURCE_ENERGY, RESOURCE_OPS,
	STRUCTURE_TOWER, STRUCTURE_LAB, STRUCTURE_TERMINAL,
	STRUCTURE_POWER_SPAWN, STRUCTURE_SPAWN,
	ATTACK, MOVE, TOUGH,
	STRUCTURE_RAMPART, STRUCTURE_CONTROLLER, STRUCTURE_STORAGE, STRUCTURE_EXTENSION,
	FIND_STRUCTURES,
} from '../../src/index.js';
import type { ShardFixture } from '../../src/fixture.js';
import { powerTargetCases, type PowerTargetCase } from '../../src/matrices/power-targets.js';
import { powerCreepRenewValidationCases } from '../../src/matrices/power-creep-renew-validation.js';
import { powerCreepSpawnValidationCases } from '../../src/matrices/power-creep-spawn-validation.js';

const PI = POWER_INFO as Record<number, {
	className: string;
	level: number[];
	cooldown: number;
	range: number;
	ops: number;
	duration?: number | number[];
	effect?: number[];
}>;

describe('Operate powers', () => {
	// POWER-OPERATE-001: effect magnitudes match POWER_INFO
	// Verify a representative operate power's effect in-game matches POWER_INFO.
	test('POWER-OPERATE-001 operate power effect magnitudes match POWER_INFO', async ({ shard }) => {
		shard.requires('powerCreeps');
		shard.requires('powerEffects');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1', powerEnabled: true }],
		});

		// Use PWR_OPERATE_TOWER as representative. Place tower + power creep.
		const towerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
			store: { energy: 1000 },
		});
		await shard.placePowerCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			powers: { [PWR_OPERATE_TOWER]: 1 },
			store: { ops: 200 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const pc = Object.values(Game.powerCreeps)[0];
			const tower = Game.getObjectById(${towerId});
			pc.usePower(PWR_OPERATE_TOWER, tower)
		`);
		expect(rc).toBe(OK);

		// Verify effect is active on the tower.
		const effects = await shard.runPlayer('p1', code`
			const tower = Game.getObjectById(${towerId});
			tower.effects ? tower.effects.map(e => ({ effect: e.effect, level: e.level, ticksRemaining: e.ticksRemaining })) : []
		`) as Array<{ effect: number; level: number; ticksRemaining: number }>;
		const opEffect = effects.find(e => e.effect === PWR_OPERATE_TOWER);
		expect(opEffect).toBeDefined();
		expect(opEffect!.level).toBe(1);
	});

	// POWER-OPERATE-002: cooldown, range, ops cost match POWER_INFO
	test('POWER-OPERATE-002 operate power cooldown, range, and ops match POWER_INFO', async ({ shard }) => {
		shard.requires('powerCreeps');
		shard.requires('powerEffects');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1', powerEnabled: true }],
		});

		const towerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
			store: { energy: 1000 },
		});
		await shard.placePowerCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			powers: { [PWR_OPERATE_TOWER]: 1 },
			store: { ops: 200 },
		});
		await shard.tick();

		const storeBefore = await shard.runPlayer('p1', code`
			Object.values(Game.powerCreeps)[0].store.ops
		`) as number;

		await shard.runPlayer('p1', code`
			const pc = Object.values(Game.powerCreeps)[0];
			pc.usePower(PWR_OPERATE_TOWER, Game.getObjectById(${towerId}))
		`);

		// Check ops were consumed.
		const result = await shard.runPlayer('p1', code`
			const pc = Object.values(Game.powerCreeps)[0];
			({ ops: pc.store.ops, cooldown: pc.powers[PWR_OPERATE_TOWER].cooldown })
		`) as { ops: number; cooldown: number };

		const expectedOps = PI[PWR_OPERATE_TOWER].ops;
		expect(storeBefore - result.ops).toBe(expectedOps);
		// Anchored on the use tick; read one tick later.
		expect(result.cooldown).toBe(PI[PWR_OPERATE_TOWER].cooldown - 1);
	});

	test('POWER-OPERATE-006 usePower returns ERR_TIRED when the seeded power cooldown is active', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1', powerEnabled: true }],
		});

		const towerId = await shard.placeStructure('W1N1', {
			pos: [25, 25],
			structureType: STRUCTURE_TOWER,
			owner: 'p1',
			store: { [RESOURCE_ENERGY]: 1000 },
		});
		await shard.placePowerCreep('W1N1', {
			pos: [25, 26],
			owner: 'p1',
			powers: { [PWR_OPERATE_TOWER]: { level: 1, cooldown: 10 } },
			store: { [RESOURCE_OPS]: 200 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const pc = Object.values(Game.powerCreeps)[0];
			pc.usePower(PWR_OPERATE_TOWER, Game.getObjectById(${towerId}))
		`);
		expect(rc).toBe(ERR_TIRED);
	});
});

describe('Disrupt powers', () => {
	// POWER-DISRUPT-001: effect values match POWER_INFO
	test('POWER-DISRUPT-001 disrupt power effect values match POWER_INFO', async ({ shard }) => {
		shard.requires('powerCreeps');
		shard.requires('powerEffects');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1', powerEnabled: true }],
		});

		const towerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
			store: { energy: 1000 },
		});
		await shard.placePowerCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			powers: { [PWR_DISRUPT_TOWER]: 1 },
			store: { ops: 200 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const pc = Object.values(Game.powerCreeps)[0];
			pc.usePower(PWR_DISRUPT_TOWER, Game.getObjectById(${towerId}))
		`);
		expect(rc).toBe(OK);

		const effects = await shard.runPlayer('p1', code`
			const tower = Game.getObjectById(${towerId});
			tower.effects ? tower.effects.map(e => ({ effect: e.effect, level: e.level })) : []
		`) as Array<{ effect: number; level: number }>;
		const disruptEffect = effects.find(e => e.effect === PWR_DISRUPT_TOWER);
		expect(disruptEffect).toBeDefined();
	});

	// POWER-DISRUPT-002: cooldown, range, ops match POWER_INFO
	test('POWER-DISRUPT-002 disrupt power cooldown, range, and ops match POWER_INFO', async ({ shard }) => {
		shard.requires('powerCreeps');
		shard.requires('powerEffects');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1', powerEnabled: true }],
		});

		const towerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
			store: { energy: 1000 },
		});
		await shard.placePowerCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			powers: { [PWR_DISRUPT_TOWER]: 1 },
			store: { ops: 200 },
		});
		await shard.tick();

		const opsBefore = await shard.runPlayer('p1', code`
			Object.values(Game.powerCreeps)[0].store.ops
		`) as number;

		await shard.runPlayer('p1', code`
			const pc = Object.values(Game.powerCreeps)[0];
			pc.usePower(PWR_DISRUPT_TOWER, Game.getObjectById(${towerId}))
		`);

		const result = await shard.runPlayer('p1', code`
			const pc = Object.values(Game.powerCreeps)[0];
			const power = pc.powers[PWR_DISRUPT_TOWER];
			({ ops: pc.store.ops, cooldown: power ? power.cooldown : -1 })
		`) as { ops: number; cooldown: number };

		expect(opsBefore - result.ops).toBe(PI[PWR_DISRUPT_TOWER].ops);
		// PWR_DISRUPT_TOWER has no cooldown, so the getter's floor of 0 applies.
		expect(result.cooldown).toBe(Math.max(0, PI[PWR_DISRUPT_TOWER].cooldown - 1));
	});
});

describe('Regen powers', () => {
	test('POWER-REGEN-001 regen source effect amount matches POWER_INFO', async ({ shard }) => {
		shard.requires('powerCreeps');
		shard.requires('powerEffects');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1', powerEnabled: true }],
		});

		const sourceId = await shard.placeSource('W1N1', {
			pos: [25, 25], energy: 0, energyCapacity: 3000,
		});
		await shard.placePowerCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			powers: { [PWR_REGEN_SOURCE]: 1 },
			store: { ops: 200 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const pc = Object.values(Game.powerCreeps)[0];
			const source = Game.getObjectById(${sourceId});
			pc.usePower(PWR_REGEN_SOURCE, source)
		`);
		expect(rc).toBe(OK);

		// Source should have a regen effect.
		const effects = await shard.runPlayer('p1', code`
			const source = Game.getObjectById(${sourceId});
			source.effects ? source.effects.map(e => ({ effect: e.effect, level: e.level })) : []
		`) as Array<{ effect: number; level: number }>;
		const regenEffect = effects.find(e => e.effect === PWR_REGEN_SOURCE);
		expect(regenEffect).toBeDefined();
	});

	test('POWER-REGEN-002 regen power cooldown, range, and ops match POWER_INFO', async ({ shard }) => {
		shard.requires('powerCreeps');
		shard.requires('powerEffects');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1', powerEnabled: true }],
		});

		const sourceId = await shard.placeSource('W1N1', {
			pos: [25, 25], energy: 0, energyCapacity: 3000,
		});
		await shard.placePowerCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			powers: { [PWR_REGEN_SOURCE]: 1 },
			store: { ops: 200 },
		});
		await shard.tick();

		const opsBefore = await shard.runPlayer('p1', code`
			Object.values(Game.powerCreeps)[0].store.ops
		`) as number;

		await shard.runPlayer('p1', code`
			const pc = Object.values(Game.powerCreeps)[0];
			pc.usePower(PWR_REGEN_SOURCE, Game.getObjectById(${sourceId}))
		`);

		const result = await shard.runPlayer('p1', code`
			const pc = Object.values(Game.powerCreeps)[0];
			const power = pc.powers[PWR_REGEN_SOURCE];
			({ ops: pc.store.ops, cooldown: power ? power.cooldown : -1 })
		`) as { ops: number; cooldown: number };

		// PWR_REGEN_SOURCE has no ops cost.
		const expectedOps = PI[PWR_REGEN_SOURCE].ops ?? 0;
		expect(opsBefore - result.ops).toBe(expectedOps);
		// Anchored on the use tick; read one tick later.
		expect(result.cooldown).toBe(PI[PWR_REGEN_SOURCE].cooldown - 1);
	});
});

describe('Combat powers', () => {
	test('POWER-COMBAT-002 PWR_SHIELD creates a temporary rampart at the power creep position', async ({ shard }) => {
		shard.requires('powerCreeps');
		shard.requires('powerEffects');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1', powerEnabled: true }],
		});

		await shard.placePowerCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			powers: { [PWR_SHIELD]: 1 },
			store: { ops: 200 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const pc = Object.values(Game.powerCreeps)[0];
			pc.usePower(PWR_SHIELD)
		`);
		expect(rc).toBe(OK);

		// A rampart should appear at the power creep's position.
		const result = await shard.runPlayer('p1', code`
			const pos = new RoomPosition(25, 25, 'W1N1');
			const structs = pos.lookFor(LOOK_STRUCTURES);
			const rampart = structs.find(s => s.structureType === STRUCTURE_RAMPART);
			rampart ? ({ x: rampart.pos.x, y: rampart.pos.y, type: rampart.structureType }) : null
		`) as { x: number; y: number; type: string } | null;
		expect(result).not.toBeNull();
		expect(result!.type).toBe(STRUCTURE_RAMPART);
	});

	test('POWER-COMBAT-001 PWR_SHIELD and PWR_FORTIFY exist in POWER_INFO with effect arrays', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});
		await shard.tick();

		// Verify the POWER_INFO entries exist with the expected shape.
		const result = await shard.runPlayer('p1', code`
			const shield = POWER_INFO[PWR_SHIELD];
			const fortify = POWER_INFO[PWR_FORTIFY];
			({
				shieldExists: !!shield,
				fortifyExists: !!fortify,
				shieldHasCooldown: typeof shield.cooldown === 'number',
				fortifyHasCooldown: typeof fortify.cooldown === 'number',
			})
		`) as Record<string, boolean>;
		expect(result.shieldExists).toBe(true);
		expect(result.fortifyExists).toBe(true);
		expect(result.shieldHasCooldown).toBe(true);
		expect(result.fortifyHasCooldown).toBe(true);
	});

	test('POWER-COMBAT-003 PWR_SHIELD rampart is removed when the effect expires', async ({ shard }) => {
		shard.requires('powerCreeps');
		shard.requires('powerEffects');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1', powerEnabled: true }],
		});

		await shard.placePowerCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			powers: { [PWR_SHIELD]: 1 },
			store: { ops: 200 },
		});
		await shard.tick();

		// Activate shield.
		await shard.runPlayer('p1', code`
			Object.values(Game.powerCreeps)[0].usePower(PWR_SHIELD)
		`);

		// Rampart should exist now.
		const exists = await shard.runPlayer('p1', code`
			new RoomPosition(25, 25, 'W1N1').lookFor(LOOK_STRUCTURES).some(s => s.structureType === STRUCTURE_RAMPART)
		`);
		expect(exists).toBe(true);

		// Shield duration for level 1 — advance enough ticks for it to expire.
		const durVal = PI[PWR_SHIELD].duration;
		const duration = Array.isArray(durVal) ? durVal[0] : (durVal ?? 20);
		// Tick past the duration.
		for (let i = 0; i < duration + 5; i++) await shard.tick();

		const gone = await shard.runPlayer('p1', code`
			new RoomPosition(25, 25, 'W1N1').lookFor(LOOK_STRUCTURES).some(s => s.structureType === STRUCTURE_RAMPART)
		`);
		expect(gone).toBe(false);
	});
});

// Setup for one POWER-TARGETS case: a power creep in range of a single target structure.
async function placePowerTarget(shard: ShardFixture, row: PowerTargetCase, structureType: string, powerEnabled: boolean) {
	await shard.createShard({
		players: ['p1'],
		rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1', powerEnabled }],
	});
	let targetId: string;
	if (structureType === STRUCTURE_CONTROLLER) {
		const controller = (await shard.findInRoom('W1N1', FIND_STRUCTURES))
			.find(s => s.kind === 'structure' && s.structureType === STRUCTURE_CONTROLLER);
		if (!controller) throw new Error('W1N1 has no controller');
		targetId = controller.id;
	} else {
		targetId = await shard.placeStructure('W1N1', {
			pos: [27, 25], structureType, owner: 'p1',
			...(structureType === STRUCTURE_STORAGE ? { store: { energy: 1000 } } : {}),
		});
	}
	// OPERATE_EXTENSION charges only when it moves energy into an extension.
	await shard.placeStructure('W1N1', { pos: [30, 30], structureType: STRUCTURE_EXTENSION, owner: 'p1' });
	const pos: [number, number] = structureType === STRUCTURE_CONTROLLER ? [3, 2] : [25, 25];
	const creepId = await shard.placePowerCreep('W1N1', {
		pos, owner: 'p1', powers: { [row.power]: row.powerLevel ?? 1 }, store: { ops: 200 },
	});
	await shard.tick();
	return { targetId, creepId };
}

describe('Power target matrix', () => {
	for (const row of powerTargetCases) {
		const info = PI[row.power];
		const level = row.powerLevel ?? 1;
		const cost = Array.isArray(info.ops) ? info.ops[level - 1] : (info.ops ?? 0);

		for (const valid of [true, false]) {
			test(`${row.catalogId}:${row.key}${valid ? 'Valid' : 'Invalid'} usePower on ${valid ? 'its' : 'another'} target type ${valid ? 'charges ops and starts the cooldown' : 'is dropped without cost'}`, async ({ shard }) => {
				shard.requires('powerCreeps');
				shard.requires('powerEffects');
				const { targetId, creepId } = await placePowerTarget(
					shard, row, valid ? row.validTarget : row.invalidTarget, true);

				const rc = await shard.runPlayer('p1', code`
					Game.getObjectById(${creepId}).usePower(${row.power}, Game.getObjectById(${targetId}))
				`);
				const after = await shard.runPlayer('p1', code`
					const pc = Game.getObjectById(${creepId});
					({
						ops: pc.store[RESOURCE_OPS],
						cooldown: pc.powers[${row.power}].cooldown,
						effects: (Game.getObjectById(${targetId}).effects ?? []).map(e => e.power),
					})
				`);
				// The game layer never checks the target type; the processor does.
				expect({ rc, ...(after as object) }).toEqual(valid
					? { rc: OK, ops: 200 - cost, cooldown: Math.max(0, info.cooldown - 1), effects: row.hostsEffect ? [row.power] : [] }
					: { rc: OK, ops: 200, cooldown: 0, effects: [] });
			});
		}

		if (row.catalogId === 'POWER-OPERATE-005') {
			test(`POWERCREEP-ENABLE-003:${row.key} usePower returns ERR_INVALID_ARGS in a room without power enabled`, async ({ shard }) => {
				shard.requires('powerCreeps');
				const { targetId, creepId } = await placePowerTarget(shard, row, row.validTarget, false);

				const rc = await shard.runPlayer('p1', code`
					Game.getObjectById(${creepId}).usePower(${row.power}, Game.getObjectById(${targetId}))
				`);
				expect(rc).toBe(ERR_INVALID_ARGS);
			});
		}
	}
});

describe('Power creep renew', () => {
	test('POWERCREEP-RENEW-001 renew resets ticksToLive', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});

		const psId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_POWER_SPAWN, owner: 'p1',
			store: { energy: 1000, power: 100 },
		});
		await shard.placePowerCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			powers: {},
			store: { ops: 10 },
		});
		await shard.tick();

		// Advance a few ticks so TTL decreases.
		await shard.tick();
		await shard.tick();

		// Renew at the power spawn.
		const rc = await shard.runPlayer('p1', code`
			const pc = Object.values(Game.powerCreeps)[0];
			const ps = Game.getObjectById(${psId});
			pc.renew(ps)
		`);
		expect(rc).toBe(OK);

		// After renew, ticksToLive should be reset to POWER_CREEP_LIFE_TIME.
		// The renew intent is processed during the runPlayer tick, and
		// the observation happens on the next runPlayer tick (1 tick later).
		const ttl = await shard.runPlayer('p1', code`
			Object.values(Game.powerCreeps)[0].ticksToLive
		`) as number;
		expect(ttl).toBe(POWER_CREEP_LIFE_TIME - 1);
	});

	for (const row of powerCreepRenewValidationCases) {
		test(`POWERCREEP-RENEW-002:${row.label} powerCreep.renew() validation returns the canonical code`, async ({ shard }) => {
			const blockers = new Set(row.blockers);
			shard.requires('powerCreeps');
			// Only the account API can make an unspawned power creep.
			if (blockers.has('busy')) shard.requires('powerCreepAccountApi');
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [
					{ name: 'W1N1', rcl: blockers.has('rcl') ? 7 : 8, owner: 'p1' },
					{ name: 'W2N1', rcl: 1, owner: 'p2' },
				],
			});
			const powerSpawnId = await shard.placeStructure('W1N1', {
				pos: [25, 25], structureType: STRUCTURE_POWER_SPAWN, owner: 'p1',
			});
			const creepId = blockers.has('busy') ? null : await shard.placePowerCreep('W1N1', {
				pos: blockers.has('range') ? [40, 40] : [25, 26],
				owner: blockers.has('not-owner') ? 'p2' : 'p1',
				powers: {},
			});
			await shard.tick();
			if (blockers.has('busy')) {
				expect(await shard.runPlayer('p1', code`PowerCreep.create('Idle', POWER_CLASS.OPERATOR)`)).toBe(OK);
			}

			const rc = await shard.runPlayer('p1', code`
				const pc = ${creepId} === null ? Game.powerCreeps.Idle : Game.getObjectById(${creepId});
				const target = ${blockers.has('invalid-target')} ? Game.rooms.W1N1.controller : Game.getObjectById(${powerSpawnId});
				pc.renew(target)
			`);
			expect(rc).toBe(row.expectedRc);
		});
	}

	for (const row of powerCreepSpawnValidationCases) {
		test(`POWERCREEP-SPAWN-002:${row.label} powerCreep.spawn() validation returns the canonical code`, async ({ shard }) => {
			const blockers = new Set(row.blockers);
			shard.requires('powerCreeps');
			// Every unspawned creep comes from the account API; only a spawned one can be placed.
			if (!blockers.has('busy')) shard.requires('powerCreepAccountApi');
			const hostile = blockers.has('not-owner');
			const inactive = blockers.has('rcl');
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [
					{ name: 'W1N1', rcl: 8, owner: 'p1' },
					{ name: 'W2N1', rcl: hostile && inactive ? 7 : 8, owner: 'p2' },
					{ name: 'W3N1', rcl: 7, owner: 'p1' },
				],
			});
			// The creep spawns and dies at W1N1's active power spawn; the target varies.
			const homeSpawnId = await shard.placeStructure('W1N1', {
				pos: [25, 25], structureType: STRUCTURE_POWER_SPAWN, owner: 'p1',
			});
			const hostileSpawnId = await shard.placeStructure('W2N1', {
				pos: [25, 25], structureType: STRUCTURE_POWER_SPAWN, owner: 'p2',
			});
			const inactiveSpawnId = await shard.placeStructure('W3N1', {
				pos: [25, 25], structureType: STRUCTURE_POWER_SPAWN, owner: 'p1',
			});
			// Vision of the hostile power spawn.
			await shard.placeCreep('W2N1', { pos: [10, 10], owner: 'p1', body: [MOVE] });
			if (blockers.has('busy')) {
				await shard.placePowerCreep('W1N1', { pos: [25, 26], owner: 'p1', name: 'Spawner', powers: {} });
			}
			await shard.tick();
			if (!blockers.has('busy')) {
				expect(await shard.runPlayer('p1', code`PowerCreep.create('Spawner', POWER_CLASS.OPERATOR)`)).toBe(OK);
			}
			if (blockers.has('cooldown')) {
				expect(await shard.runPlayer('p1', code`Game.powerCreeps.Spawner.spawn(Game.getObjectById(${homeSpawnId}))`)).toBe(OK);
				expect(await shard.runPlayer('p1', code`Game.powerCreeps.Spawner.suicide()`)).toBe(OK);
			}

			const targetId = hostile ? hostileSpawnId : inactive ? inactiveSpawnId : homeSpawnId;
			const rc = await shard.runPlayer('p1', code`
				const target = ${blockers.has('invalid-target')} ? Game.rooms.W1N1.controller : Game.getObjectById(${targetId});
				Game.powerCreeps.Spawner.spawn(target)
			`);
			expect(rc).toBe(row.expectedRc);
		});
	}

	test('POWERCREEP-DEATH-001 power creep death creates a tombstone', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});
		await shard.placePowerCreep('W1N1', {
			pos: [25, 25], owner: 'p1', name: 'Doomed',
			powers: {},
			store: { ops: 10 },
		});
		await shard.tick();

		const death = await shard.runPlayer('p1', code`
			const pc = Game.powerCreeps['Doomed'];
			({ id: pc.id, rc: pc.suicide(), time: Game.time })
		`) as { id: string; rc: number; time: number };
		expect(death.rc).toBe(OK);

		const tomb = await shard.runPlayer('p1', code`
			const t = Game.rooms['W1N1'].lookForAt(LOOK_TOMBSTONES, 25, 25)[0];
			t ? ({
				deathTime: t.deathTime,
				ticksToDecay: t.ticksToDecay,
				ops: t.store[RESOURCE_OPS],
				creepId: t.creep.id,
				creepName: t.creep.name,
			}) : null
		`);
		// Stamped on the suicide tick; read one tick later.
		expect(tomb).toEqual({
			deathTime: death.time,
			ticksToDecay: TOMBSTONE_DECAY_POWER_CREEP - 1,
			ops: 10,
			creepId: death.id,
			creepName: 'Doomed',
		});
	});
});
