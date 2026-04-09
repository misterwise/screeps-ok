import { describe, test, expect, code,
	OK, ERR_NOT_OWNER, ERR_BUSY, ERR_INVALID_ARGS,
	MOVE,
	FIND_STRUCTURES, FIND_RUINS,
	STRUCTURE_RAMPART, STRUCTURE_TOWER,
} from '../../src/index.js';
import { knownParityGap } from '../support/parity-gaps.js';

describe('structure.destroy()', () => {
	knownParityGap('destroy-ownership-bypass')('STRUCTURE-API-001 destroy returns ERR_NOT_OWNER when room controller is not owned by the player', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		// Place p2's rampart in p1's room — p2 doesn't own the controller.
		const rampartId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_RAMPART, owner: 'p2',
			hits: 1000,
		});
		await shard.tick();

		const rc = await shard.runPlayer('p2', code`
			const s = Game.getObjectById(${rampartId});
			s ? s.destroy() : -99
		`);
		expect(rc).toBe(ERR_NOT_OWNER);
	});

	test('STRUCTURE-API-002 destroy returns ERR_BUSY when hostile creeps are in the room', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const rampartId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_RAMPART, owner: 'p1',
			hits: 1000,
		});
		// Place a hostile creep in the room.
		await shard.placeCreep('W1N1', {
			pos: [30, 30], owner: 'p2', body: [MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${rampartId}).destroy()
		`);
		expect(rc).toBe(ERR_BUSY);
	});

	test('STRUCTURE-API-003 destroy returns OK, removes structure, and creates a ruin with store', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 3);
		const towerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
			store: { energy: 500 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${towerId}).destroy()
		`);
		expect(rc).toBe(OK);

		// Let the intent resolve.
		await shard.tick();

		// Structure should be gone.
		const structures = await shard.findInRoom('W1N1', FIND_STRUCTURES);
		const tower = structures.find(s => s.id === towerId);
		expect(tower).toBeUndefined();

		// A ruin should exist at the same position with the store contents.
		const ruins = await shard.findInRoom('W1N1', FIND_RUINS);
		const ruin = ruins.find(r => r.pos.x === 25 && r.pos.y === 25);
		expect(ruin).toBeDefined();
		expect(ruin!.structureType).toBe(STRUCTURE_TOWER);
		expect(ruin!.store.energy).toBe(500);
	});
});

describe('structure.notifyWhenAttacked()', () => {
	knownParityGap('notifyWhenAttacked-not-implemented')('STRUCTURE-API-004 notifyWhenAttacked returns ERR_NOT_OWNER on a non-owned structure', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const rampartId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_RAMPART, owner: 'p1',
			hits: 1000,
		});
		// Place p2 creep for visibility.
		await shard.placeCreep('W1N1', {
			pos: [30, 30], owner: 'p2', body: [MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p2', code`
			const s = Game.getObjectById(${rampartId});
			s ? s.notifyWhenAttacked(true) : -99
		`);
		expect(rc).toBe(ERR_NOT_OWNER);
	});

	knownParityGap('notifyWhenAttacked-not-implemented')('STRUCTURE-API-005 notifyWhenAttacked returns ERR_INVALID_ARGS when enabled is not boolean', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 3);
		const towerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
			store: { energy: 500 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${towerId}).notifyWhenAttacked(42)
		`);
		expect(rc).toBe(ERR_INVALID_ARGS);
	});

	knownParityGap('notifyWhenAttacked-not-implemented')('STRUCTURE-API-006 notifyWhenAttacked returns OK with valid boolean argument', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 3);
		const towerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
			store: { energy: 500 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${towerId}).notifyWhenAttacked(false)
		`);
		expect(rc).toBe(OK);
	});
});
