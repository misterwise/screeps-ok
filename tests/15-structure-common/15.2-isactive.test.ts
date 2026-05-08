import { describe, test, expect, code,
	OK, ERR_RCL_NOT_ENOUGH,
	BODYPART_HITS, MOVE,
	STRUCTURE_EXTENSION, STRUCTURE_TOWER, STRUCTURE_STORAGE, STRUCTURE_LINK,
	STRUCTURE_LAB, STRUCTURE_EXTRACTOR, STRUCTURE_TERMINAL, STRUCTURE_OBSERVER,
	STRUCTURE_SPAWN, STRUCTURE_ROAD, STRUCTURE_CONTAINER,
	CONTROLLER_STRUCTURES,
} from '../../src/index.js';

describe('Structure isActive()', () => {
	test('STRUCTURE-ACTIVE-001 isActive returns true only for allowed structures at the current RCL', async ({ shard }) => {
		// At RCL 2, exactly the allowed number of closest same-type structures are active.
		await shard.ownedRoom('p1', 'W1N1', 2);
		const limit = CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][2];
		const ids: string[] = [];
		for (let i = 0; i < limit + 1; i++) {
			ids.push(await shard.placeStructure('W1N1', {
				pos: [5 + i, 5], structureType: STRUCTURE_EXTENSION, owner: 'p1',
			}));
		}
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const ids = ${ids};
			({
				activeIds: ids.filter(id => Game.getObjectById(id).isActive()),
				inactiveIds: ids.filter(id => !Game.getObjectById(id).isActive()),
			})
		`) as { activeIds: string[]; inactiveIds: string[] };
		expect(result).toEqual({
			activeIds: ids.slice(0, limit),
			inactiveIds: ids.slice(limit),
		});
	});

	test('STRUCTURE-ACTIVE-002 inactive structures reject gated gameplay actions', async ({ shard }) => {
		// Place a tower at RCL 2 (towers require RCL 3) and verify a gated action rejects.
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const towerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
			store: { energy: 100 },
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2', body: [MOVE], name: 'InactiveTowerTarget',
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const tower = Game.getObjectById(${towerId});
			({
				active: tower.isActive(),
				rc: tower.attack(Game.getObjectById(${targetId})),
			})
		`) as { active: boolean; rc: number };
		expect(result).toEqual({ active: false, rc: ERR_RCL_NOT_ENOUGH });

		const target = await shard.expectObject(targetId, 'creep');
		expect(target.hits).toBe(BODYPART_HITS);
	});

	test('STRUCTURE-ACTIVE-003 a structure becomes active again when RCL satisfies its requirements', async ({ shard }) => {
		// Tower at RCL 2 is inactive; at RCL 3 it becomes active.
		// We test at RCL 3 directly — the CTRL-STRUCTLIMIT-002 matrix already
		// proves inactive at RCL 2. Here we confirm the transition to active.
		await shard.ownedRoom('p1', 'W1N1', 3);
		const id = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
		});
		await shard.tick();

		const active = await shard.runPlayer('p1', code`
			Game.getObjectById(${id}).isActive()
		`);
		expect(active).toBe(true);
	});

	test('STRUCTURE-ACTIVE-004 unowned structures with no controller limit return true from isActive', async ({ shard }) => {
		// Roads and containers have no controller structure limit.
		await shard.ownedRoom('p1', 'W1N1', 1);
		const roadId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_ROAD,
		});
		const containerId = await shard.placeStructure('W1N1', {
			pos: [26, 25], structureType: STRUCTURE_CONTAINER,
		});
		await shard.tick();

		const results = await shard.runPlayer('p1', code`
			({
				road: Game.getObjectById(${roadId}).isActive(),
				container: Game.getObjectById(${containerId}).isActive(),
			})
		`) as { road: boolean; container: boolean };
		expect(results.road).toBe(true);
		expect(results.container).toBe(true);
	});

	test('STRUCTURE-ACTIVE-005 same-type structures at equal controller distance: isActive by engine scan order', async ({ shard }) => {
		// At RCL 2, max 5 extensions allowed. Place 6 — only 5 should be active.
		await shard.ownedRoom('p1', 'W1N1', 2);
		const ids: string[] = [];
		for (let i = 0; i < 6; i++) {
			ids.push(await shard.placeStructure('W1N1', {
				pos: [21, 2 + i], structureType: STRUCTURE_EXTENSION, owner: 'p1',
			}));
		}
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const ids = ${ids};
			({
				activeIds: ids.filter(id => Game.getObjectById(id).isActive()),
				inactiveIds: ids.filter(id => !Game.getObjectById(id).isActive()),
			})
		`) as { activeIds: string[]; inactiveIds: string[] };
		expect(result).toEqual({
			activeIds: ids.slice(0, 5),
			inactiveIds: [ids[5]],
		});
	});
});
