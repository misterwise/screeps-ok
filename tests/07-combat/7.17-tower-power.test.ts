import { describe, test, expect, code,
	OK,
	PWR_OPERATE_TOWER, PWR_DISRUPT_TOWER,
	STRUCTURE_TOWER, STRUCTURE_ROAD,
	TOWER_POWER_ATTACK, TOWER_POWER_HEAL, TOWER_POWER_REPAIR,
	ATTACK, MOVE, TOUGH, body,
} from '../../src/index.js';
import { towerPowerCases } from '../../src/matrices/tower-power.js';

// Catalog row suffixes are letters only.
const LEVEL_WORDS = ['One', 'Two', 'Three', 'Four', 'Five'];

describe('Tower power effects', () => {
	for (const row of towerPowerCases) {
		const level = row.powerLevel + 1;
		test(`TOWER-POWER-001:${row.power}Level${LEVEL_WORDS[row.powerLevel]} tower attack, heal, and repair scale by the power effect`, async ({ shard }) => {
			shard.requires('powerCreeps');
			shard.requires('powerEffects');
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [
					{ name: 'W1N1', rcl: 8, owner: 'p1' },
					{ name: 'W2N1', rcl: 1, owner: 'p2' },
				],
			});
			const power = row.power === 'operate' ? PWR_OPERATE_TOWER : PWR_DISRUPT_TOWER;
			const towerId = await shard.placeStructure('W1N1', {
				pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
				store: { energy: 1000 },
			});
			await shard.placePowerCreep('W1N1', {
				pos: [25, 26], owner: 'p1',
				powers: { [power]: level },
				store: { ops: 200 },
			});
			// Every target sits inside TOWER_OPTIMAL_RANGE, so only the effect scales.
			const targetId = await shard.placeCreep('W1N1', {
				pos: [27, 25], owner: 'p2', body: body(30, TOUGH, MOVE),
			});
			const patientId = await shard.placeCreep('W1N1', {
				pos: [25, 28], owner: 'p1', body: body(30, TOUGH, MOVE),
			});
			const bruiserId = await shard.placeCreep('W1N1', {
				pos: [25, 29], owner: 'p2', body: body(25, ATTACK, MOVE),
			});
			const roadId = await shard.placeStructure('W1N1', {
				pos: [23, 25], structureType: STRUCTURE_ROAD, hits: 100,
			});
			await shard.tick();

			// Open a wound deeper than any boosted heal.
			await shard.runPlayer('p2', code`
				Game.getObjectById(${bruiserId}).attack(Game.getObjectById(${patientId}))
			`);
			const patientBefore = (await shard.expectObject(patientId, 'creep')).hits;

			const useRc = await shard.runPlayer('p1', code`
				Object.values(Game.powerCreeps)[0].usePower(${power}, Game.getObjectById(${towerId}))
			`);
			expect(useRc).toBe(OK);

			// One tower intent per tick, all inside the effect's duration.
			const rcs = [
				await shard.runPlayer('p1', code`Game.getObjectById(${towerId}).attack(Game.getObjectById(${targetId}))`),
				await shard.runPlayer('p1', code`Game.getObjectById(${towerId}).heal(Game.getObjectById(${patientId}))`),
				await shard.runPlayer('p1', code`Game.getObjectById(${towerId}).repair(Game.getObjectById(${roadId}))`),
			];
			expect(rcs).toEqual([OK, OK, OK]);

			const target = await shard.expectObject(targetId, 'creep');
			const patient = await shard.expectObject(patientId, 'creep');
			const road = await shard.expectStructure(roadId, STRUCTURE_ROAD);
			expect({
				dealt: target.hitsMax - target.hits,
				healed: patient.hits - patientBefore,
				repaired: road.hits - 100,
			}).toEqual({
				dealt: Math.floor(TOWER_POWER_ATTACK * row.expectedEffect),
				healed: Math.floor(TOWER_POWER_HEAL * row.expectedEffect),
				repaired: Math.floor(TOWER_POWER_REPAIR * row.expectedEffect),
			});
		});
	}

	test('TOWER-POWER-002 PWR_OPERATE_TOWER and PWR_DISRUPT_TOWER can coexist on same tower', async ({ shard }) => {
		shard.requires('powerCreeps');
		shard.requires('powerEffects');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});

		const towerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
			store: { energy: 1000 },
		});
		// Place two power creeps — one for operate, one for disrupt.
		await shard.placePowerCreep('W1N1', {
			pos: [25, 26], owner: 'p1', name: 'Operator',
			powers: { [PWR_OPERATE_TOWER]: 1 },
			store: { ops: 200 },
		});
		await shard.placePowerCreep('W1N1', {
			pos: [25, 27], owner: 'p1', name: 'Disruptor',
			powers: { [PWR_DISRUPT_TOWER]: 1 },
			store: { ops: 200 },
		});
		await shard.tick();

		// Apply operate.
		await shard.runPlayer('p1', code`
			const pcs = Object.values(Game.powerCreeps);
			const op = pcs.find(p => p.name === 'Operator');
			op.usePower(PWR_OPERATE_TOWER, Game.getObjectById(${towerId}))
		`);

		// Apply disrupt.
		await shard.runPlayer('p1', code`
			const pcs = Object.values(Game.powerCreeps);
			const dis = pcs.find(p => p.name === 'Disruptor');
			dis.usePower(PWR_DISRUPT_TOWER, Game.getObjectById(${towerId}))
		`);

		// Both effects should be present.
		const effects = await shard.runPlayer('p1', code`
			const tower = Game.getObjectById(${towerId});
			tower.effects ? tower.effects.map(e => e.effect).sort() : []
		`) as number[];
		expect(effects).toContain(PWR_OPERATE_TOWER);
		expect(effects).toContain(PWR_DISRUPT_TOWER);
	});
});
