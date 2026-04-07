import { describe, test, expect, code,
	OK, STRUCTURE_RAMPART, STRUCTURE_TOWER,
	ATTACK, MOVE, TOUGH, body,
	ATTACK_POWER, TOWER_POWER_ATTACK,
} from '../../src/index.js';
import { knownParityGap } from '../support/parity-gaps.js';
import { rampartHitsMaxCases } from '../support/matrices/rampart-hitsmax.js';

describe('StructureRampart', () => {
	for (const { rcl, expectedHitsMax } of rampartHitsMaxCases) {
		test(`RAMPART-DECAY-003 [rcl=${rcl}] owned rampart hitsMax matches the canonical table`, async ({ shard }) => {
			await shard.ownedRoom('p1', 'W1N1', rcl);
			const rampartId = await shard.placeStructure('W1N1', {
				pos: [25, 25],
				structureType: STRUCTURE_RAMPART,
				owner: 'p1',
				hits: 1,
			});
			await shard.tick();

			const rampart = await shard.expectStructure(rampartId, STRUCTURE_RAMPART);
			expect(rampart.hitsMax).toBe(expectedHitsMax);
		});
	}

	knownParityGap('rampart-no-protection')('RAMPART-PROTECT-001 tower.attack on a tile with a rampart damages the rampart, not the creep', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 3, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const towerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
			store: { energy: 1000 },
		});
		const rampartId = await shard.placeStructure('W1N1', {
			pos: [25, 28], structureType: STRUCTURE_RAMPART, owner: 'p1',
			hits: 10000000,
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 28], owner: 'p2',
			body: body(5, TOUGH, MOVE),
		});

		// Tower attacks the creep, but the rampart on that tile absorbs damage.
		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${towerId}).attack(Game.getObjectById(${creepId}))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		// Creep takes zero damage; rampart absorbs the tower hit.
		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.hits).toBe(600); // 6 parts (5 TOUGH + 1 MOVE) * 100

		const rampart = await shard.expectStructure(rampartId, STRUCTURE_RAMPART);
		expect(rampart.hits).toBe(10000000 - TOWER_POWER_ATTACK);
	});

	knownParityGap('rampart-no-protection')('RAMPART-PROTECT-002 creep.attack on a rampart-covered structure damages the rampart', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 3, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const towerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
			store: { energy: 1000 },
		});
		const rampartId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_RAMPART, owner: 'p1',
			hits: 10000000,
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2',
			body: [ATTACK, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p2', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${towerId}))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		// Tower takes zero damage; rampart absorbs the creep attack.
		const tower = await shard.expectStructure(towerId, STRUCTURE_TOWER);
		expect(tower.hits).toBe(3000);

		const rampart = await shard.expectStructure(rampartId, STRUCTURE_RAMPART);
		expect(rampart.hits).toBe(10000000 - ATTACK_POWER);
	});

	test('RAMPART-PUBLIC-001 hostile creep can move onto a public rampart', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 3, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_RAMPART, owner: 'p1',
			hits: 10000,
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2',
			body: [MOVE],
		});
		await shard.tick();

		// Make the rampart public, then move onto it next tick.
		await shard.runPlayer('p1', code`
			const structs = Game.rooms['W1N1'].lookForAt(LOOK_STRUCTURES, 25, 25);
			const rampart = structs.find(s => s.structureType === 'rampart');
			rampart.setPublic(true)
		`);
		await shard.tick();

		const rc = await shard.runPlayer('p2', code`
			Game.getObjectById(${creepId}).move(TOP)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.pos.y).toBe(25);
	});
});
