import {
	describe, test, expect,
	FIND_STRUCTURES, FIND_CREEPS,
	STRUCTURE_TOWER, STRUCTURE_RAMPART, STRUCTURE_ROAD, STRUCTURE_CONTAINER,
	STRUCTURE_INVADER_CORE,
	ATTACK, MOVE, TOUGH,
} from '../../src/index.js';

// End-to-end coverage of the real STRONGHOLD (invader-core) NPC AI:
//   * deployStronghold — a deploying core places its template with the canonical
//     per-level hits (STRONGHOLD_RAMPART_HITS[level], TOWER_HITS, ROAD_HITS, ...);
//   * create-creep — a deployed core spawns its population defenders at the core
//     tile over `INVADER_CORE_CREEP_SPAWN_TIME[level] * body.length` ticks;
//   * focusClosest — towers + in-range melee/ranged defenders all attack the
//     single hostile nearest the core;
//   * towersMaintenance — a tower heals a damaged defender standing on a rampart.
//
// These assert the REAL @screeps/engine behavior (the spec). They pass on the
// vanilla adapter and fail on an adapter with no stronghold AI.

// Invader-owned objects use the 'sk' handle, which the engine maps to user id
// '2' (Invader); snapshots report their owner back as 'sk'.

// @screeps/common/lib/constants.js — the canonical hits the deploy pass stamps.
const TOWER_HITS = 3000;
const ROAD_HITS = 5000;
const CONTAINER_HITS = 250000;
const STRONGHOLD_RAMPART_HITS: Record<number, number> = {
	1: 100000, 2: 200000, 3: 500000, 4: 1000000, 5: 2000000,
};

describe('Stronghold defense', () => {
	test(
		'STRONGHOLD-DEFENSE-001 a deploying core stamps canonical per-level hits on its template',
		async ({ shard }) => {
			shard.requires('invaderCore');
			await shard.createShard({ players: ['p1'], rooms: [{ name: 'W1N1' }] });

			const cx = 25, cy = 25;
			const coreId = await shard.placeObject('W1N1', 'invaderCore', {
				pos: [cx, cy],
				level: 2,
				deployTime: 1,
				templateName: 'bunker2',
				strongholdId: 'sh-bunker2',
				user: '2',
			});

			await shard.tick(); // fires the 'deploy' behavior

			const all = await shard.findInRoom('W1N1', FIND_STRUCTURES);
			const towers = all.filter(s => s.structureType === STRUCTURE_TOWER);
			const ramparts = all.filter(s => s.structureType === STRUCTURE_RAMPART);
			const roads = all.filter(s => s.structureType === STRUCTURE_ROAD);
			const containers = all.filter(s => s.structureType === STRUCTURE_CONTAINER);

			// bunker2: 2 towers, 6 ramparts (core tile + 5 offsets... actually all
			// perimeter tiles get a rampart), 4 roads, 2 containers — we assert the
			// canonical hits, not exact counts (counts are covered by 14.5).
			expect(towers.length).toBeGreaterThan(0);
			expect(ramparts.length).toBeGreaterThan(0);
			expect(roads.length).toBeGreaterThan(0);
			expect(containers.length).toBeGreaterThan(0);

			for (const t of towers) {
				expect(t.hits).toBe(TOWER_HITS);
				expect(t.owner).toBe('sk');
			}
			for (const r of ramparts) {
				expect(r.hits).toBe(STRONGHOLD_RAMPART_HITS[2]);
				expect(r.owner).toBe('sk');
			}
			for (const r of roads) {
				expect(r.hits).toBe(ROAD_HITS);
			}
			for (const c of containers) {
				expect(c.hits).toBe(CONTAINER_HITS);
			}

			// The core survives the deploy and stops being deploy-pending.
			const core = all.find(s => s.id === coreId);
			expect(core).toBeDefined();
			expect(core!.structureType).toBe(STRUCTURE_INVADER_CORE);
		},
	);

	test(
		'STRONGHOLD-DEFENSE-002 a deployed core spawns a population defender at the core tile',
		async ({ shard }) => {
			shard.requires('invaderCore');
			await shard.createShard({ players: ['p1'], rooms: [{ name: 'W1N1' }] });

			const cx = 25, cy = 25;
			// A deployed (non-deploying) core whose behavior maintains a single
			// weakDefender. Seed the population directly so no shuffle is involved.
			const coreId = await shard.placeObject('W1N1', 'invaderCore', {
				pos: [cx, cy],
				level: 2,
				user: '2',
				strongholdId: 'sh-bunker2',
				strongholdBehavior: 'bunker2',
				population: [{ body: 'weakDefender', behavior: 'simple-melee' }],
			});

			await shard.tick(); // bunker2 → maintainPopulation → createCreep

			const core = await shard.expectStructure(coreId, 'invaderCore');
			expect(core.spawning).not.toBeNull();
			expect(core.spawning!.name).toBe('defender0');

			// The spawning defender exists on the core tile, owned by the Invader.
			const creeps = await shard.findInRoom('W1N1', FIND_CREEPS);
			const defenders = creeps.filter(c => c.owner === 'sk');
			expect(defenders).toHaveLength(1);
			const d = defenders[0];
			expect(d.pos).toEqual({ x: cx, y: cy, roomName: 'W1N1' });
			expect(d.spawning).toBe(true);
			// weakDefender = 15 ATTACK + 15 MOVE.
			expect(d.body.filter(p => p.type === ATTACK)).toHaveLength(15);
			expect(d.body.filter(p => p.type === MOVE)).toHaveLength(15);
		},
	);

	test(
		'STRONGHOLD-DEFENSE-003 towers focus-fire the hostile nearest the core',
		async ({ shard }) => {
			shard.requires('invaderCore');
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1' }],
			});

			const cx = 25, cy = 25;
			// Deployed core running the 'default' behavior (handleController;
			// refillTowers; focusClosest). Two towers around the core.
			await shard.placeObject('W1N1', 'invaderCore', {
				pos: [cx, cy],
				level: 2,
				user: '2',
				strongholdBehavior: 'default',
			});
			await shard.placeStructure('W1N1', {
				structureType: STRUCTURE_TOWER,
				pos: [cx + 1, cy + 1],
				owner: 'sk',
				store: { energy: 1000 },
			});
			await shard.placeStructure('W1N1', {
				structureType: STRUCTURE_TOWER,
				pos: [cx - 1, cy - 1],
				owner: 'sk',
				store: { energy: 1000 },
			});

			// Two hostiles: a near one (nearest to core) and a far one. focusClosest
			// picks the single nearest hostile and every tower fires at it. Bulky
			// bodies so the near one survives a tick of tower fire (and stays put).
			const bulky = new Array(40).fill(TOUGH).concat([MOVE]);
			const nearId = await shard.placeCreep('W1N1', {
				pos: [cx + 3, cy],
				owner: 'p1',
				name: 'near',
				body: bulky,
			});
			const farId = await shard.placeCreep('W1N1', {
				pos: [cx + 6, cy],
				owner: 'p1',
				name: 'far',
				body: bulky,
			});

			const near0 = await shard.expectObject(nearId, 'creep');
			const far0 = await shard.expectObject(farId, 'creep');
			expect(near0.hits).toBe(near0.hitsMax);
			expect(far0.hits).toBe(far0.hitsMax);

			await shard.tick();

			const near1 = await shard.expectObject(nearId, 'creep');
			const far1 = await shard.expectObject(farId, 'creep');
			// The nearest hostile takes tower damage; the far one is untouched.
			expect(near1.hits).toBeLessThan(near0.hits);
			expect(far1.hits).toBe(far0.hits);
		},
	);

	test(
		'STRONGHOLD-DEFENSE-004 an in-range melee defender attacks the focused hostile',
		async ({ shard }) => {
			shard.requires('invaderCore');
			await shard.createShard({ players: ['p1'], rooms: [{ name: 'W1N1' }] });

			const cx = 25, cy = 25;
			await shard.placeObject('W1N1', 'invaderCore', {
				pos: [cx, cy],
				level: 2,
				user: '2',
				strongholdId: 'sh-default',
				strongholdBehavior: 'default',
			});
			// A born melee defender (owner '2') adjacent to the hostile.
			await shard.placeCreep('W1N1', {
				pos: [cx + 2, cy],
				owner: 'sk',
				name: 'defender0',
				body: [ATTACK, ATTACK, MOVE],
				strongholdId: 'sh-default',
			});
			// The hostile is nearest-to-core (range 3) and range 1 from the defender.
			const hostileId = await shard.placeCreep('W1N1', {
				pos: [cx + 3, cy],
				owner: 'p1',
				name: 'raider',
				body: [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE],
			});

			const h0 = await shard.expectObject(hostileId, 'creep');
			expect(h0.hits).toBe(h0.hitsMax);

			await shard.tick();

			const h1 = await shard.expectObject(hostileId, 'creep');
			// 2 ATTACK parts * ATTACK_POWER(30) = 60 melee damage.
			expect(h1.hits).toBeLessThanOrEqual(h0.hits - 60);
		},
	);

	test(
		'STRONGHOLD-DEFENSE-005 towersMaintenance heals a damaged defender on a rampart',
		async ({ shard }) => {
			shard.requires('invaderCore');
			await shard.createShard({ players: ['p1'], rooms: [{ name: 'W1N1' }] });

			const cx = 25, cy = 25;
			// bunker4 behavior runs towersMaintenance (heal damaged defenders on
			// ramparts). Seed an empty population so no spawning noise interferes,
			// and no hostiles so focusMax is idle and the tower is free to heal.
			await shard.placeObject('W1N1', 'invaderCore', {
				pos: [cx, cy],
				level: 4,
				user: '2',
				strongholdId: 'sh-bunker4',
				strongholdBehavior: 'bunker4',
				population: [],
			});
			await shard.placeStructure('W1N1', {
				structureType: STRUCTURE_TOWER,
				pos: [cx + 1, cy + 1],
				owner: 'sk',
				store: { energy: 1000 },
			});
			// A rampart the defender stands on.
			await shard.placeStructure('W1N1', {
				structureType: STRUCTURE_RAMPART,
				pos: [cx + 2, cy],
				owner: 'sk',
				hits: 1000000,
			});
			// A damaged defender on that rampart (600/600 body → seed 300 hits).
			const defId = await shard.placeCreep('W1N1', {
				pos: [cx + 2, cy],
				owner: 'sk',
				name: 'defender0',
				body: [ATTACK, ATTACK, ATTACK, MOVE, MOVE, MOVE],
				hits: 300,
				strongholdId: 'sh-bunker4',
			});

			const d0 = await shard.expectObject(defId, 'creep');
			expect(d0.hits).toBe(300);
			expect(d0.hits).toBeLessThan(d0.hitsMax);

			await shard.tick();

			const d1 = await shard.expectObject(defId, 'creep');
			// The tower heals the damaged defender on the rampart (+TOWER_POWER_HEAL
			// at range, capped at hitsMax).
			expect(d1.hits).toBeGreaterThan(d0.hits);
		},
	);

	test(
		'STRONGHOLD-DEFENSE-006 towersMaintenance repairs a damaged stronghold road',
		async ({ shard }) => {
			shard.requires('invaderCore');
			await shard.createShard({ players: ['p1'], rooms: [{ name: 'W1N1' }] });

			const cx = 25, cy = 25;
			// bunker4 with no damaged defenders → towersMaintenance falls through to
			// repairing a damaged road that shares the core's strongholdId and sits
			// under a rampart.
			await shard.placeObject('W1N1', 'invaderCore', {
				pos: [cx, cy],
				level: 4,
				user: '2',
				strongholdId: 'sh-bunker4',
				strongholdBehavior: 'bunker4',
				population: [],
			});
			await shard.placeStructure('W1N1', {
				structureType: STRUCTURE_TOWER,
				pos: [cx + 1, cy + 1],
				owner: 'sk',
				store: { energy: 1000 },
			});
			await shard.placeStructure('W1N1', {
				structureType: STRUCTURE_RAMPART,
				pos: [cx + 2, cy],
				owner: 'sk',
				hits: 1000000,
			});
			// A damaged stronghold road under the rampart.
			const roadId = await shard.placeStructure('W1N1', {
				structureType: STRUCTURE_ROAD,
				pos: [cx + 2, cy],
				hits: 100,
				strongholdId: 'sh-bunker4',
			});

			const r0 = await shard.expectStructure(roadId, 'road');
			expect(r0.hits).toBe(100);
			expect(r0.hits).toBeLessThan(r0.hitsMax!);

			await shard.tick();

			const r1 = await shard.expectStructure(roadId, 'road');
			expect(r1.hits).toBeGreaterThan(r0.hits);
		},
	);

	test(
		'STRONGHOLD-DEFENSE-007 a simple-melee defender walks toward an approaching hostile',
		async ({ shard }) => {
			shard.requires('invaderCore');
			await shard.createShard({ players: ['p1'], rooms: [{ name: 'W1N1' }] });

			const cx = 25, cy = 25;
			// bunker3 runs the 'simple-melee' behavior: a defender that is NOT yet in
			// melee range of the nearest hostile walks toward it (across the
			// stronghold's own ramparts — the only walkable substrate per the engine's
			// safe cost matrix). Seed the population so no shuffle/spawn interferes.
			await shard.placeObject('W1N1', 'invaderCore', {
				pos: [cx, cy],
				level: 3,
				user: '2',
				strongholdId: 'sh-bunker3',
				strongholdBehavior: 'bunker3',
				population: [
					{ body: 'fullDefender', behavior: 'simple-melee' },
					{ body: 'fullDefender', behavior: 'simple-melee' },
				],
			});
			// A contiguous rampart lane from the defender to the hostile so the
			// engine's ramparts-only path lets the defender advance.
			for (let x = cx + 2; x <= cx + 6; x++) {
				await shard.placeStructure('W1N1', {
					structureType: STRUCTURE_RAMPART,
					pos: [x, cy],
					owner: 'sk',
					hits: 1000000,
				});
			}
			// A born melee defender on the near end of the lane (range 4 from the
			// hostile — too far to attack, so it must MOVE).
			const defId = await shard.placeCreep('W1N1', {
				pos: [cx + 2, cy],
				owner: 'sk',
				name: 'defender0',
				body: [ATTACK, ATTACK, MOVE, MOVE],
				strongholdId: 'sh-bunker3',
			});
			// The hostile sits at the far end of the lane, nearest-to-core along it.
			const hostileId = await shard.placeCreep('W1N1', {
				pos: [cx + 6, cy],
				owner: 'p1',
				name: 'raider',
				body: [MOVE, MOVE],
			});

			const d0 = await shard.expectObject(defId, 'creep');
			const h0 = await shard.expectObject(hostileId, 'creep');
			const range0 = Math.max(
				Math.abs(d0.pos.x - h0.pos.x),
				Math.abs(d0.pos.y - h0.pos.y),
			);
			expect(range0).toBe(4); // starts out of melee range

			await shard.tick();

			const d1 = await shard.expectObject(defId, 'creep');
			// The defender stepped along the rampart lane toward the hostile: its x
			// advanced and it closed distance (it does not teleport into melee — it
			// takes one step per tick).
			expect(d1.pos.x).toBe(d0.pos.x + 1);
			expect(d1.pos.y).toBe(d0.pos.y);
			const range1 = Math.max(
				Math.abs(d1.pos.x - h0.pos.x),
				Math.abs(d1.pos.y - h0.pos.y),
			);
			expect(range1).toBeLessThan(range0);
		},
	);
});
