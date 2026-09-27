import { describe, test, expect, code,
	OK, ERR_INVALID_ARGS, ERR_NOT_IN_RANGE, ERR_TIRED,
	POWER_INFO, POWER_CREEP_LIFE_TIME, TOMBSTONE_DECAY_POWER_CREEP,
	PWR_OPERATE_TOWER, PWR_OPERATE_SPAWN, PWR_OPERATE_STORAGE, PWR_OPERATE_EXTENSION, PWR_OPERATE_CONTROLLER,
	PWR_SHIELD, PWR_FORTIFY,
	RESOURCE_ENERGY, RESOURCE_HYDROGEN, RESOURCE_OPS, powerDuration, powerOps, body,
	STRUCTURE_TOWER, STRUCTURE_POWER_SPAWN, STRUCTURE_SPAWN, STRUCTURE_RAMPART, STRUCTURE_CONTROLLER,
	STRUCTURE_STORAGE, STRUCTURE_EXTENSION,
	MOVE, WORK, CARRY,
	FIND_STRUCTURES,
} from '../../src/index.js';
import type { ShardFixture } from '../../src/fixture.js';
import { powerCostCases } from '../../src/matrices/power-costs.js';
import { OPERATE_EXTENSION_COUNT, OPERATE_SPAWN_PARTS, disruptPowerCases, operatePowerCases } from '../../src/matrices/power-effects.js';
import { powerTargetCases, type PowerTargetCase } from '../../src/matrices/power-targets.js';
import { powerCreepRenewValidationCases } from '../../src/matrices/power-creep-renew-validation.js';
import { powerCreepSpawnValidationCases } from '../../src/matrices/power-creep-spawn-validation.js';

// Enough ops for any one use, within a level-1 power creep's store.
const OPS_STOCK = 200;

describe('Operate powers', () => {
	for (const row of operatePowerCases) {
		test(`POWER-OPERATE-001:${row.key} the operate effect's magnitude at its level`, async ({ shard }) => {
			shard.requires('powerCreeps');
			shard.requires('powerEffects');
			expect(await operateMagnitude[row.power](shard, row.level)).toBe(row.expected);
		});
	}

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
	for (const row of disruptPowerCases) {
		test(`POWER-DISRUPT-001:${row.key} the disrupt effect lasts its duration`, async ({ shard }) => {
			shard.requires('powerCreeps');
			shard.requires('powerEffects');
			const { targetId, nearId } = await placePowerUse(shard, row.power, row.level, row.target);
			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${nearId}).usePower(${row.power}, Game.getObjectById(${targetId}))
			`);
			expect(rc).toBe(OK);
			const after = await shard.runPlayer('p1', code`
				({
					ops: Game.getObjectById(${nearId}).store[RESOURCE_OPS],
					effects: Game.getObjectById(${targetId}).effects.map(e => ({ power: e.power, level: e.level, ticksRemaining: e.ticksRemaining })),
				})
			`);
			// Read a tick after the use; a one-tick effect has already ended, the charged ops showing it was applied.
			const ticksRemaining = row.duration - 1;
			expect(after).toEqual({
				ops: OPS_STOCK - powerOps(row.power, row.level),
				effects: ticksRemaining > 0 ? [{ power: row.power, level: row.level, ticksRemaining }] : [],
			});
		});
	}
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

	for (const level of POWER_INFO[PWR_SHIELD].level.map((_, i) => i + 1)) {
		test(`POWER-COMBAT-001:shieldLevel${level} PWR_SHIELD's rampart has the level's hits`, async ({ shard }) => {
			shard.requires('powerCreeps');
			shard.requires('powerEffects');
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1', powerEnabled: true }],
			});
			const creepId = await shard.placePowerCreep('W1N1', { pos: [25, 25], owner: 'p1', powers: { [PWR_SHIELD]: level } });
			await shard.tick();

			expect(await shard.runPlayer('p1', code`Game.getObjectById(${creepId}).usePower(PWR_SHIELD)`)).toBe(OK);
			const ramparts = await shard.runPlayer('p1', code`
				new RoomPosition(25, 25, 'W1N1').lookFor(LOOK_STRUCTURES)
					.filter(s => s.structureType === STRUCTURE_RAMPART).map(s => s.hits)
			`);
			expect(ramparts).toEqual([POWER_INFO[PWR_SHIELD].effect![level - 1]]);
		});
	}

	for (const level of POWER_INFO[PWR_FORTIFY].level.map((_, i) => i + 1)) {
		test(`POWER-COMBAT-001:fortifyLevel${level} PWR_FORTIFY's effect lasts the level's duration`, async ({ shard }) => {
			shard.requires('powerCreeps');
			shard.requires('powerEffects');
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1', powerEnabled: true }],
			});
			const rampartId = await shard.placeStructure('W1N1', { pos: [27, 25], structureType: STRUCTURE_RAMPART, owner: 'p1' });
			const creepId = await shard.placePowerCreep('W1N1', {
				pos: [25, 25], owner: 'p1', powers: { [PWR_FORTIFY]: level }, store: { [RESOURCE_OPS]: OPS_STOCK },
			});
			await shard.tick();

			expect(await shard.runPlayer('p1', code`
				Game.getObjectById(${creepId}).usePower(PWR_FORTIFY, Game.getObjectById(${rampartId}))
			`)).toBe(OK);
			const after = await shard.runPlayer('p1', code`
				({
					ops: Game.getObjectById(${creepId}).store[RESOURCE_OPS],
					effects: Game.getObjectById(${rampartId}).effects.map(e => ({ power: e.power, level: e.level, ticksRemaining: e.ticksRemaining })),
				})
			`);
			// Read a tick after the use; a one-tick effect has already ended, the charged ops showing it was applied.
			const ticksRemaining = powerDuration(PWR_FORTIFY, level) - 1;
			expect(after).toEqual({
				ops: OPS_STOCK - powerOps(PWR_FORTIFY, level),
				effects: ticksRemaining > 0 ? [{ power: PWR_FORTIFY, level, ticksRemaining }] : [],
			});
		});
	}

	test('POWER-COMBAT-003 PWR_SHIELD rampart is removed when the effect expires', async ({ shard }) => {
		shard.requires('powerCreeps');
		shard.requires('powerEffects');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1', powerEnabled: true }],
		});
		const creepId = await shard.placePowerCreep('W1N1', { pos: [25, 25], owner: 'p1', powers: { [PWR_SHIELD]: 1 } });
		await shard.tick();

		const use = await shard.runPlayer('p1', code`
			({ rc: Game.getObjectById(${creepId}).usePower(PWR_SHIELD), time: Game.time })
		`) as { rc: number; time: number };
		expect(use.rc).toBe(OK);

		// The effect ends `duration` ticks after the use, and that tick's processing removes the rampart.
		const duration = powerDuration(PWR_SHIELD, 1);
		await shard.tick(duration - 1);
		const shielded = code`({
			time: Game.time,
			rampart: new RoomPosition(25, 25, 'W1N1').lookFor(LOOK_STRUCTURES).some(s => s.structureType === STRUCTURE_RAMPART),
		})`;
		expect(await shard.runPlayer('p1', shielded)).toEqual({ time: use.time + duration, rampart: true });
		expect(await shard.runPlayer('p1', shielded)).toEqual({ time: use.time + duration + 1, rampart: false });
	});
});

// A power creep holding the power at `level`, at its range from a target the processor accepts,
// and a second a tile further when the room has that tile.
async function placePowerUse(shard: ShardFixture, power: number, level: number, target: string) {
	await shard.createShard({
		players: ['p1'],
		rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1', powerEnabled: true }],
	});
	const range = POWER_INFO[power].range!;
	const controller = target === STRUCTURE_CONTROLLER;
	const [tx, ty]: [number, number] = controller ? [1, 1] : [2, 25];
	let targetId: string;
	if (controller) {
		const found = (await shard.findInRoom('W1N1', FIND_STRUCTURES))
			.find(s => s.kind === 'structure' && s.structureType === STRUCTURE_CONTROLLER);
		if (!found) throw new Error('W1N1 has no controller');
		targetId = found.id;
	} else if (target === 'source') {
		targetId = await shard.placeSource('W1N1', { pos: [tx, ty] });
	} else if (target === 'mineral') {
		targetId = await shard.placeMineral('W1N1', { pos: [tx, ty], mineralType: RESOURCE_HYDROGEN });
	} else {
		targetId = await shard.placeStructure('W1N1', {
			pos: [tx, ty], structureType: target, owner: 'p1',
			...(target === STRUCTURE_STORAGE ? { store: { [RESOURCE_ENERGY]: 1000 } } : {}),
		});
	}
	// OPERATE_EXTENSION charges only when it moves energy into an extension.
	await shard.placeStructure('W1N1', { pos: [30, 30], structureType: STRUCTURE_EXTENSION, owner: 'p1' });
	const place = (x: number) => shard.placePowerCreep('W1N1', {
		pos: [x, ty], owner: 'p1', powers: { [power]: level }, store: { [RESOURCE_OPS]: OPS_STOCK },
	});
	const nearId = await place(Math.min(tx + range, 48));
	const farId = tx + range + 1 <= 48 ? await place(tx + range + 1) : null;
	await shard.tick();
	return { targetId, nearId, farId };
}

// A power creep beside `targetId` operates it at `level`; the effect lands on this tick.
async function operate(shard: ShardFixture, power: number, level: number, targetId: string, pos: [number, number]) {
	const creepId = await shard.placePowerCreep('W1N1', { pos, owner: 'p1', powers: { [power]: level }, store: { [RESOURCE_OPS]: OPS_STOCK } });
	await shard.tick();
	expect(await shard.runPlayer('p1', code`
		Game.getObjectById(${creepId}).usePower(${power}, Game.getObjectById(${targetId}))
	`)).toBe(OK);
}

async function operatedRoom(shard: ShardFixture) {
	await shard.createShard({ players: ['p1'], rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1', powerEnabled: true }] });
}

// Each POWER-OPERATE-001 power's magnitude, read the tick after the power is used.
const operateMagnitude: Record<number, (shard: ShardFixture, level: number) => Promise<number>> = {
	// The spawn time of a creep started under the effect.
	async [PWR_OPERATE_SPAWN](shard, level) {
		await operatedRoom(shard);
		const spawnId = await shard.placeStructure('W1N1', { pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1' });
		await operate(shard, PWR_OPERATE_SPAWN, level, spawnId, [25, 27]);
		expect(await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep(${Array(OPERATE_SPAWN_PARTS).fill(MOVE)}, 'operated')
		`)).toBe(OK);
		return await shard.runPlayer('p1', code`Game.getObjectById(${spawnId}).spawning.needTime`) as number;
	},
	async [PWR_OPERATE_STORAGE](shard, level) {
		await operatedRoom(shard);
		const storageId = await shard.placeStructure('W1N1', { pos: [25, 25], structureType: STRUCTURE_STORAGE, owner: 'p1' });
		await operate(shard, PWR_OPERATE_STORAGE, level, storageId, [25, 27]);
		return await shard.runPlayer('p1', code`Game.getObjectById(${storageId}).store.getCapacity()`) as number;
	},
	// The energy the storage moves into the room's empty extensions.
	async [PWR_OPERATE_EXTENSION](shard, level) {
		await operatedRoom(shard);
		const storageId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_STORAGE, owner: 'p1', store: { [RESOURCE_ENERGY]: 10000 },
		});
		for (let i = 0; i < OPERATE_EXTENSION_COUNT; i++) {
			await shard.placeStructure('W1N1', { pos: [30 + 2 * i, 30], structureType: STRUCTURE_EXTENSION, owner: 'p1' });
		}
		await operate(shard, PWR_OPERATE_EXTENSION, level, storageId, [25, 27]);
		return await shard.runPlayer('p1', code`
			_.sum(Game.rooms.W1N1.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_EXTENSION } }), e => e.store[RESOURCE_ENERGY])
		`) as number;
	},
	// The energy two 40-WORK creeps upgrade the level 8 controller by in one tick, past the cap the effect raises.
	async [PWR_OPERATE_CONTROLLER](shard, level) {
		await operatedRoom(shard);
		const upgraders = [];
		for (const pos of [[4, 1], [4, 2]] as const) {
			upgraders.push(await shard.placeCreep('W1N1', {
				pos: [pos[0], pos[1]], owner: 'p1', body: body(40, WORK, 5, CARRY, 5, MOVE), store: { [RESOURCE_ENERGY]: 100 },
			}));
		}
		const controllerId = (await shard.findInRoom('W1N1', FIND_STRUCTURES))
			.find(s => s.kind === 'structure' && s.structureType === STRUCTURE_CONTROLLER)!.id;
		await operate(shard, PWR_OPERATE_CONTROLLER, level, controllerId, [3, 3]);
		const upgrade = code`
			${upgraders}.map(id => Game.getObjectById(id)).map(c => [c.store[RESOURCE_ENERGY], c.upgradeController(c.room.controller)])
		`;
		const before = await shard.runPlayer('p1', upgrade) as Array<[number, number]>;
		expect(before.map(([, rc]) => rc)).toEqual([OK, OK]);
		const after = await shard.runPlayer('p1', code`${upgraders}.map(id => Game.getObjectById(id).store[RESOURCE_ENERGY])`) as number[];
		return before.reduce((sum, [energy]) => sum + energy, 0) - after.reduce((sum, energy) => sum + energy, 0);
	},
};

describe('Power use costs', () => {
	for (const row of powerCostCases) {
		test(`${row.catalogId}:${row.key} a use in range costs its ops and cooldown`, async ({ shard }) => {
			shard.requires('powerCreeps');
			shard.requires('powerEffects');
			const { targetId, nearId, farId } = await placePowerUse(shard, row.power, row.level, row.target);

			const rcs = await shard.runPlayer('p1', code`
				const target = Game.getObjectById(${targetId});
				${[nearId, farId]}.map(id => id && Game.getObjectById(id).usePower(${row.power}, target))
			`);
			const after = await shard.runPlayer('p1', code`
				${[nearId, farId]}.map(id => {
					const pc = id && Game.getObjectById(id);
					return pc && { ops: pc.store[RESOURCE_OPS], cooldown: pc.powers[${row.power}].cooldown };
				})
			`);
			// A power without a cooldown reads 0: the getter floors it.
			expect({ rcs, after }).toEqual({
				rcs: [OK, farId ? ERR_NOT_IN_RANGE : null],
				after: [
					{ ops: OPS_STOCK - row.ops, cooldown: Math.max(0, row.cooldown - 1) },
					farId ? { ops: OPS_STOCK, cooldown: 0 } : null,
				],
			});
		});
	}
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
		const info = POWER_INFO[row.power];
		const cost = powerOps(row.power, row.powerLevel ?? 1);

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
			const blockers = shard.validationBlockers(row);
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
			const blockers = shard.validationBlockers(row);
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
