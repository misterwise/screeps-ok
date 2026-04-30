import { describe, test, expect, code,
	OK, ERR_NOT_ENOUGH_RESOURCES, ERR_TIRED, ERR_NOT_IN_RANGE,
	MOVE, TOUGH, CLAIM, body,
	STRUCTURE_NUKER, STRUCTURE_RAMPART, STRUCTURE_SPAWN, STRUCTURE_ROAD, STRUCTURE_WALL,
	NUKER_ENERGY_CAPACITY, NUKER_GHODIUM_CAPACITY,
	NUKE_LAND_TIME, NUKE_DAMAGE, NUKE_RANGE, NUKER_COOLDOWN,
	CONTROLLER_NUKE_BLOCKED_UPGRADE,
	BODYPART_HITS,
	FIND_TOMBSTONES, FIND_RUINS, FIND_DROPPED_RESOURCES, FIND_CONSTRUCTION_SITES,
	FIND_SOURCES, FIND_MINERALS,
	RESOURCE_ENERGY, RESOURCE_GHODIUM, RESOURCE_SILICON,
} from '../../src/index.js';
import { nukeLaunchValidationCases } from '../../src/matrices/nuke-launch-validation.js';
import { nukerPropCases } from '../../src/matrices/nuker-props.js';
import { nukeImpactObjectCases } from '../../src/matrices/nuke-impact-objects.js';

// Section 7.13/7.14 — Nuker launch and Nuke impact behaviors.
//
// All tests in this file require the `nuke` capability. xxscreeps adapter has
// `nuke: false` and skips the entire suite.
//
// Engine references:
//   Launch:    @screeps/engine/src/game/structures.js:1356 (StructureNuker.launchNuke)
//              @screeps/engine/dist/processor/intents/nukers/launch-nuke.js
//   Impact:    @screeps/engine/dist/processor/intents/nukes/tick.js
//              @screeps/engine/src/processor/intents/_damage.js (rampart absorption)

function nukerStore(kind: 'full' | 'empty' | 'energyOnly' | 'ghodiumOnly'): Record<string, number> {
	switch (kind) {
		case 'full':
			return { energy: NUKER_ENERGY_CAPACITY, [RESOURCE_GHODIUM]: NUKER_GHODIUM_CAPACITY };
		case 'energyOnly':
			return { energy: NUKER_ENERGY_CAPACITY };
		case 'ghodiumOnly':
			return { [RESOURCE_GHODIUM]: NUKER_GHODIUM_CAPACITY };
		case 'empty':
			return {};
	}
}

describe('Nuke launch — section 7.13', () => {
	test('NUKE-LAUNCH-001 launch requires NUKER_ENERGY_CAPACITY energy and NUKER_GHODIUM_CAPACITY ghodium', async ({ shard }) => {
		shard.requires('nuke');
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 8, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const nukerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_NUKER, owner: 'p1',
			store: { energy: NUKER_ENERGY_CAPACITY, G: NUKER_GHODIUM_CAPACITY },
		});
		await shard.tick();

		// Verify the launch succeeds with full stocks.
		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${nukerId}).launchNuke(new RoomPosition(25, 25, 'W2N1'))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		// After launch, both energy and ghodium are consumed in full. Some adapters
		// drop zeroed entries from the store map entirely; treat undefined as 0.
		const nuker = await shard.expectStructure(nukerId, STRUCTURE_NUKER);
		expect(nuker.store.energy ?? 0).toBe(0);
		expect(nuker.store.G ?? 0).toBe(0);
	});

	test('NUKE-LAUNCH-002 nuker cooldown is set after launch', async ({ shard }) => {
		shard.requires('nuke');
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 8, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const nukerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_NUKER, owner: 'p1',
			store: { energy: NUKER_ENERGY_CAPACITY, G: NUKER_GHODIUM_CAPACITY },
		});
		await shard.tick();

		// Cooldown is 0 before launch.
		const before = await shard.runPlayer('p1', code`
			Game.getObjectById(${nukerId}).cooldown
		`);
		expect(before).toBe(0);

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${nukerId}).launchNuke(new RoomPosition(25, 25, 'W2N1'))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		// After launch, cooldown is large (close to NUKER_COOLDOWN — exact value
		// minus a few ticks for the launch processing). Just verify it is positive
		// and at least an order of magnitude larger than zero.
		const after = await shard.runPlayer('p1', code`
			Game.getObjectById(${nukerId}).cooldown
		`) as number;
		expect(after).toBeGreaterThan(1000);
	});

	test('NUKE-LAUNCH-003 launching to a room within NUKE_RANGE returns OK', async ({ shard }) => {
		shard.requires('nuke');
		// W1N1 → W2N1 = distance 1 (well within NUKE_RANGE = 10).
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 8, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const nukerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_NUKER, owner: 'p1',
			store: { energy: NUKER_ENERGY_CAPACITY, G: NUKER_GHODIUM_CAPACITY },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${nukerId}).launchNuke(new RoomPosition(25, 25, 'W2N1'))
		`);
		expect(rc).toBe(OK);
	});

	test('NUKE-LAUNCH-004 a successful launch creates an in-flight Nuke object in the target room', async ({ shard }) => {
		// Companion to NUKE-FLIGHT-001 (section 18.3); kept here so the launch
		// catalog has its own coverage. Verifies the Nuke object is observable.
		shard.requires('nuke');
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 8, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const nukerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_NUKER, owner: 'p1',
			store: { energy: NUKER_ENERGY_CAPACITY, G: NUKER_GHODIUM_CAPACITY },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${nukerId}).launchNuke(new RoomPosition(15, 20, 'W2N1'))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		// Read from p2 (who owns the target room).
		const nuke = await shard.runPlayer('p2', code`
			const nukes = Game.rooms['W2N1'].find(FIND_NUKES);
			nukes.length > 0 ? { x: nukes[0].pos.x, y: nukes[0].pos.y, room: nukes[0].pos.roomName, ttl: nukes[0].timeToLand } : null
		`) as { x: number; y: number; room: string; ttl: number } | null;
		expect(nuke).not.toBeNull();
		expect(nuke!.x).toBe(15);
		expect(nuke!.y).toBe(20);
		expect(nuke!.room).toBe('W2N1');
		expect(nuke!.ttl).toBeGreaterThan(0);
		expect(nuke!.ttl).toBeLessThanOrEqual(NUKE_LAND_TIME);
	});

	test('NUKE-LAUNCH-005 launchNuke returns ERR_NOT_ENOUGH_RESOURCES when energy or ghodium is insufficient', async ({ shard }) => {
		shard.requires('nuke');
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 8, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		// Nuker with no resources.
		const emptyId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_NUKER, owner: 'p1',
			store: {},
		});
		// Nuker with full energy but no ghodium.
		const noGId = await shard.placeStructure('W1N1', {
			pos: [27, 25], structureType: STRUCTURE_NUKER, owner: 'p1',
			store: { energy: NUKER_ENERGY_CAPACITY },
		});
		// Nuker with full ghodium but no energy.
		const noEId = await shard.placeStructure('W1N1', {
			pos: [29, 25], structureType: STRUCTURE_NUKER, owner: 'p1',
			store: { G: NUKER_GHODIUM_CAPACITY },
		});
		await shard.tick();

		const r1 = await shard.runPlayer('p1', code`
			Game.getObjectById(${emptyId}).launchNuke(new RoomPosition(25, 25, 'W2N1'))
		`);
		expect(r1).toBe(ERR_NOT_ENOUGH_RESOURCES);

		const r2 = await shard.runPlayer('p1', code`
			Game.getObjectById(${noGId}).launchNuke(new RoomPosition(25, 25, 'W2N1'))
		`);
		expect(r2).toBe(ERR_NOT_ENOUGH_RESOURCES);

		const r3 = await shard.runPlayer('p1', code`
			Game.getObjectById(${noEId}).launchNuke(new RoomPosition(25, 25, 'W2N1'))
		`);
		expect(r3).toBe(ERR_NOT_ENOUGH_RESOURCES);
	});

	test('NUKE-LAUNCH-006 launchNuke returns ERR_TIRED when the nuker is on cooldown', async ({ shard }) => {
		shard.requires('nuke');
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 8, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const nukerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_NUKER, owner: 'p1',
			store: { energy: NUKER_ENERGY_CAPACITY, G: NUKER_GHODIUM_CAPACITY },
		});
		await shard.tick();

		const r1 = await shard.runPlayer('p1', code`
			Game.getObjectById(${nukerId}).launchNuke(new RoomPosition(25, 25, 'W2N1'))
		`);
		expect(r1).toBe(OK);
		await shard.tick();

		// Refill stores so we can isolate ERR_TIRED from ERR_NOT_ENOUGH_RESOURCES.
		// We can't directly mutate stores from player code; instead place a new
		// nuker and run launch on the original to verify the cooldown gate fires.
		const r2 = await shard.runPlayer('p1', code`
			Game.getObjectById(${nukerId}).launchNuke(new RoomPosition(25, 25, 'W2N1'))
		`);
		expect(r2).toBe(ERR_TIRED);
	});

	test('NUKE-LAUNCH-007 launchNuke returns ERR_NOT_IN_RANGE when target room is beyond NUKE_RANGE', async ({ shard }) => {
		// Engine: @screeps/engine/src/game/structures.js:1379-1381 — `if(Math.abs(tx-x) > C.NUKE_RANGE
		// || Math.abs(ty-y) > C.NUKE_RANGE) return C.ERR_NOT_IN_RANGE;`. The catalog
		// previously claimed ERR_INVALID_TARGET; this test pins the actual return code.
		shard.requires('nuke');
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 8, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const nukerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_NUKER, owner: 'p1',
			store: { energy: NUKER_ENERGY_CAPACITY, G: NUKER_GHODIUM_CAPACITY },
		});
		await shard.tick();

		// W1N1 → W12N1: 11 rooms east-west delta, > NUKE_RANGE (10). The target
		// room name does not need to exist in the shard for the range check.
		void NUKE_RANGE; // referenced for clarity
		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${nukerId}).launchNuke(new RoomPosition(25, 25, 'W12N1'))
		`);
		expect(rc).toBe(ERR_NOT_IN_RANGE);
	});

	for (const row of nukeLaunchValidationCases) {
		test(`NUKE-LAUNCH-008:${row.label} launchNuke validation returns the canonical code`, async ({ shard }) => {
			shard.requires(row.capability);
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [
					{ name: 'W1N1', rcl: row.roomRcl, owner: 'p1' },
					{ name: 'W2N1', rcl: 1, owner: 'p2' },
				],
			});
			const nukerId = await shard.placeStructure('W1N1', {
				pos: [25, 25],
				structureType: STRUCTURE_NUKER,
				owner: 'p1',
				store: nukerStore(row.store),
				...(row.cooldown !== undefined ? { cooldown: row.cooldown } : {}),
			});
			if (row.caller === 'other') {
				await shard.placeCreep('W1N1', {
					pos: [24, 25],
					owner: 'p2',
					body: [MOVE],
				});
			}
			await shard.tick();

			const caller = row.caller === 'owner' ? 'p1' : 'p2';
			const rc = row.arg === 'plainObject'
				? await shard.runPlayer(caller, code`
					Game.getObjectById(${nukerId}).launchNuke({ x: 25, y: 25, roomName: ${row.targetRoomName} })
				`)
				: await shard.runPlayer(caller, code`
					Game.getObjectById(${nukerId}).launchNuke(new RoomPosition(25, 25, ${row.targetRoomName}))
				`);
			expect(rc).toBe(row.expectedRc);
		});
	}

	test('NUKE-LAUNCH-009 launchNuke can target a position in the nuker\'s own room', async ({ shard }) => {
		shard.requires('nuke');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});
		const nukerId = await shard.placeStructure('W1N1', {
			pos: [25, 25],
			structureType: STRUCTURE_NUKER,
			owner: 'p1',
			store: nukerStore('full'),
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${nukerId}).launchNuke(new RoomPosition(20, 20, 'W1N1'))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const nukeInfo = await shard.runPlayer('p1', code`
			const nukes = Game.rooms['W1N1'].find(FIND_NUKES);
			nukes.length ? { x: nukes[0].pos.x, y: nukes[0].pos.y, roomName: nukes[0].pos.roomName } : null
		`) as { x: number; y: number; roomName: string } | null;
		expect(nukeInfo).toEqual({ x: 20, y: 20, roomName: 'W1N1' });
	});

	test('NUKE-LAUNCH-010 launchNuke can target an in-range room not visible to the launcher', async ({ shard }) => {
		shard.requires('nuke');
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 8, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const nukerId = await shard.placeStructure('W1N1', {
			pos: [25, 25],
			structureType: STRUCTURE_NUKER,
			owner: 'p1',
			store: nukerStore('full'),
		});
		await shard.tick();

		const launcherSeesTargetBefore = await shard.runPlayer('p1', code`
			!!Game.rooms['W2N1']
		`);
		expect(launcherSeesTargetBefore).toBe(false);

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${nukerId}).launchNuke(new RoomPosition(25, 25, 'W2N1'))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const targetOwnerNukeCount = await shard.runPlayer('p2', code`
			Game.rooms['W2N1'].find(FIND_NUKES).length
		`);
		expect(targetOwnerNukeCount).toBe(1);
		const launcherSeesTargetAfter = await shard.runPlayer('p1', code`
			!!Game.rooms['W2N1']
		`);
		expect(launcherSeesTargetAfter).toBe(false);
	});

	test('NUKE-LAUNCH-011 launchNuke queues an intent without same-tick store, cooldown, or nuke visibility changes', async ({ shard }) => {
		shard.requires('nuke');
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 8, owner: 'p1' },
				{ name: 'W2N1', rcl: 8, owner: 'p1' },
			],
		});
		const nukerId = await shard.placeStructure('W1N1', {
			pos: [25, 25],
			structureType: STRUCTURE_NUKER,
			owner: 'p1',
			store: nukerStore('full'),
		});
		await shard.tick();

		const sameTick = await shard.runPlayer('p1', code`
			const nuker = Game.getObjectById(${nukerId});
			const rc = nuker.launchNuke(new RoomPosition(25, 25, 'W2N1'));
			({
				rc,
				energy: nuker.energy,
				ghodium: nuker.ghodium,
				cooldown: nuker.cooldown,
				targetNukes: Game.rooms['W2N1'].find(FIND_NUKES).length,
			})
		`) as { rc: number; energy: number; ghodium: number; cooldown: number; targetNukes: number };
		expect(sameTick).toEqual({
			rc: OK,
			energy: NUKER_ENERGY_CAPACITY,
			ghodium: NUKER_GHODIUM_CAPACITY,
			cooldown: 0,
			targetNukes: 0,
		});
	});

	test('NUKE-LAUNCH-012 first player tick after a processed launch shows NUKER_COOLDOWN - 1', async ({ shard }) => {
		shard.requires('nuke');
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 8, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const nukerId = await shard.placeStructure('W1N1', {
			pos: [25, 25],
			structureType: STRUCTURE_NUKER,
			owner: 'p1',
			store: nukerStore('full'),
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${nukerId}).launchNuke(new RoomPosition(25, 25, 'W2N1'))
		`);
		expect(rc).toBe(OK);

		const cooldown = await shard.runPlayer('p1', code`
			Game.getObjectById(${nukerId}).cooldown
		`);
		expect(cooldown).toBe(NUKER_COOLDOWN - 1);
	});

	test('NUKE-LAUNCH-013 nuker cooldown decreases by exactly 1 on subsequent ticks', async ({ shard }) => {
		shard.requires('nuke');
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 8, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const nukerId = await shard.placeStructure('W1N1', {
			pos: [25, 25],
			structureType: STRUCTURE_NUKER,
			owner: 'p1',
			store: nukerStore('full'),
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${nukerId}).launchNuke(new RoomPosition(25, 25, 'W2N1'))
		`);
		expect(rc).toBe(OK);

		const cooldown1 = await shard.runPlayer('p1', code`
			Game.getObjectById(${nukerId}).cooldown
		`) as number;
		const cooldown2 = await shard.runPlayer('p1', code`
			Game.getObjectById(${nukerId}).cooldown
		`) as number;
		const cooldown3 = await shard.runPlayer('p1', code`
			Game.getObjectById(${nukerId}).cooldown
		`) as number;
		expect(cooldown2).toBe(cooldown1 - 1);
		expect(cooldown3).toBe(cooldown2 - 1);

		const shortCooldownId = await shard.placeStructure('W1N1', {
			pos: [27, 25],
			structureType: STRUCTURE_NUKER,
			owner: 'p1',
			store: nukerStore('full'),
			cooldown: 2,
		});
		const short1 = await shard.runPlayer('p1', code`
			Game.getObjectById(${shortCooldownId}).cooldown
		`) as number;
		const short2 = await shard.runPlayer('p1', code`
			Game.getObjectById(${shortCooldownId}).cooldown
		`) as number;
		const short3 = await shard.runPlayer('p1', code`
			Game.getObjectById(${shortCooldownId}).cooldown
		`) as number;
		expect(short2).toBe(Math.max(0, short1 - 1));
		expect(short3).toBe(0);
	});

	for (const row of nukerPropCases) {
		test(`NUKER-PROPS-001:${row.label} StructureNuker legacy property mirrors store or capacity`, async ({ shard }) => {
			shard.requires('nuke');
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
			});
			const nukerId = await shard.placeStructure('W1N1', {
				pos: [25, 25],
				structureType: STRUCTURE_NUKER,
				owner: 'p1',
				store: { energy: 12_345, [RESOURCE_GHODIUM]: 678 },
			});
			await shard.tick();

			const value = await shard.runPlayer('p1', code`
				Game.getObjectById(${nukerId})[${row.property}]
			`);
			expect(value).toBe(row.expected);
		});
	}
});

describe('Nuke impact — section 7.14', () => {
	test('NUKE-IMPACT-001 a nuke lands at NUKE_LAND_TIME ticks after launch', async ({ shard }) => {
		// Verifies the launch path's timeToLand is exactly NUKE_LAND_TIME — confirming
		// the catalog timing constant. We don't tick out the full 50K; we read the
		// post-launch timeToLand and assert it equals NUKE_LAND_TIME (or NUKE_LAND_TIME-1
		// if the adapter has already advanced one tick).
		shard.requires('nuke');
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 8, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const nukerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_NUKER, owner: 'p1',
			store: { energy: NUKER_ENERGY_CAPACITY, G: NUKER_GHODIUM_CAPACITY },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${nukerId}).launchNuke(new RoomPosition(25, 25, 'W2N1'))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const ttl = await shard.runPlayer('p2', code`
			const nukes = Game.rooms['W2N1'].find(FIND_NUKES);
			nukes[0] ? nukes[0].timeToLand : null
		`) as number | null;
		expect(ttl).not.toBeNull();
		// Allow for a small adapter-side tick delta but pin to within 5 ticks of the constant.
		expect(ttl!).toBeLessThanOrEqual(NUKE_LAND_TIME);
		expect(ttl!).toBeGreaterThanOrEqual(NUKE_LAND_TIME - 5);
	});

	test('NUKE-IMPACT-002 damage at ground zero (radius 0) equals NUKE_DAMAGE[0]', async ({ shard }) => {
		// Engine: @screeps/engine/dist/processor/intents/nukes/tick.js:43-44 —
		// `range == 0 ? C.NUKE_DAMAGE[0] : C.NUKE_DAMAGE[2]`. The center tile takes
		// NUKE_DAMAGE[0] (10,000,000); all other tiles in the 5x5 area take NUKE_DAMAGE[2] (5M).
		shard.requires('nuke');
		await shard.ownedRoom('p1', 'W1N1', 8);

		// A high-hits rampart absorbs the full center damage so we can read it directly.
		const centerHits = NUKE_DAMAGE[0] + 5_000_000;
		const rampartId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_RAMPART, owner: 'p1',
			hits: centerHits,
		});
		await shard.placeNuke('W1N1', {
			pos: [25, 25], launchRoomName: 'W1N1', timeToLand: 1,
		});
		await shard.tick(2);

		const rampart = await shard.expectStructure(rampartId, STRUCTURE_RAMPART);
		expect(centerHits - rampart.hits).toBe(NUKE_DAMAGE[0]);
	});

	test('NUKE-IMPACT-003 damage in radius 1–2 equals NUKE_DAMAGE[2]', async ({ shard }) => {
		// Engine: ranges 1 and 2 share the falloff value NUKE_DAMAGE[2] (5,000,000).
		// Verify this for both a radius-1 tile and a radius-2 tile.
		shard.requires('nuke');
		await shard.ownedRoom('p1', 'W1N1', 8);

		const r1Hits = NUKE_DAMAGE[2] + 1_000_000;
		const r2Hits = NUKE_DAMAGE[2] + 1_000_000;
		const r1Id = await shard.placeStructure('W1N1', {
			pos: [26, 25], structureType: STRUCTURE_RAMPART, owner: 'p1',
			hits: r1Hits,
		});
		const r2Id = await shard.placeStructure('W1N1', {
			pos: [27, 25], structureType: STRUCTURE_RAMPART, owner: 'p1',
			hits: r2Hits,
		});
		await shard.placeNuke('W1N1', {
			pos: [25, 25], launchRoomName: 'W1N1', timeToLand: 1,
		});
		await shard.tick(2);

		const r1 = await shard.expectStructure(r1Id, STRUCTURE_RAMPART);
		expect(r1Hits - r1.hits).toBe(NUKE_DAMAGE[2]);

		const r2 = await shard.expectStructure(r2Id, STRUCTURE_RAMPART);
		expect(r2Hits - r2.hits).toBe(NUKE_DAMAGE[2]);
	});

	// Rampart absorbing nuke damage on behalf of structures underneath is the
	// same observable as rampart damage absorption in section 12.1 — see that
	// test and the catalog coverage note for the merge rationale. Not
	// duplicated here.

	test('NUKE-IMPACT-005 ramparts do not protect creeps from nuke damage', async ({ shard }) => {
		// Engine: @screeps/engine/dist/processor/intents/nukes/tick.js:18-24 —
		// every creep in the room is killed via _die(target, 0, true, scope, EVENT_ATTACK_TYPE_NUKE),
		// regardless of whether a rampart shares its tile. This loop runs *before*
		// the per-tile damage loop for structures, and creeps are not considered
		// for the rampart-absorb branch in _damage.js.
		shard.requires('nuke');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});
		// Place rampart and creep on the same tile, far from ground zero so the
		// outcome is not influenced by direct rampart absorption.
		await shard.placeStructure('W1N1', {
			pos: [10, 10], structureType: STRUCTURE_RAMPART, owner: 'p1',
			hits: 50_000_000, // far more than NUKE_DAMAGE[0]
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [10, 10], owner: 'p1',
			body: [...body(5, TOUGH), MOVE],
		});
		// Land a nuke at ground zero.
		await shard.placeNuke('W1N1', {
			pos: [25, 25], launchRoomName: 'W1N1', timeToLand: 1,
		});
		await shard.tick(2);

		// Creep is dead even though a rampart shares its tile.
		const obj = await shard.getObject(creepId);
		expect(obj).toBeNull();
	});

	test('NUKE-IMPACT-006 dropped resources, sites, tombstones, and ruins in the room are removed', async ({ shard }) => {
		// Engine: @screeps/engine/dist/processor/intents/nukes/tick.js:28-31 — the
		// per-room cleanup loop removes constructionSite, energy, tombstone, and ruin
		// objects across the entire room (not just the blast area).
		shard.requires('nuke');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});

		// Place all four ephemeral object types far from ground zero so the test
		// proves the room-wide cleanup, not just the blast cleanup.
		await shard.placeDroppedResource('W1N1', {
			pos: [10, 10], resourceType: 'energy', amount: 500,
		});
		await shard.placeSite('W1N1', {
			pos: [11, 11], structureType: STRUCTURE_SPAWN, owner: 'p1',
		});
		await shard.placeTombstone('W1N1', {
			pos: [12, 12], creepName: 'doomed',
		});
		await shard.placeRuin('W1N1', {
			pos: [13, 13], structureType: STRUCTURE_ROAD,
		});
		// Nuke at the opposite side of the room.
		await shard.placeNuke('W1N1', {
			pos: [40, 40], launchRoomName: 'W1N1', timeToLand: 1,
		});
		await shard.tick(2);

		const drops = await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES);
		expect(drops).toEqual([]);
		const sites = await shard.findInRoom('W1N1', FIND_CONSTRUCTION_SITES);
		expect(sites).toEqual([]);
		const tombstones = await shard.findInRoom('W1N1', FIND_TOMBSTONES);
		expect(tombstones).toEqual([]);
		const ruins = await shard.findInRoom('W1N1', FIND_RUINS);
		expect(ruins).toEqual([]);
	});

	test('NUKE-IMPACT-007 nukes do not create tombstones or ruins from objects they destroy', async ({ shard }) => {
		// Engine:
		//   _die.js:20  — `if(!attackType || attackType != C.EVENT_ATTACK_TYPE_NUKE)` skips tombstone creation.
		//   _destroy.js:21 — same check skips ruin creation.
		shard.requires('nuke');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});
		// Creep that will die from the room-wide nuke kill loop.
		const creepId = await shard.placeCreep('W1N1', {
			pos: [10, 10], owner: 'p1',
			body: [TOUGH, MOVE],
		});
		// Structure at ground zero whose hits are below NUKE_DAMAGE[0] so it is destroyed.
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			hits: 100, // far below NUKE_DAMAGE[0]
		});
		await shard.placeNuke('W1N1', {
			pos: [25, 25], launchRoomName: 'W1N1', timeToLand: 1,
		});
		await shard.tick(2);

		// Both objects gone.
		expect(await shard.getObject(creepId)).toBeNull();
		expect(await shard.getObject(spawnId)).toBeNull();

		// No tombstone or ruin produced from nuke kills.
		const tombstones = await shard.findInRoom('W1N1', FIND_TOMBSTONES);
		expect(tombstones).toEqual([]);
		const ruins = await shard.findInRoom('W1N1', FIND_RUINS);
		expect(ruins).toEqual([]);

		// BODYPART_HITS reference for clarity in failure messages.
		void BODYPART_HITS;
	});

	for (const row of nukeImpactObjectCases) {
		test(`NUKE-IMPACT-008:${row.label} object-type outcome at nuke impact matches the matrix`, async ({ shard }) => {
			shard.requires('nuke');
			if (row.capability) shard.requires(row.capability);
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
			});

			let observed: unknown;
			let placedId: string | null = null;
			let nukePos: [number, number] = row.location === 'blastCenter' ? [25, 25] : [35, 35];

			if (row.objectType === 'powerCreep') {
				placedId = await shard.placePowerCreep('W1N1', {
					pos: [10, 10],
					owner: 'p1',
					name: 'NukeMatrixPC',
					powers: {},
					store: {},
				});
			} else if (row.objectType === 'spawningSpawn') {
				const spawnId = await shard.placeStructure('W1N1', {
					pos: [10, 10],
					structureType: STRUCTURE_SPAWN,
					owner: 'p1',
					store: { energy: 300 },
				});
				await shard.tick();
				const rc = await shard.runPlayer('p1', code`
					Game.getObjectById(${spawnId}).spawnCreep([MOVE], 'NukeMatrixSpawned')
				`);
				expect(rc).toBe(OK);
				const spawning = await shard.runPlayer('p1', code`
					!!Game.getObjectById(${spawnId}).spawning
				`);
				expect(spawning).toBe(true);
			} else if (row.objectType === 'controller') {
				const controllerPos = await shard.getControllerPos('W1N1');
				if (!controllerPos) throw new Error('W1N1 has no controller');
				nukePos = [controllerPos.x, controllerPos.y];
			} else if (row.objectType === 'source') {
				await shard.placeSource('W1N1', {
					pos: [25, 25],
					energy: 1000,
					energyCapacity: 3000,
				});
			} else if (row.objectType === 'mineral') {
				await shard.placeMineral('W1N1', {
					pos: [25, 25],
					mineralType: RESOURCE_SILICON,
					mineralAmount: 5000,
				});
			} else if (row.objectType === 'deposit') {
				await shard.placeObject('W1N1', 'deposit', {
					pos: [25, 25],
					depositType: RESOURCE_SILICON,
				});
			} else if (row.objectType === 'flag') {
				await shard.placeFlag('W1N1', {
					pos: [25, 25],
					owner: 'p1',
					name: 'NukeMatrixFlag',
				});
			} else if (row.objectType === 'portal') {
				placedId = await shard.placeObject('W1N1', 'portal', {
					pos: [25, 25],
					destination: { room: 'W2N1', x: 25, y: 25 },
					decayTime: null,
				});
			}

			await shard.placeNuke('W1N1', {
				pos: nukePos,
				launchRoomName: 'W2N1',
				timeToLand: 1,
			});
			await shard.tick(2);

			if (row.objectType === 'powerCreep') {
				observed = await shard.runPlayer('p1', code`
					Game.getObjectById(${placedId}) === null
				`);
				expect(observed).toBe(true);
			} else if (row.objectType === 'spawningSpawn') {
				observed = await shard.runPlayer('p1', code`
					const spawn = Game.spawns[Object.keys(Game.spawns)[0]];
					spawn ? spawn.spawning : 'missing'
				`);
				expect(observed).toBeNull();
			} else if (row.objectType === 'controller') {
				observed = await shard.runPlayer('p1', code`
					!!Game.rooms['W1N1'].controller
				`);
				expect(observed).toBe(true);
			} else if (row.objectType === 'source') {
				const sources = await shard.findInRoom('W1N1', FIND_SOURCES);
				expect(sources).toHaveLength(1);
			} else if (row.objectType === 'mineral') {
				const minerals = await shard.findInRoom('W1N1', FIND_MINERALS);
				expect(minerals).toHaveLength(1);
			} else if (row.objectType === 'deposit') {
				observed = await shard.runPlayer('p1', code`
					Game.rooms['W1N1'].find(FIND_DEPOSITS).length
				`);
				expect(observed).toBe(1);
			} else if (row.objectType === 'flag') {
				observed = await shard.runPlayer('p1', code`
					!!Game.flags['NukeMatrixFlag']
				`);
				expect(observed).toBe(true);
			} else if (row.objectType === 'portal') {
				observed = await shard.runPlayer('p1', code`
					Game.getObjectById(${placedId}) !== null
				`);
				expect(observed).toBe(true);
			}
		});
	}

	test('NUKE-IMPACT-009 active controller safe mode ends when a nuke lands', async ({ shard }) => {
		shard.requires('nuke');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1', safeMode: 50 }],
		});
		await shard.placeNuke('W1N1', {
			pos: [25, 25],
			launchRoomName: 'W2N1',
			timeToLand: 1,
		});
		await shard.tick(2);

		const safeMode = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].controller.safeMode ?? null
		`);
		expect(safeMode).toBeNull();
	});

	test('NUKE-IMPACT-010 safe mode does not prevent nuke damage, creep kills, or cleanup', async ({ shard }) => {
		shard.requires('nuke');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1', safeMode: 50 }],
		});
		const rampartHits = NUKE_DAMAGE[0] + 1000;
		const rampartId = await shard.placeStructure('W1N1', {
			pos: [25, 25],
			structureType: STRUCTURE_RAMPART,
			owner: 'p1',
			hits: rampartHits,
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [10, 10],
			owner: 'p1',
			body: [TOUGH, MOVE],
		});
		await shard.placeDroppedResource('W1N1', {
			pos: [11, 10],
			resourceType: RESOURCE_ENERGY,
			amount: 100,
		});
		await shard.placeNuke('W1N1', {
			pos: [25, 25],
			launchRoomName: 'W2N1',
			timeToLand: 1,
		});
		await shard.tick(2);

		const rampart = await shard.expectStructure(rampartId, STRUCTURE_RAMPART);
		expect(rampart.hits).toBe(rampartHits - NUKE_DAMAGE[0]);
		expect(await shard.getObject(creepId)).toBeNull();
		const drops = await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES);
		expect(drops).toEqual([]);
	});

	test('NUKE-IMPACT-011 nuke impact does not refresh an active controller upgradeBlocked window', async ({ shard }) => {
		shard.requires('nuke');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const ctrlPos = await shard.getControllerPos('W1N1');
		if (!ctrlPos) throw new Error('W1N1 has no controller');
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [ctrlPos.x + 1, ctrlPos.y],
			owner: 'p1',
			body: [CLAIM, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).attackController(Game.rooms['W1N1'].controller)
		`);
		expect(rc).toBe(OK);
		await shard.tick();
		const before = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].controller.upgradeBlocked
		`) as number;
		expect(before).toBeGreaterThan(CONTROLLER_NUKE_BLOCKED_UPGRADE);

		await shard.placeNuke('W1N1', {
			pos: [25, 25],
			launchRoomName: 'W2N1',
			timeToLand: 1,
		});
		await shard.tick(2);
		const after = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].controller.upgradeBlocked
		`) as number;
		expect(after).toBeLessThan(before);
		expect(after).toBeGreaterThan(CONTROLLER_NUKE_BLOCKED_UPGRADE);
	});

	test('NUKE-IMPACT-012 multiple nukes landing on the same tick apply cumulative structure damage', async ({ shard }) => {
		shard.requires('nuke');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});
		const wallHits = NUKE_DAMAGE[0] * 2 + 1_000_000;
		const wallId = await shard.placeStructure('W1N1', {
			pos: [25, 25],
			structureType: STRUCTURE_WALL,
			hits: wallHits,
		});
		await shard.placeNuke('W1N1', {
			pos: [25, 25],
			launchRoomName: 'W2N1',
			timeToLand: 1,
		});
		await shard.placeNuke('W1N1', {
			pos: [25, 25],
			launchRoomName: 'W3N1',
			timeToLand: 1,
		});
		await shard.tick(2);

		const wall = await shard.expectStructure(wallId, STRUCTURE_WALL);
		expect(wall.hits).toBe(wallHits - NUKE_DAMAGE[0] * 2);
	});
});
