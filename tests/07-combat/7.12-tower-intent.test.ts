import { describe, test, expect, code,
	OK, FIND_STRUCTURES,
	MOVE, TOUGH, ATTACK, body,
	STRUCTURE_CONTROLLER, STRUCTURE_ROAD, STRUCTURE_TOWER, STRUCTURE_WALL,
	ATTACK_POWER, BODYPART_HITS, PWR_GENERATE_OPS, SOURCE_ENERGY_CAPACITY,
	TOWER_CAPACITY, TOWER_ENERGY_COST, TOWER_POWER_HEAL, TOWER_POWER_REPAIR, WALL_HITS,
} from '../../src/index.js';
import type { ShardFixture } from '../../src/fixture.js';
import { towerTargetCases } from '../../src/matrices/tower-targets.js';

// A tower at (25, 25) with a hostile creep, a wounded friendly creep and a
// damaged wall, each inside TOWER_OPTIMAL_RANGE.
async function towerWithTargets(shard: ShardFixture) {
	await shard.createShard({
		players: ['p1', 'p2'],
		rooms: [
			{ name: 'W1N1', rcl: 3, owner: 'p1' },
			{ name: 'W2N1', rcl: 1, owner: 'p2' },
		],
	});
	const towerId = await shard.placeStructure('W1N1', {
		pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1', store: { energy: TOWER_CAPACITY },
	});
	const enemyId = await shard.placeCreep('W1N1', { pos: [25, 28], owner: 'p2', body: body(9, TOUGH, MOVE) });
	const friendlyId = await shard.placeCreep('W1N1', { pos: [25, 27], owner: 'p1', body: body(10, TOUGH, 10, MOVE) });
	const damagerId = await shard.placeCreep('W1N1', { pos: [24, 27], owner: 'p2', body: body(20, ATTACK, MOVE) });
	const wallId = await shard.placeStructure('W1N1', { pos: [25, 26], structureType: STRUCTURE_WALL, hits: WALL_HITS });

	// A wound deeper than one tower heal.
	const damageRc = await shard.runPlayer('p2', code`
		Game.getObjectById(${damagerId}).attack(Game.getObjectById(${friendlyId}))
	`);
	expect(damageRc).toBe(OK);
	const woundedHits = 20 * BODYPART_HITS - 20 * ATTACK_POWER;
	expect((await shard.expectObject(friendlyId, 'creep')).hits).toBe(woundedHits);
	return { towerId, enemyId, friendlyId, wallId, woundedHits };
}

describe('Tower intent priority', () => {
	test('TOWER-INTENT-002:heal heal is preferred over repair and attack queued the same tick', async ({ shard }) => {
		const { towerId, enemyId, friendlyId, wallId, woundedHits } = await towerWithTargets(shard);

		// Neither the first nor the last call is the one that runs.
		const rcs = await shard.runPlayer('p1', code`
			const tower = Game.getObjectById(${towerId});
			[
				tower.repair(Game.getObjectById(${wallId})),
				tower.heal(Game.getObjectById(${friendlyId})),
				tower.attack(Game.getObjectById(${enemyId})),
			]
		`);
		expect(rcs).toEqual([OK, OK, OK]);
		expect((await shard.expectObject(friendlyId, 'creep')).hits).toBe(woundedHits + TOWER_POWER_HEAL);
	});

	test('TOWER-INTENT-002:repair repair is preferred over attack queued the same tick', async ({ shard }) => {
		const { towerId, enemyId, wallId } = await towerWithTargets(shard);

		const rcs = await shard.runPlayer('p1', code`
			const tower = Game.getObjectById(${towerId});
			[
				tower.attack(Game.getObjectById(${enemyId})),
				tower.repair(Game.getObjectById(${wallId})),
			]
		`);
		expect(rcs).toEqual([OK, OK]);
		expect((await shard.expectStructure(wallId, STRUCTURE_WALL)).hits).toBe(WALL_HITS + TOWER_POWER_REPAIR);
	});

	test('TOWER-INTENT-003 lower-priority tower intents do not execute after the chosen action resolves', async ({ shard }) => {
		const { towerId, enemyId, friendlyId, wallId, woundedHits } = await towerWithTargets(shard);

		const rcs = await shard.runPlayer('p1', code`
			const tower = Game.getObjectById(${towerId});
			[
				tower.heal(Game.getObjectById(${friendlyId})),
				tower.repair(Game.getObjectById(${wallId})),
				tower.attack(Game.getObjectById(${enemyId})),
			]
		`);
		expect(rcs).toEqual([OK, OK, OK]);
		expect((await shard.expectObject(friendlyId, 'creep')).hits).toBe(woundedHits + TOWER_POWER_HEAL);
		expect((await shard.expectObject(enemyId, 'creep')).hits).toBe(10 * BODYPART_HITS);
		expect((await shard.expectStructure(wallId, STRUCTURE_WALL)).hits).toBe(WALL_HITS);
		expect((await shard.expectStructure(towerId, STRUCTURE_TOWER)).store.energy).toBe(TOWER_CAPACITY - TOWER_ENERGY_COST);
	});
});

describe('Tower target acceptance', () => {
	for (const row of towerTargetCases) {
		test(`${row.catalogId}:${row.label} tower.${row.action}() on a ${row.target} returns the canonical code`, async ({ shard }) => {
			if (row.target === 'powerCreep') shard.requires('powerCreeps');
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [
					{ name: 'W1N1', rcl: 3, owner: 'p1' },
					{ name: 'W2N1', rcl: 1, owner: 'p2' },
				],
			});
			const towerId = await shard.placeStructure('W1N1', {
				pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1', store: { energy: TOWER_CAPACITY },
			});
			const pos: [number, number] = [25, 28];
			const owner = row.action === 'attack' ? 'p2' : 'p1';
			let targetId: string;
			switch (row.target) {
				case 'creep':
					targetId = await shard.placeCreep('W1N1', { pos, owner, body: [TOUGH, MOVE] });
					break;
				case 'powerCreep':
					targetId = await shard.placePowerCreep('W1N1', { pos, owner, powers: { [PWR_GENERATE_OPS]: 1 } });
					break;
				case 'structure':
					targetId = await shard.placeStructure('W1N1', { pos, structureType: STRUCTURE_WALL, hits: WALL_HITS });
					break;
				case 'controller':
					targetId = (await shard.findInRoom('W1N1', FIND_STRUCTURES))
						.find(structure => structure.structureType === STRUCTURE_CONTROLLER)!.id;
					break;
				case 'constructionSite':
					targetId = await shard.placeSite('W1N1', { pos, owner: 'p1', structureType: STRUCTURE_ROAD });
					break;
				case 'source':
					targetId = await shard.placeSource('W1N1', { pos, energy: SOURCE_ENERGY_CAPACITY, energyCapacity: SOURCE_ENERGY_CAPACITY });
					break;
			}

			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${towerId})[${row.action}](Game.getObjectById(${targetId}))
			`);
			expect(rc).toBe(row.expectedRc);
		});
	}
});
