import {
	describe, test, expect, code, body,
	OK, ATTACK, MOVE, RANGED_ATTACK, TOUGH,
	ENERGY_REGEN_TIME, SAFE_MODE_DURATION, FIND_CREEPS, STRUCTURE_KEEPER_LAIR,
	CONTROLLER_RESERVE,
	EFFECT_COLLAPSE_TIMER, INVADER_CORE_CONTROLLER_POWER,
	FIND_STRUCTURES, FIND_RUINS,
	STRUCTURE_CONTROLLER, STRUCTURE_POWER_BANK, STRUCTURE_INVADER_CORE, POWER_BANK_CAPACITY_MIN,
	PWR_OPERATE_CONTROLLER, RESOURCE_OPS, powerOps,
} from '../../src/index.js';
import { npcOwnershipCases } from '../../src/matrices/npc-ownership.js';
import type { ControllerSnapshot } from '../../src/index.js';
import type { ShardFixture } from '../../src/fixture.js';

describe('Keeper lair', () => {
	test('KEEPER-LAIR-001 keeper lair ticksToSpawn decreases each tick and clears when the keeper spawns', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});

		const lairId = await shard.placeObject('W1N1', 'keeperLair', {
			pos: [25, 25],
			ticksToSpawn: 3,
		});
		await shard.tick();

		// The keeper spawns during the tick that reads 1; a full-hits keeper
		// starts no new timer, so the next read has none.
		const readings: (number | null)[] = [];
		for (let i = 0; i < 3; i++) {
			readings.push(await shard.runPlayer('p1', code`
				Game.getObjectById(${lairId}).ticksToSpawn ?? null
			`) as number | null);
		}
		expect(readings).toEqual([2, 1, null]);
	});

	test('KEEPER-LAIR-002:keeperMissing a keeper lair with no keeper starts an ENERGY_REGEN_TIME spawn timer', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const lairId = await shard.placeObject('W1N1', 'keeperLair', { pos: [25, 25] });

		// The lair's first tick finds no keeper (keeper-lairs/tick.js:12-16).
		await shard.tick();
		expect(await shard.runPlayer('p1', code`Game.getObjectById(${lairId}).ticksToSpawn`)).toBe(ENERGY_REGEN_TIME - 1);
	});

	test('KEEPER-LAIR-002:keeperDamaged a keeper lair whose keeper is below full hits starts a new spawn timer', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const lairId = await shard.placeObject('W1N1', 'keeperLair', { pos: [25, 25], ticksToSpawn: 1 });
		await shard.tick();
		const keeper = (await shard.findInRoom('W1N1', FIND_CREEPS))[0];
		expect(keeper.pos).toMatchObject({ x: 25, y: 25 });

		// One ranged hit from out of melee reach leaves it below full hits.
		const archerId = await shard.placeCreep('W1N1', { pos: [25, 28], owner: 'p1', body: [...body(20, TOUGH), RANGED_ATTACK, MOVE] });
		const readings = [await shard.runPlayer('p1', code`[
			Game.getObjectById(${lairId}).ticksToSpawn ?? null,
			Game.getObjectById(${archerId}).rangedAttack(Game.getObjectById(${keeper.id})),
		]`)];
		for (let i = 0; i < 2; i++) {
			readings.push(await shard.runPlayer('p1', code`[Game.getObjectById(${lairId}).ticksToSpawn ?? null]`));
		}
		// The damage lands after the lair's tick, so the next tick's lair starts the timer.
		expect(readings).toEqual([[null, OK], [null], [ENERGY_REGEN_TIME - 1]]);
	});

	test('KEEPER-LAIR-003 keeper lair spawns a source keeper on its tile the tick the timer completes', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const lairId = await shard.placeObject('W1N1', 'keeperLair', { pos: [25, 25], ticksToSpawn: 2 });
		await shard.tick();

		const keeperOwner = npcOwnershipCases.find(row => row.structureType === STRUCTURE_KEEPER_LAIR)!.expectedUsername;
		const read = code`[
			Game.getObjectById(${lairId}).ticksToSpawn ?? null,
			Game.rooms.W1N1.find(FIND_HOSTILE_CREEPS).map(c => [c.pos.x, c.pos.y, c.owner.username]),
		]`;
		expect([await shard.runPlayer('p1', read), await shard.runPlayer('p1', read)])
			.toEqual([[1, []], [null, [[25, 25, keeperOwner]]]]);
	});
});

describe('Invader core', () => {
	test('INVADER-CORE-001 ticksToDeploy counts down', async ({ shard }) => {
		shard.requires('invaderCore');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});

		const coreId = await shard.placeObject('W1N1', 'invaderCore', {
			pos: [25, 25],
			level: 1,
			ticksToDeploy: 20,
		});
		await shard.tick();

		const ttd1 = await shard.runPlayer('p1', code`
			const core = Game.getObjectById(${coreId});
			core ? core.ticksToDeploy : null
		`) as number | null;

		const ttd2 = await shard.runPlayer('p1', code`
			const core = Game.getObjectById(${coreId});
			core ? core.ticksToDeploy : null
		`) as number | null;

		// Seeded 20 at placement; one tick has elapsed at the first read.
		expect([ttd1, ttd2]).toEqual([19, 18]);
	});

	test('INVADER-CORE-002 invader core exposes its level', async ({ shard }) => {
		shard.requires('invaderCore');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});

		const coreId = await shard.placeObject('W1N1', 'invaderCore', {
			pos: [25, 25],
			level: 3,
		});
		await shard.tick();

		const level = await shard.runPlayer('p1', code`
			const core = Game.getObjectById(${coreId});
			core ? core.level : null
		`) as number | null;
		expect(level).toBe(3);
	});

	test('INVADER-CORE-003 invader core spawns a creep when spawning completes', async ({ shard }) => {
		shard.requires('invaderCore');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});

		const coreId = await shard.placeObject('W1N1', 'invaderCore', {
			pos: [25, 25],
			level: 2,
			spawning: { name: 'defender1', body: [ATTACK, MOVE], needTime: 12, remainingTime: 6 },
		});
		await shard.tick();

		// Each read shows the tick before it runs: the core's spawning name, and the
		// defender once it is born beside the core.
		const readings = [];
		for (let i = 0; i < 6; i++) {
			readings.push(await shard.runPlayer('p1', code`
				const core = Game.getObjectById(${coreId});
				const creep = Game.rooms['W1N1'].find(FIND_HOSTILE_CREEPS).find(c => c.name === 'defender1' && !c.spawning);
				[core.spawning ? core.spawning.name : null, creep ? Math.max(Math.abs(creep.pos.x - 25), Math.abs(creep.pos.y - 25)) : null]
			`));
		}
		// Seeded 6 ticks out; born on the tick spawnTime - 1 (invader-core/tick.js:28-38).
		expect(readings).toEqual([...Array(5).fill(['defender1', null]), [null, 1]]);
	});

	// Per tick after a core seeded to collapse in `ticksToCollapse`: whether the
	// core stands, and the controller's owner, level, safe mode and power.
	async function collapseSeries(shard: ShardFixture, coreId: string, ticks: number) {
		const series = [];
		for (let i = 0; i < ticks; i++) {
			await shard.tick();
			const controller = (await shard.findInRoom('W1N1', FIND_STRUCTURES))
				.find((s): s is ControllerSnapshot => s.structureType === STRUCTURE_CONTROLLER)!;
			series.push({
				core: await shard.getObject(coreId) !== null,
				owner: controller.owner ?? null,
				level: controller.level,
				progress: controller.progress,
				safeMode: controller.safeMode,
				isPowerEnabled: controller.isPowerEnabled,
			});
		}
		return series;
	}
	const ticksToCollapse = 6;

	test('INVADER-CORE-004:controller invader core collapse timer clears the room controller the tick it expires', async ({ shard }) => {
		shard.requires('invaderCore');
		const progress = 100;
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1', progress, safeMode: SAFE_MODE_DURATION, powerEnabled: true }],
		});
		const coreId = await shard.placeObject('W1N1', 'invaderCore', { pos: [25, 25], level: 0, ticksToCollapse });

		// A level 0 controller reads no progress.
		const series = await collapseSeries(shard, coreId, ticksToCollapse + 1);
		expect(series.map(row => [row.owner, row.level, row.progress, row.isPowerEnabled])).toEqual([
			...Array(ticksToCollapse).fill(['p1', 2, progress, true]),
			[null, 0, null, false],
		]);
		expect(series.map(row => row.safeMode)).toEqual([
			...Array.from({ length: ticksToCollapse }, (_, i) => SAFE_MODE_DURATION - 1 - i),
			null,
		]);
	});

	test('INVADER-CORE-004:controllerEffects invader core collapse clears the controller\'s power effects', async ({ shard }) => {
		shard.requires('invaderCore');
		shard.requires('powerCreeps');
		shard.requires('powerEffects');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1', powerEnabled: true }],
		});
		const creepId = await shard.placePowerCreep('W1N1', {
			pos: [3, 3], owner: 'p1', powers: { [PWR_OPERATE_CONTROLLER]: 1 }, store: { [RESOURCE_OPS]: powerOps(PWR_OPERATE_CONTROLLER, 1) },
		});
		await shard.placeObject('W1N1', 'invaderCore', { pos: [25, 25], level: 0, ticksToCollapse });

		// The use is the core's first tick; each read is the next tick's start.
		expect(await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).usePower(PWR_OPERATE_CONTROLLER, Game.rooms.W1N1.controller)
		`)).toBe(OK);
		const readings = [];
		for (let i = 0; i <= ticksToCollapse; i++) {
			readings.push(await shard.runPlayer('p1', code`(Game.rooms.W1N1.controller.effects || []).map(e => e.power)`));
		}
		expect(readings).toEqual([...Array(ticksToCollapse).fill([PWR_OPERATE_CONTROLLER]), []]);
	});

	test('INVADER-CORE-005 expired collapse timer removes the invader core without a ruin', async ({ shard }) => {
		shard.requires('invaderCore');
		await shard.ownedRoom('p1');
		const coreId = await shard.placeObject('W1N1', 'invaderCore', { pos: [30, 30], level: 0, ticksToCollapse });

		const series = await collapseSeries(shard, coreId, ticksToCollapse + 1);
		expect(series.map(row => row.core)).toEqual([...Array(ticksToCollapse).fill(true), false]);
		expect(await shard.findInRoom('W1N1', FIND_RUINS)).toEqual([]);
	});

	test('INVADER-CORE-006 a core reserving a neutral controller starts at exactly its reserve power', async ({ shard }) => {
		// Engine invader-core/reserveController.js:22-37 starts a fresh
		// reservation at `gameTime + 1` and then adds
		// INVADER_CORE_CONTROLLER_POWER * CONTROLLER_RESERVE; the core
		// (stronghold.js handleController) renews every tick after that.
		shard.requires('invaderCore');
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1' },
			],
		});
		await shard.placeObject('W2N1', 'invaderCore', {
			pos: [25, 25],
			level: 0,
		});
		// A p1 creep gives the player vision of the room.
		await shard.placeCreep('W2N1', {
			pos: [10, 10],
			owner: 'p1',
			body: [MOVE],
		});

		// The first tick a reservation is visible follows the fresh reserve.
		const readings: number[] = [];
		for (let i = 0; i < 6 && readings.length < 2; i++) {
			const ticksToEnd = await shard.runPlayer('p1', code`
				const reservation = Game.rooms['W2N1'].controller.reservation;
				reservation ? reservation.ticksToEnd : null
			`) as number | null;
			if (ticksToEnd !== null) readings.push(ticksToEnd);
		}
		const power = INVADER_CORE_CONTROLLER_POWER * CONTROLLER_RESERVE;
		// Each renewal credits `power` against one tick of decay.
		expect(readings).toEqual([power, power + power - 1]);
	});
});

describe('NPC ownership', () => {
	for (const { structureType, capability, expectedMy, expectedUsername } of npcOwnershipCases) {
		test(`NPC-OWNERSHIP-001:${structureType} a ${structureType} is not my, and ${expectedUsername} owns it`, async ({ shard }) => {
			if (capability) shard.requires(capability);
			await shard.ownedRoom('p1');
			const pos: [number, number] = [25, 25];
			const id = structureType === STRUCTURE_POWER_BANK ? await shard.placeObject('W1N1', structureType, { pos, power: POWER_BANK_CAPACITY_MIN })
				: structureType === STRUCTURE_INVADER_CORE ? await shard.placeObject('W1N1', structureType, { pos, level: 1 })
				: await shard.placeObject('W1N1', structureType, { pos });
			await shard.tick();

			expect(await shard.runPlayer('p1', code`
				const s = Game.getObjectById(${id});
				[s.my, s.owner && s.owner.username]
			`)).toEqual([expectedMy, expectedUsername]);
		});
	}

});
