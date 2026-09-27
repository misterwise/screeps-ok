import { describe, test, expect, code,
	OK, ERR_NOT_OWNER, ERR_NOT_ENOUGH_RESOURCES, ERR_FULL, ERR_BUSY, ERR_TIRED,
	ERR_INVALID_ARGS, ERR_INVALID_TARGET, ERR_RCL_NOT_ENOUGH,
	COMMODITIES, STRUCTURE_FACTORY, FACTORY_CAPACITY, PWR_OPERATE_FACTORY, POWER_INFO, RESOURCE_OPS,
	RESOURCE_BATTERY, RESOURCE_COMPOSITE,
} from '../../src/index.js';
import type { ShardFixture } from '../../src/fixture.js';
import { factoryProduceCases } from '../../src/matrices/factory-produce.js';
import { factoryCommodityCases } from '../../src/matrices/factory-commodity.js';
import { factoryProduceValidationCases } from '../../src/matrices/factory-produce-validation.js';

describe('Factory production', () => {
	// ---- FACTORY-PRODUCE-001 (matrix): produce() consumes components and produces output ----
	for (const { resource, label, expectedAmount, expectedComponents, requiredLevel } of factoryProduceCases) {
		test(`FACTORY-PRODUCE-001:${label} produce(${resource}) consumes components and yields ${expectedAmount}`, async ({ shard }) => {
			shard.requires('factory');
			// A leveled commodity needs a factory of its level under PWR_OPERATE_FACTORY
			// at that level (game/structures.js:1448-1458).
			if (requiredLevel) {
				shard.requires('powerCreeps');
				shard.requires('powerEffects');
			}
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1', rcl: 7, owner: 'p1', powerEnabled: !!requiredLevel }],
			});
			const factoryId = await shard.placeStructure('W1N1', {
				pos: [25, 25], structureType: STRUCTURE_FACTORY, owner: 'p1',
				store: { ...expectedComponents },
				...(requiredLevel ? { level: requiredLevel } : {}),
			});
			if (requiredLevel) {
				await operateFactory(shard, factoryId, requiredLevel);
			}

			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${factoryId}).produce(${resource})
			`);
			expect(rc).toBe(OK);
			const factory = await shard.expectStructure(factoryId, STRUCTURE_FACTORY);
			expect(heldResources(factory.store)).toEqual({ [resource]: expectedAmount });
		});
	}

	// ---- FACTORY-PRODUCE-002: successful produce returns OK and sets cooldown ----
	test('FACTORY-PRODUCE-002 produce returns OK and sets cooldown to COMMODITIES[resource].cooldown', async ({ shard }) => {
		shard.requires('factory');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 7, owner: 'p1' }],
		});

		const factoryId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_FACTORY, owner: 'p1',
			store: { energy: 600 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${factoryId}).produce(RESOURCE_BATTERY)
		`);
		expect(rc).toBe(OK);

		// Cooldown is applied by the tick processor — observe on next tick.
		const cooldown = await shard.runPlayer('p1', code`
			Game.getObjectById(${factoryId}).cooldown
		`) as number;
		// Cooldown decrements by 1 per tick, so after one tick it's cooldown - 1.
		expect(cooldown).toBe(COMMODITIES.battery.cooldown - 1);
	});

	for (const row of factoryProduceValidationCases) {
		test(`FACTORY-PRODUCE-011:${row.label} produce() validation returns the canonical code`, async ({ shard }) => {
			shard.requires('factory');
			const blockers = shard.validationBlockers(row);
			const owner = blockers.has('not-owner') ? 'p2' : 'p1';
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [{ name: 'W1N1', rcl: blockers.has('rcl') ? 6 : 7, owner: 'p1' }],
			});

			let resourceType = 'battery';
			let level = 0;
			let store: Record<string, number> = { energy: blockers.has('not-enough') ? 100 : 600 };
			if (blockers.has('full')) {
				resourceType = 'energy';
				store = {
					battery: blockers.has('not-enough') ? 0 : 50,
					energy: FACTORY_CAPACITY - 449,
				};
			}
			if (blockers.has('level-mismatch') || blockers.has('power-effect')) {
				resourceType = 'composite';
				level = blockers.has('level-mismatch') && blockers.has('power-effect') ? 2 : blockers.has('power-effect') ? 1 : 0;
				store = {
					utrium_bar: blockers.has('not-enough') ? 0 : 20,
					zynthium_bar: 20,
					energy: 20,
				};
			}
			if (blockers.has('invalid-args')) {
				resourceType = 'power';
			}

			const factoryId = await shard.placeStructure('W1N1', {
				pos: [25, 25],
				structureType: STRUCTURE_FACTORY,
				owner,
				store,
				level,
				...(blockers.has('cooldown') ? { cooldown: COMMODITIES.battery.cooldown } : {}),
			});
			await shard.tick();

			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${factoryId}).produce(${resourceType})
			`);
			expect(rc).toBe(row.expectedRc);
		});
	}
});

describe('Factory commodity chains', () => {
	// ---- FACTORY-COMMODITY-001 (matrix): level requirements match COMMODITIES table ----
	for (const { resource, label, requiredLevel } of factoryCommodityCases) {
		test(`FACTORY-COMMODITY-001:${label} COMMODITIES[${resource}].level is ${requiredLevel ?? 'undefined'}`, async ({ shard }) => {
			shard.requires('factory');
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1', rcl: 7, owner: 'p1' }],
			});

			// Read the commodity's level from the engine at runtime.
			const result = await shard.runPlayer('p1', code`
				COMMODITIES[${resource}] ? COMMODITIES[${resource}].level : 'missing'
			`);
			if (requiredLevel === undefined) {
				expect(result).toBeNull();
			} else {
				expect(result).toBe(requiredLevel);
			}
		});
	}

	// ---- FACTORY-COMMODITY-002: level 0 factory can only produce level 0 commodities ----
	test('FACTORY-COMMODITY-002 factory without PWR_OPERATE_FACTORY produces level 0 commodities only', async ({ shard }) => {
		shard.requires('factory');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 7, owner: 'p1' }],
		});
		// A level-1 factory whose effect is gone: battery is level 0, composite level 1.
		const factoryId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_FACTORY, owner: 'p1',
			store: componentsOf(RESOURCE_BATTERY, RESOURCE_COMPOSITE),
			level: COMMODITIES[RESOURCE_COMPOSITE].level!,
		});

		const rcs = await shard.runPlayer('p1', code`
			const factory = Game.getObjectById(${factoryId});
			[factory.produce(RESOURCE_BATTERY), factory.produce(RESOURCE_COMPOSITE)]
		`);
		expect(rcs).toEqual([OK, ERR_BUSY]);
	});

	// ---- FACTORY-COMMODITY-003: PWR_OPERATE_FACTORY at level N allows level N commodities ----
	test('FACTORY-COMMODITY-003 PWR_OPERATE_FACTORY at level N allows level 0 and level N commodities only', async ({ shard }) => {
		shard.requires('factory');
		shard.requires('powerCreeps');
		shard.requires('powerEffects');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 7, owner: 'p1', powerEnabled: true }],
		});
		const level = COMMODITIES[RESOURCE_COMPOSITE].level!;
		const otherLevel = Object.keys(COMMODITIES).find(resource => COMMODITIES[resource].level === level + 1)!;
		const factoryId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_FACTORY, owner: 'p1',
			store: componentsOf(RESOURCE_BATTERY, RESOURCE_COMPOSITE),
		});
		await operateFactory(shard, factoryId, level);

		const rcs = await shard.runPlayer('p1', code`
			const factory = Game.getObjectById(${factoryId});
			[factory.produce(RESOURCE_BATTERY), factory.produce(RESOURCE_COMPOSITE), factory.produce(${otherLevel})]
		`);
		expect(rcs).toEqual([OK, OK, ERR_INVALID_TARGET]);
	});
});

// A power creep beside the factory applies PWR_OPERATE_FACTORY at `level`.
async function operateFactory(shard: ShardFixture, factoryId: string, level: number) {
	await shard.placePowerCreep('W1N1', {
		pos: [25, 26], owner: 'p1',
		powers: { [PWR_OPERATE_FACTORY]: level },
		store: { [RESOURCE_OPS]: POWER_INFO[PWR_OPERATE_FACTORY].ops! },
	});
	const rc = await shard.runPlayer('p1', code`
		Object.values(Game.powerCreeps)[0].usePower(PWR_OPERATE_FACTORY, Game.getObjectById(${factoryId}))
	`);
	expect(rc).toBe(OK);
}

// Enough of every component to produce each resource once.
function componentsOf(...resources: string[]): Record<string, number> {
	const store: Record<string, number> = {};
	for (const resource of resources) {
		for (const [component, amount] of Object.entries(COMMODITIES[resource].components)) {
			store[component] = (store[component] ?? 0) + amount;
		}
	}
	return store;
}

// The store's non-empty entries, whether or not an engine keeps spent keys at 0.
function heldResources(store: Record<string, number>): Record<string, number> {
	return Object.fromEntries(Object.entries(store).filter(([, amount]) => amount > 0));
}
