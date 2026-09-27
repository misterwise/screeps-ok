import { describe, test, expect, code,
	OK, RIGHT,
	MOVE, ATTACK, TOUGH, CARRY,
	ATTACK_POWER, BODYPART_HITS, BUILD_POWER, REPAIR_COST, REPAIR_POWER, UPGRADE_CONTROLLER_POWER,
	body,
} from '../../src/index.js';
import { boostTableCases, type BoostMechanic } from '../../src/matrices/boost-tables.js';
import { expectedBoostedEffect, measureBoostedEffect } from '../boost-helpers.js';

// Parts boosted per case: enough that build's and upgradeController's floor
// drops nothing for any multiplier (build.js:78, upgradeController.js:53).
const wholeEffectParts: Partial<Record<BoostMechanic, number>> = { build: 2, upgradeController: 10 };

describe('Boost magnitudes', () => {
	for (const row of boostTableCases) {
		const boosted = wholeEffectParts[row.mechanic] ?? 1;
		test(`${row.catalogId}:${row.label} ${row.compound} multiplies ${row.mechanic} by ${row.multiplier}`, async ({ shard }) => {
			shard.requires('chemistry');
			const parts = { ...row, boosted, unboosted: 0 };
			const { effect } = await measureBoostedEffect(shard, parts);
			expect(effect).toBe(expectedBoostedEffect(parts));
		});
	}
});

describe('BOOST-TOUGH-002 tough damage reduction applies only to the boosted part', () => {
	test('BOOST-TOUGH-002 damage past the boosted TOUGH part lands on the parts behind it at full rate', async ({ shard }) => {
		shard.requires('chemistry');
		const tough = boostTableCases
			.filter(row => row.mechanic === 'damage')
			.reduce((best, row) => row.multiplier < best.multiplier ? row : best);
		// Enough ATTACK parts to exhaust the TOUGH part's effective hits,
		// BODYPART_HITS / multiplier (creeps/tick.js:7-28).
		const toughEffectiveHits = BODYPART_HITS / tough.multiplier;
		const attackParts = Math.floor(toughEffectiveHits / ATTACK_POWER) + 1;
		const damage = attackParts * ATTACK_POWER;
		const lost = damage - Math.round(toughEffectiveHits * (1 - tough.multiplier));

		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 6, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [TOUGH, MOVE, MOVE], boosts: { 0: tough.compound },
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [26, 25], owner: 'p2', body: body(attackParts, ATTACK, MOVE),
		});

		const rc = await shard.runPlayer('p2', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
		`);
		expect(rc).toBe(OK);
		const target = await shard.expectObject(targetId, 'creep');
		expect(target.hits).toBe(3 * BODYPART_HITS - lost);
		expect(target.body.map(part => part.hits)).toEqual([0, 2 * BODYPART_HITS - lost, BODYPART_HITS]);
	});
});

describe('BOOST-HARVEST-002 harvest boosts apply only during harvest()', () => {
	const harvest = boostTableCases.find(row => row.mechanic === 'harvest')!;
	for (const mechanic of ['build', 'repair', 'dismantle', 'upgradeController'] as const) {
		test(`BOOST-HARVEST-002:${mechanic} a ${harvest.compound} WORK part runs ${mechanic} at its unboosted power`, async ({ shard }) => {
			shard.requires('chemistry');
			const parts = { mechanic, bodyPart: harvest.bodyPart, compound: harvest.compound, boosted: 1, unboosted: 0 };
			const { effect } = await measureBoostedEffect(shard, parts);
			expect(effect).toBe(expectedBoostedEffect({ ...parts, multiplier: 1 }));
		});
	}
});

describe('BOOST-BUILD-002 build and repair boosts do not increase energy cost', () => {
	const unboostedCost = { build: BUILD_POWER, repair: Math.ceil(REPAIR_POWER * REPAIR_COST) };
	for (const mechanic of ['build', 'repair'] as const) {
		const row = boostTableCases.filter(candidate => candidate.mechanic === mechanic).at(-1)!;
		test(`BOOST-BUILD-002:${mechanic} a ${row.compound} WORK part spends the unboosted energy per tick`, async ({ shard }) => {
			shard.requires('chemistry');
			const parts = { ...row, boosted: 1, unboosted: 0 };
			const { effect, energySpent } = await measureBoostedEffect(shard, parts);
			expect(effect).toBe(expectedBoostedEffect(parts));
			expect(energySpent).toBe(unboostedCost[mechanic]);
		});
	}
});

describe('BOOST-UPGRADE-002 upgrade boosts do not increase energy cost', () => {
	test('BOOST-UPGRADE-002 a boosted WORK part spends UPGRADE_CONTROLLER_POWER energy per tick', async ({ shard }) => {
		shard.requires('chemistry');
		const row = boostTableCases.filter(candidate => candidate.mechanic === 'upgradeController').at(-1)!;
		const parts = { ...row, boosted: 1, unboosted: 0 };
		const { effect, energySpent } = await measureBoostedEffect(shard, parts);
		expect(effect).toBe(expectedBoostedEffect(parts));
		expect(energySpent).toBe(UPGRADE_CONTROLLER_POWER);
	});
});

describe('BOOST-CARRY-002 boosted CARRY parts still contribute zero fatigue when empty', () => {
	test('BOOST-CARRY-002 empty boosted CARRY parts add no fatigue', async ({ shard }) => {
		shard.requires('chemistry');
		const carry = boostTableCases.find(row => row.mechanic === 'capacity')!;
		await shard.ownedRoom('p1');
		// Three weighted parts would leave 3 × 2 - 2 fatigue after the move.
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: body(3, CARRY, MOVE),
			boosts: { 0: carry.compound, 1: carry.compound, 2: carry.compound },
		});

		const rc = await shard.runPlayer('p1', code`Game.getObjectById(${creepId}).move(RIGHT)`);
		expect(rc).toBe(OK);
		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.pos.x).toBe(26);
		expect(creep.fatigue).toBe(0);
	});
});
