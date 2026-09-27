import {
	describe, test, expect, code, body,
	OK, ERR_NOT_ENOUGH_ENERGY,
	WORK, CARRY, MOVE, BODYPART_COST,
	STRUCTURE_SPAWN, STRUCTURE_EXTENSION,
	CREEP_SPAWN_TIME, MAX_CREEP_SIZE,
	TOP, TOP_RIGHT, RIGHT, BOTTOM, LEFT,
	FIND_CREEPS, TERRAIN_WALL,
	SPAWN_ENERGY_CAPACITY,
} from '../../src/index.js';
import { spawnCreateValidationCases } from '../../src/matrices/spawn-create-validation.js';
import { staleReceiverCases } from '../../src/matrices/stale-receiver.js';

const staleSpawnCreepCase = staleReceiverCases.find(row => row.key === 'spawnCreep')!;

describe('StructureSpawn', () => {
	const workerBodyCost = BODYPART_COST[WORK] + BODYPART_COST[CARRY] + BODYPART_COST[MOVE];

	test('SPAWN-CREATE-004 spawnCreep succeeds when available energy exactly matches the summed BODYPART_COST', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: workerBodyCost },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep([WORK, CARRY, MOVE], 'Worker1')
		`);
		expect(rc).toBe(OK);
	});

	test('SPAWN-CREATE-004 spawnCreep fails when available energy is 1 below the summed BODYPART_COST', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: workerBodyCost - 1 },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep([WORK, CARRY, MOVE], 'Worker1')
		`);
		expect(rc).toBe(ERR_NOT_ENOUGH_ENERGY);
	});

	test('SPAWN-CREATE-015 without energyStructures, spawnCreep drains spawns nearest-first, then extensions nearest-first', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 7, owner: 'p1' }],
		});
		const place = (pos: [number, number], structureType: typeof STRUCTURE_SPAWN | typeof STRUCTURE_EXTENSION, energy: number) =>
			shard.placeStructure('W1N1', { pos, structureType, owner: 'p1', store: { energy } });
		const spawnId = await place([25, 25], STRUCTURE_SPAWN, 100);
		// The far spawn is drained before the adjacent extension: spawns go first.
		const farSpawnId = await place([32, 25], STRUCTURE_SPAWN, 100);
		const nearExtId = await place([25, 26], STRUCTURE_EXTENSION, 50);
		// 300 left afterward, so no spawn regenerates before the read.
		const farExtIds = [await place([25, 28], STRUCTURE_EXTENSION, 100),
			await place([25, 29], STRUCTURE_EXTENSION, 100),
			await place([25, 30], STRUCTURE_EXTENSION, 100)];
		await shard.tick();

		// [WORK, WORK, MOVE] costs 250: both spawns' 200, then the nearest extension's 50.
		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep([WORK, WORK, MOVE], 'DefaultDrain')
		`);
		expect(rc).toBe(OK);

		const spawnEnergy = async (id: string) => (await shard.expectStructure(id, STRUCTURE_SPAWN)).store.energy ?? 0;
		const extensionEnergy = async (id: string) => (await shard.expectStructure(id, STRUCTURE_EXTENSION)).store.energy ?? 0;
		expect(await Promise.all([spawnId, farSpawnId].map(spawnEnergy))).toEqual([0, 0]);
		expect(await Promise.all([nearExtId, ...farExtIds].map(extensionEnergy))).toEqual([0, 100, 100, 100]);
	});

	test('SPAWN-CREATE-005 spawnCreep draws energy only from the listed energyStructures', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		const ext1 = await shard.placeStructure('W1N1', {
			pos: [26, 25], structureType: STRUCTURE_EXTENSION, owner: 'p1',
			store: { energy: 50 },
		});
		const ext2 = await shard.placeStructure('W1N1', {
			pos: [27, 25], structureType: STRUCTURE_EXTENSION, owner: 'p1',
			store: { energy: 50 },
		});

		const rc = await shard.runPlayer('p1', code`
			const spawn = Game.getObjectById(${spawnId});
			const selected = Game.getObjectById(${ext1});
			spawn.spawnCreep([MOVE], 'SelectedOnly', {
				energyStructures: [selected],
			})
		`);
		expect(rc).toBe(OK);

		await shard.tick();

		const spawn = await shard.expectStructure(spawnId, STRUCTURE_SPAWN);
		const selected = await shard.expectStructure(ext1, STRUCTURE_EXTENSION);
		const other = await shard.expectStructure(ext2, STRUCTURE_EXTENSION);
		expect(spawn.store.energy).toBe(300);
		expect(selected.store.energy ?? 0).toBe(0);
		expect(other.store.energy ?? 0).toBe(50);
	});

	test('SPAWN-CREATE-006 spawnCreep draws energy from listed energyStructures in listed order', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		const ext1 = await shard.placeStructure('W1N1', {
			pos: [26, 25], structureType: STRUCTURE_EXTENSION, owner: 'p1',
			store: { energy: 50 },
		});
		const ext2 = await shard.placeStructure('W1N1', {
			pos: [27, 25], structureType: STRUCTURE_EXTENSION, owner: 'p1',
			store: { energy: 50 },
		});

		const rc = await shard.runPlayer('p1', code`
			const spawn = Game.getObjectById(${spawnId});
			const first = Game.getObjectById(${ext1});
			const third = Game.getObjectById(${ext2});
			spawn.spawnCreep([WORK], 'OrderedDrain', {
				energyStructures: [first, spawn, third],
			})
		`);
		expect(rc).toBe(OK);

		await shard.tick();

		const first = await shard.expectStructure(ext1, STRUCTURE_EXTENSION);
		const spawn = await shard.expectStructure(spawnId, STRUCTURE_SPAWN);
		const third = await shard.expectStructure(ext2, STRUCTURE_EXTENSION);
		expect(first.store.energy ?? 0).toBe(0);
		expect(spawn.store.energy).toBe(250);
		expect(third.store.energy ?? 0).toBe(50);
	});

	test('SPAWN-CREATE-010 spawnCreep(..., { dryRun: true }) runs the checks without consuming energy or creating a creep', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		// Full, so no regeneration hides a charge.
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: SPAWN_ENERGY_CAPACITY },
		});

		const rcs = await shard.runPlayer('p1', code`
			const spawn = Game.getObjectById(${spawnId});
			[
				spawn.spawnCreep([WORK, CARRY, MOVE], 'DryRunWorker', { dryRun: true }),
				spawn.spawnCreep(${body(4, WORK)}, 'DryRunTooCostly', { dryRun: true }),
			]
		`);
		expect(rcs).toEqual([OK, ERR_NOT_ENOUGH_ENERGY]);
		expect((await shard.expectStructure(spawnId, STRUCTURE_SPAWN)).store.energy).toBe(SPAWN_ENERGY_CAPACITY);
		expect(await shard.findInRoom('W1N1', FIND_CREEPS)).toEqual([]);
	});

	test('SPAWN-CREATE-013 spawnCreep deducts the body cost from the spawn and contributing extensions', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		// Spawn alone cannot fund a WORK part (100 energy) — extension must contribute.
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 49 },
		});
		const extId = await shard.placeStructure('W1N1', {
			pos: [26, 25], structureType: STRUCTURE_EXTENSION, owner: 'p1',
			store: { energy: 51 },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep([WORK], 'CostDrain')
		`);
		expect(rc).toBe(OK);

		// Body cost 100 drawn at intent resolution: extension → 0, spawn → 0.
		// End-of-tick spawn-tick handler then regens +1 into the spawn
		// (see @screeps/engine/src/processor/intents/spawns/tick.js:47).
		const spawn = await shard.expectStructure(spawnId, STRUCTURE_SPAWN);
		const ext = await shard.expectStructure(extId, STRUCTURE_EXTENSION);
		expect(ext.store.energy ?? 0).toBe(0);
		expect(spawn.store.energy ?? 0).toBe(1);
	});

	test('SPAWN-CREATE-011 spawnCreep(..., { memory }) seeds the spawned creep initial memory', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep([MOVE], 'MemTest', {
				memory: { role: 'scout', priority: 5 }
			})
		`);
		expect(rc).toBe(OK);

		// Advance past spawn time so creep fully exists.
		await shard.tick(CREEP_SPAWN_TIME);

		const mem = await shard.runPlayer('p1', code`
			Game.creeps['MemTest'].memory
		`);
		expect(mem).toEqual({ role: 'scout', priority: 5 });
	});

	// ── Spawning timing ─────────────────────────────────────────

	test('SPAWN-TIMING-001 spawning takes CREEP_SPAWN_TIME ticks per body part', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: SPAWN_ENERGY_CAPACITY },
		});
		const creepBody = [WORK, CARRY, MOVE];
		const needTime = CREEP_SPAWN_TIME * creepBody.length;

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep(${creepBody}, 'TimingTest')
		`);
		expect(rc).toBe(OK);
		expect((await shard.expectStructure(spawnId, STRUCTURE_SPAWN)).spawning?.needTime).toBe(needTime);

		// The spawn tick counts as the first; the creep is out after needTime.
		await shard.tick(needTime - 2);
		expect((await shard.expectStructure(spawnId, STRUCTURE_SPAWN)).spawning).not.toBeNull();
		await shard.tick();
		expect((await shard.expectStructure(spawnId, STRUCTURE_SPAWN)).spawning).toBeNull();
		const creep = (await shard.findInRoom('W1N1', FIND_CREEPS)).find(c => c.name === 'TimingTest');
		expect(creep?.spawning).toBe(false);
	});

	test('SPAWN-TIMING-003 default spawn direction priority: TOP first, then clockwise', async ({ shard }) => {
		shard.requires('terrain');
		await shard.ownedRoom('p1', 'W1N1', 2);

		// Wall TOP [25,24] so the spawn must pick the next default: TOP_RIGHT [26,24].
		const terrain = new Array<0 | 1 | 2>(2500).fill(0);
		terrain[24 * 50 + 25] = TERRAIN_WALL; // [25,24] = TOP
		await shard.setTerrain('W1N1', terrain);

		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep([MOVE], 'DirDefault')
		`);
		expect(rc).toBe(OK);
		await shard.tick(CREEP_SPAWN_TIME);

		const creeps = await shard.findInRoom('W1N1', FIND_CREEPS);
		const c = creeps.find(c => c.name === 'DirDefault');
		expect(c).toBeDefined();
		// TOP_RIGHT of [25,25] is [26,24].
		expect(c!.pos.x).toBe(26);
		expect(c!.pos.y).toBe(24);
	});

	test('SPAWN-TIMING-004 opts.directions selects exit tile from the provided order', async ({ shard }) => {
		shard.requires('terrain');
		await shard.ownedRoom('p1', 'W1N1', 2);

		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		await shard.tick();

		// Request BOTTOM as first direction — creep should exit to [25,26].
		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep([MOVE], 'DirCustom', {
				directions: [BOTTOM, LEFT, RIGHT]
			})
		`);
		expect(rc).toBe(OK);
		await shard.tick(CREEP_SPAWN_TIME);

		const creeps = await shard.findInRoom('W1N1', FIND_CREEPS);
		const c = creeps.find(c => c.name === 'DirCustom');
		expect(c).toBeDefined();
		// BOTTOM of [25,25] is [25,26].
		expect(c!.pos.x).toBe(25);
		expect(c!.pos.y).toBe(26);
	});

	test('SPAWN-TIMING-006 creep exits the spawn tile in the chosen direction on completion', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: SPAWN_ENERGY_CAPACITY },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep([MOVE], 'ExitCreep', { directions: [RIGHT] })
		`);
		expect(rc).toBe(OK);
		await shard.tick(CREEP_SPAWN_TIME - 1);

		const creep = (await shard.findInRoom('W1N1', FIND_CREEPS)).find(c => c.name === 'ExitCreep');
		expect(creep && { spawning: creep.spawning, x: creep.pos.x, y: creep.pos.y }).toEqual({ spawning: false, x: 26, y: 25 });
	});

	test(`${staleSpawnCreepCase.catalogId}:${staleSpawnCreepCase.label} stale cached StructureSpawn.spawnCreep() throws a runtime error`, async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const spawn = Game.getObjectById(${spawnId});
			globalThis.__screepsOkStaleSpawn = spawn;
			spawn.destroy()
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const err = await shard.expectRunPlayerError('p1', code`
			globalThis.__screepsOkStaleSpawn.spawnCreep([MOVE], 'StaleSpawnCreep')
		`, 'runtime');
		expect(err.errorKind).toBe('runtime');
	});

	for (const row of spawnCreateValidationCases) {
		test(`SPAWN-CREATE-014:${row.label} spawnCreep() validation returns the canonical code`, async ({ shard }) => {
			const blockers = shard.validationBlockers(row);
			const owner = blockers.has('not-owner') ? 'p2' : 'p1';
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [
					// A spawn in a room with no controller level is inactive.
					blockers.has('rcl') ? { name: 'W1N1' } : { name: 'W1N1', rcl: 2, owner },
					...(blockers.has('name-spawning') || blockers.has('name-taken') ? [{ name: 'W2N1', rcl: 1, owner: 'p1' }] : []),
				],
			});
			if (owner === 'p2') {
				await shard.placeCreep('W1N1', { pos: [20, 20], owner: 'p1', body: [MOVE] });
			}
			const spawnId = await shard.placeStructure('W1N1', {
				pos: [25, 25],
				structureType: STRUCTURE_SPAWN,
				owner,
				store: blockers.has('not-enough') && !blockers.has('busy') ? { energy: 0 } : { energy: 300 },
			});
			// The spawn holds plenty; the one structure the call lists is empty.
			const selectedId = blockers.has('not-enough-selected')
				? await shard.placeStructure('W1N1', {
					pos: [26, 25], structureType: STRUCTURE_EXTENSION, owner, store: { energy: 0 },
				})
				: null;
			// A name too long to spawn can still be placed, so it can also exist.
			const name = blockers.has('missing-name') ? undefined
				: blockers.has('invalid-name-or-options') ? 'x'.repeat(101) : 'NewCreep';
			if (blockers.has('name-exists')) {
				await shard.placeCreep('W1N1', { pos: [20, 21], owner: 'p1', body: [MOVE], name });
			}
			const otherSpawnId = blockers.has('name-spawning') || blockers.has('name-taken')
				? await shard.placeStructure('W2N1', {
					pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1', store: { energy: SPAWN_ENERGY_CAPACITY },
				})
				: null;
			if (blockers.has('name-spawning')) {
				await shard.tick();
				const otherRc = await shard.runPlayer('p1', code`
					Game.getObjectById(${otherSpawnId}).spawnCreep(${body(6, MOVE)}, 'NewCreep')
				`);
				expect(otherRc).toBe(OK);
			}
			if (blockers.has('busy')) {
				const busyRc = await shard.runPlayer(owner, code`
					Game.getObjectById(${spawnId}).spawnCreep([MOVE, MOVE, MOVE], 'BusySpawn')
				`);
				expect(busyRc).toBe(OK);
				await shard.tick();
			}
			if (blockers.has('rcl')) await shard.tick();

			const creepBody = blockers.has('invalid-body') ? []
				: blockers.has('oversized-body') ? body(MAX_CREEP_SIZE + 1, MOVE)
				: blockers.has('invalid-part') ? ['notapart']
				: blockers.has('not-enough') ? [WORK, WORK, WORK, WORK]
				: [MOVE];
			const directions = blockers.has('invalid-directions') ? [99] : null;
			// With name-taken the other spawn starts the name first, in the same tick.
			const result = await shard.runPlayer('p1', code`
				let opts = {};
				if (${directions}) opts.directions = ${directions};
				if (${selectedId}) opts.energyStructures = [Game.getObjectById(${selectedId})];
				if (${blockers.has('invalid-options')}) opts = 1;
				const taken = ${blockers.has('name-taken')} ? Game.getObjectById(${otherSpawnId}).spawnCreep([MOVE], ${name}) : null;
				[taken, Game.getObjectById(${spawnId}).spawnCreep(${creepBody}, ${name}, opts)]
			`);
			expect(result).toEqual([blockers.has('name-taken') ? OK : null, row.expectedRc]);
		});
	}
});
