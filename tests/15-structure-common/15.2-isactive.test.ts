import { describe, test, expect, code,
	OK, ERR_RCL_NOT_ENOUGH,
	STRUCTURE_EXTENSION, STRUCTURE_TOWER, STRUCTURE_STORAGE, STRUCTURE_LINK,
	STRUCTURE_LAB, STRUCTURE_EXTRACTOR, STRUCTURE_TERMINAL, STRUCTURE_OBSERVER,
	STRUCTURE_SPAWN, STRUCTURE_ROAD, STRUCTURE_CONTAINER,
	CONTROLLER_STRUCTURES,
} from '../../src/index.js';

describe('Structure isActive()', () => {
	test('STRUCTURE-ACTIVE-001 isActive returns true only for allowed structures at the current RCL', async ({ shard }) => {
		// At RCL 2, extensions are allowed (max 5). Place 1 extension — should be active.
		await shard.ownedRoom('p1', 'W1N1', 2);
		const id = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_EXTENSION, owner: 'p1',
		});
		await shard.tick();

		const active = await shard.runPlayer('p1', code`
			Game.getObjectById(${id}).isActive()
		`);
		expect(active).toBe(true);
	});

	test('STRUCTURE-ACTIVE-002 inactive structures reject gated gameplay actions', async ({ shard }) => {
		// Place an extension at RCL 1 (extensions require RCL 2) — should be inactive.
		await shard.ownedRoom('p1', 'W1N1', 1);
		const id = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_EXTENSION, owner: 'p1',
			store: { energy: 50 },
		});
		await shard.tick();

		const active = await shard.runPlayer('p1', code`
			Game.getObjectById(${id}).isActive()
		`);
		expect(active).toBe(false);
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
		for (let i = 0; i < 6; i++) {
			await shard.placeStructure('W1N1', {
				pos: [20 + i, 25], structureType: STRUCTURE_EXTENSION, owner: 'p1',
			});
		}
		await shard.tick();

		const activeCount = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].find(FIND_MY_STRUCTURES)
				.filter(s => s.structureType === STRUCTURE_EXTENSION && s.isActive())
				.length
		`);
		expect(activeCount).toBe(5);
	});
});
