/**
 * 26.0 Object Shape Conformance
 *
 * Verifies the exact public data-property surface for each game object
 * type by walking the prototype chain inside player code. Properties
 * are included if they are getters or non-function values; methods and
 * underscore-prefixed internal fields are excluded.
 *
 * This captures the player-facing API surface as documented at
 * https://docs.screeps.com/api/ — not the engine's internal storage.
 *
 * Canonical shapes are pinned in src/matrices/object-shapes.ts:
 * - Running on vanilla verifies the constants haven't drifted.
 * - Running on xxscreeps catches any property surface divergence.
 */
import { describe, test, expect, code,
	MOVE, CARRY, WORK, CLAIM,
	STRUCTURE_ROAD, STRUCTURE_CONTAINER,
	RESOURCE_ENERGY, RESOURCE_SILICON,
	COLOR_RED, COLOR_BLUE,
} from '../../src/index.js';
import type { PlayerCode } from '../../src/index.js';
import { hasDocumentedAdapterLimitation } from '../../src/limitations.js';
import {
	CREEP_SHAPE, POWER_CREEP_SHAPE,
	BODY_PART_SHAPE, BODY_PART_BOOSTED_SHAPE,
	OWNER_SHAPE, ROOM_POSITION_SHAPE, SPAWNING_SHAPE,
	RESERVATION_SHAPE, SIGN_SHAPE,
	ROOM_SHAPE, CONTROLLER_SHAPE,
	GAME_SHAPE, GAME_CPU_SHAPE, GAME_MAP_SHAPE,
	GAME_SHARD_SHAPE, GAME_GCL_SHAPE, GAME_GPL_SHAPE,
	GAME_MARKET_SHAPE,
	SOURCE_SHAPE, MINERAL_SHAPE, CONSTRUCTION_SITE_SHAPE,
	FLAG_SHAPE, DROPPED_RESOURCE_SHAPE,
	TOMBSTONE_SHAPE, RUIN_SHAPE, NUKE_SHAPE,
	DEPOSIT_SHAPE,
	structureShapes, npcShapes,
} from '../../src/matrices/object-shapes.js';

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Self-contained player-code function that collects the public
 * data-property surface of a game object. Walks the prototype chain,
 * keeps getters and non-function data values, skips methods,
 * constructor, and underscore/hash-prefixed internal fields.
 */
const DATA_PROPS_FN = `function dataProps(obj) {
	var props = new Set();
	var proto = obj;
	while (proto && proto !== Object.prototype) {
		var keys = Object.getOwnPropertyNames(proto);
		for (var i = 0; i < keys.length; i++) {
			var key = keys[i];
			if (key === 'constructor') continue;
			if (key.charAt(0) === '_' || key.charAt(0) === '#') continue;
			var d = Object.getOwnPropertyDescriptor(proto, key);
			if (d.get) { props.add(key); continue; }
			if (typeof d.value === 'function') continue;
			props.add(key);
		}
		proto = Object.getPrototypeOf(proto);
	}
	return Array.from(props).sort();
}`;

/**
 * Tagged template that prepends the dataProps helper into player code,
 * then applies the same JSON.stringify interpolation as the `code` tag.
 */
function shapeCode(strings: TemplateStringsArray, ...values: unknown[]): PlayerCode {
	let body = strings[0];
	for (let i = 0; i < values.length; i++) {
		body += JSON.stringify(values[i]);
		body += strings[i + 1];
	}
	return `${DATA_PROPS_FN}\n${body}` as PlayerCode;
}

// =====================================================================
//  Conformance Tests
// =====================================================================

describe('26.0 Object Shape Conformance', () => {

	// ── 26.1 Creep Shape ─────────────────────────────────────────────

	test('SHAPE-CREEP-001 creep data-property surface matches canonical shape', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [MOVE, CARRY, WORK],
			store: { energy: 25 },
		});
		await shard.tick();

		const keys = await shard.runPlayer('p1', shapeCode`
			const c = Game.getObjectById(${id});
			c ? dataProps(c) : null
		`) as string[] | null;

		expect(keys).toEqual([...CREEP_SHAPE]);
	});

	test('SHAPE-CREEP-002 creep nested sub-objects match canonical shapes', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [MOVE, CARRY, WORK],
			store: { energy: 25 },
		});
		await shard.tick();

		const shape = await shard.runPlayer('p1', shapeCode`
			const c = Game.getObjectById(${id});
			c ? ({
				bodyPart: dataProps(c.body[0]),
				owner:    dataProps(c.owner),
				pos:      dataProps(c.pos),
			}) : null
		`) as { bodyPart: string[]; owner: string[]; pos: string[] } | null;

		expect(shape).not.toBeNull();
		expect(shape!.bodyPart).toEqual([...BODY_PART_SHAPE]);
		expect(shape!.owner).toEqual([...OWNER_SHAPE]);
		expect(shape!.pos).toEqual([...ROOM_POSITION_SHAPE]);
	});

	test('SHAPE-CREEP-003 unboosted body part has hits and type; boosted adds boost', async ({ shard }) => {
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [MOVE, CARRY, WORK],
			boosts: { 2: 'UH' },
		});
		await shard.tick();

		const shape = await shard.runPlayer('p1', shapeCode`
			const c = Game.getObjectById(${id});
			c ? ({
				unboosted: dataProps(c.body[0]),
				boosted:   dataProps(c.body[2]),
			}) : null
		`) as { unboosted: string[]; boosted: string[] } | null;

		expect(shape).not.toBeNull();
		expect(shape!.unboosted).toEqual([...BODY_PART_SHAPE]);
		expect(shape!.boosted).toEqual([...BODY_PART_BOOSTED_SHAPE]);
	});

	// ── 26.2 Power Creep Shape ───────────────────────────────────────

	test('SHAPE-POWERCREEP-001 power creep data-property surface matches canonical shape', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.ownedRoom('p1', 'W1N1', 8);
		const id = await shard.placePowerCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			name: 'shape_pc',
			powers: { 12: 1 },
		});
		await shard.tick();

		const keys = await shard.runPlayer('p1', shapeCode`
			const pc = Game.getObjectById(${id});
			pc ? dataProps(pc) : null
		`) as string[] | null;

		expect(keys).toEqual([...POWER_CREEP_SHAPE]);
	});

	// ── 26.3 Room & Controller Shape ─────────────────────────────────

	test('SHAPE-ROOM-001 room data-property surface matches canonical shape', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.tick();

		const keys = await shard.runPlayer('p1', shapeCode`
			const room = Game.rooms['W1N1'];
			room ? dataProps(room) : null
		`) as string[] | null;

		expect(keys).toEqual([...ROOM_SHAPE]);
	});

	test('SHAPE-CTRL-001 controller data-property surface matches canonical shape', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.tick();

		const keys = await shard.runPlayer('p1', shapeCode`
			const ctrl = Game.rooms['W1N1'].controller;
			ctrl ? dataProps(ctrl) : null
		`) as string[] | null;

		expect(keys).toEqual([...CONTROLLER_SHAPE]);
	});

	test('SHAPE-CTRL-002 controller.sign sub-object matches canonical shape', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const ctrlPos = await shard.getControllerPos('W1N1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [ctrlPos.x + 1, ctrlPos.y],
			owner: 'p1',
			body: [MOVE],
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			const c = Game.getObjectById(${creepId});
			const ctrl = Game.rooms['W1N1'].controller;
			c.signController(ctrl, 'shape test')
		`);
		await shard.tick();

		const keys = await shard.runPlayer('p1', shapeCode`
			const ctrl = Game.rooms['W1N1'].controller;
			ctrl && ctrl.sign ? dataProps(ctrl.sign) : null
		`) as string[] | null;

		if (keys) {
			expect(keys).toEqual([...SIGN_SHAPE]);
		}
	});

	test('SHAPE-CTRL-003 controller.reservation sub-object matches canonical shape', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1' },
			],
		});
		const ctrlPos = await shard.getControllerPos('W2N1');
		const creepId = await shard.placeCreep('W2N1', {
			pos: [ctrlPos.x + 1, ctrlPos.y],
			owner: 'p1',
			body: [CLAIM, MOVE],
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			const c = Game.getObjectById(${creepId});
			const ctrl = Game.rooms['W2N1'] && Game.rooms['W2N1'].controller;
			c && ctrl ? c.reserveController(ctrl) : -1
		`);
		await shard.tick();

		const keys = await shard.runPlayer('p1', shapeCode`
			const ctrl = Game.rooms['W2N1'] && Game.rooms['W2N1'].controller;
			ctrl && ctrl.reservation ? dataProps(ctrl.reservation) : null
		`) as string[] | null;

		if (keys) {
			expect(keys).toEqual([...RESERVATION_SHAPE]);
		}
	});

	// ── 26.4 Game Globals Shape ──────────────────────────────────────

	test('SHAPE-GAME-001 Game data-property surface matches canonical shape', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.tick();

		const keys = await shard.runPlayer('p1', shapeCode`
			dataProps(Game)
		`) as string[];

		expect(keys).toEqual([...GAME_SHAPE]);
	});

	test('SHAPE-GAME-002 Game.cpu matches canonical shape', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.tick();

		const keys = await shard.runPlayer('p1', shapeCode`
			dataProps(Game.cpu)
		`) as string[];

		expect(keys).toEqual([...GAME_CPU_SHAPE]);
	});

	test('SHAPE-GAME-003 Game.map matches canonical shape', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.tick();

		const keys = await shard.runPlayer('p1', shapeCode`
			dataProps(Game.map)
		`) as string[];

		expect(keys).toEqual([...GAME_MAP_SHAPE]);
	});

	test('SHAPE-GAME-004 Game.shard matches canonical shape', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.tick();

		const keys = await shard.runPlayer('p1', shapeCode`
			typeof Game.shard === 'object' && Game.shard
				? dataProps(Game.shard) : null
		`) as string[] | null;

		expect(keys).toEqual([...GAME_SHARD_SHAPE]);
	});

	test('SHAPE-GAME-005 Game.gcl matches canonical shape', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.tick();

		const keys = await shard.runPlayer('p1', shapeCode`
			typeof Game.gcl === 'object' && Game.gcl
				? dataProps(Game.gcl) : null
		`) as string[] | null;

		expect(keys).toEqual([...GAME_GCL_SHAPE]);
	});

	test('SHAPE-GAME-006 Game.gpl matches canonical shape', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.tick();

		const keys = await shard.runPlayer('p1', shapeCode`
			typeof Game.gpl === 'object' && Game.gpl
				? dataProps(Game.gpl) : null
		`) as string[] | null;

		expect(keys).toEqual([...GAME_GPL_SHAPE]);
	});

	test('SHAPE-GAME-007 Game.market matches canonical shape', async ({ shard }) => {
		shard.requires('market');
		await shard.ownedRoom('p1');
		await shard.tick();

		const keys = await shard.runPlayer('p1', shapeCode`
			Game.market ? dataProps(Game.market) : null
		`) as string[] | null;

		expect(keys).toEqual([...GAME_MARKET_SHAPE]);
	});

	// ── 26.5 Structure Shapes (matrix) ───────────────────────────────

	for (const entry of structureShapes) {
		test(`SHAPE-STRUCT-001:${entry.structureType} structure data-property surface matches canonical shape`, async ({ shard }) => {
			if (entry.cap) shard.requires(entry.cap);

			await shard.ownedRoom('p1', 'W1N1', entry.rcl);
			const id = await shard.placeStructure('W1N1', {
				pos: [25, 25],
				structureType: entry.structureType,
				...(entry.owned ? { owner: 'p1' } : {}),
				...(entry.extra ?? {}),
			});
			await shard.tick();

			const keys = await shard.runPlayer('p1', shapeCode`
				const s = Game.getObjectById(${id});
				s ? dataProps(s) : null
			`) as string[] | null;

			expect(keys).toEqual([...entry.shape]);
		});
	}

	test('SHAPE-STRUCT-002 spawn.spawning sub-object matches canonical shape', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [26, 25], structureType: 'spawn', owner: 'p1',
			store: { energy: 300 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep([MOVE], 'shape_test')
		`);
		expect(rc).toBe(0);

		await shard.tick();

		const keys = await shard.runPlayer('p1', shapeCode`
			const s = Game.getObjectById(${spawnId});
			s && s.spawning ? dataProps(s.spawning) : null
		`) as string[] | null;

		expect(keys).toEqual([...SPAWNING_SHAPE]);
	});

	// ── 26.6 NPC Structure Shapes ────────────────────────────────────

	for (const entry of npcShapes) {
		test(`${entry.catalogId} ${entry.objectType} data-property surface matches canonical shape`, async ({ shard }) => {
			if (entry.limitation) {
				const skip = hasDocumentedAdapterLimitation(
					entry.limitation as Parameters<typeof hasDocumentedAdapterLimitation>[0],
				);
				if (skip) return;
			}
			if (entry.cap) shard.requires(entry.cap);

			if (entry.objectType === 'portal') {
				await shard.createShard({
					players: ['p1'],
					rooms: [
						{ name: 'W1N1', rcl: 1, owner: 'p1' },
						{ name: 'W3N3' },
					],
				});
			} else {
				await shard.ownedRoom('p1');
			}

			const id = await shard.placeObject('W1N1', entry.objectType, entry.spec);
			await shard.tick();

			const keys = await shard.runPlayer('p1', shapeCode`
				const o = Game.getObjectById(${id});
				o ? dataProps(o) : null
			`) as string[] | null;

			expect(keys).toEqual([...entry.shape]);
		});
	}

	// ── 26.7 World Object Shapes ─────────────────────────────────────

	test('SHAPE-SOURCE-001 source data-property surface matches canonical shape', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeSource('W1N1', {
			pos: [10, 10],
			energy: 1500,
			energyCapacity: 3000,
		});
		await shard.tick();

		const keys = await shard.runPlayer('p1', shapeCode`
			const s = Game.getObjectById(${id});
			s ? dataProps(s) : null
		`) as string[] | null;

		expect(keys).toEqual([...SOURCE_SHAPE]);
	});

	test('SHAPE-MINERAL-001 mineral data-property surface matches canonical shape', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeMineral('W1N1', {
			pos: [40, 40],
			mineralType: 'H',
			mineralAmount: 50000,
		});
		await shard.tick();

		const keys = await shard.runPlayer('p1', shapeCode`
			const m = Game.getObjectById(${id});
			m ? dataProps(m) : null
		`) as string[] | null;

		expect(keys).toEqual([...MINERAL_SHAPE]);
	});

	test('SHAPE-DEPOSIT-001 deposit data-property surface matches canonical shape', async ({ shard }) => {
		shard.requires('deposit');
		await shard.ownedRoom('p1');
		const id = await shard.placeObject('W1N1', 'deposit', {
			pos: [25, 25],
			depositType: RESOURCE_SILICON,
		});
		await shard.tick();

		const keys = await shard.runPlayer('p1', shapeCode`
			const d = Game.getObjectById(${id});
			d ? dataProps(d) : null
		`) as string[] | null;

		expect(keys).toEqual([...DEPOSIT_SHAPE]);
	});

	test('SHAPE-SITE-001 constructionSite data-property surface matches canonical shape', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeSite('W1N1', {
			pos: [30, 30], owner: 'p1',
			structureType: STRUCTURE_ROAD,
		});
		await shard.tick();

		const keys = await shard.runPlayer('p1', shapeCode`
			const s = Game.getObjectById(${id});
			s ? dataProps(s) : null
		`) as string[] | null;

		expect(keys).toEqual([...CONSTRUCTION_SITE_SHAPE]);
	});

	test('SHAPE-FLAG-001 flag data-property surface matches canonical shape', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeFlag('W1N1', {
			pos: [20, 20], owner: 'p1',
			name: 'shape_flag',
			color: COLOR_RED,
			secondaryColor: COLOR_BLUE,
		});
		await shard.tick();

		const keys = await shard.runPlayer('p1', shapeCode`
			const f = Game.flags['shape_flag'];
			f ? dataProps(f) : null
		`) as string[] | null;

		expect(keys).toEqual([...FLAG_SHAPE]);
	});

	test('SHAPE-RESOURCE-001 droppedResource data-property surface matches canonical shape', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeDroppedResource('W1N1', {
			pos: [25, 25],
			resourceType: RESOURCE_ENERGY,
			amount: 100,
		});
		await shard.tick();

		const keys = await shard.runPlayer('p1', shapeCode`
			const r = Game.getObjectById(${id});
			r ? dataProps(r) : null
		`) as string[] | null;

		expect(keys).toEqual([...DROPPED_RESOURCE_SHAPE]);
	});

	test('SHAPE-TOMBSTONE-001 tombstone data-property surface matches canonical shape', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeTombstone('W1N1', {
			pos: [25, 25],
			creepName: 'shape_victim',
			store: { energy: 50 },
			ticksToDecay: 100,
		});
		await shard.tick();

		const keys = await shard.runPlayer('p1', shapeCode`
			const t = Game.getObjectById(${id});
			t ? dataProps(t) : null
		`) as string[] | null;

		expect(keys).toEqual([...TOMBSTONE_SHAPE]);
	});

	test('SHAPE-RUIN-001 ruin data-property surface matches canonical shape', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeRuin('W1N1', {
			pos: [25, 25],
			structureType: STRUCTURE_CONTAINER,
			store: { energy: 75 },
			ticksToDecay: 200,
		});
		await shard.tick();

		const keys = await shard.runPlayer('p1', shapeCode`
			const r = Game.getObjectById(${id});
			r ? dataProps(r) : null
		`) as string[] | null;

		expect(keys).toEqual([...RUIN_SHAPE]);
	});

	test('SHAPE-NUKE-001 in-flight nuke data-property surface matches canonical shape', async ({ shard }) => {
		shard.requires('nuke');
		await shard.ownedRoom('p1');
		const id = await shard.placeNuke('W1N1', {
			pos: [25, 25],
			launchRoomName: 'W5N5',
			timeToLand: 50000,
		});
		await shard.tick();

		const keys = await shard.runPlayer('p1', shapeCode`
			const n = Game.getObjectById(${id});
			n ? dataProps(n) : null
		`) as string[] | null;

		expect(keys).toEqual([...NUKE_SHAPE]);
	});
});
