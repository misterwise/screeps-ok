import { describe, test, expect, code, body,
	OK, ERR_RCL_NOT_ENOUGH, CONTROLLER_STRUCTURES, WORK, CARRY, MOVE,
	STRUCTURE_EXTENSION, STRUCTURE_TOWER, STRUCTURE_STORAGE, STRUCTURE_LINK,
	STRUCTURE_LAB, STRUCTURE_EXTRACTOR, STRUCTURE_TERMINAL, STRUCTURE_OBSERVER,
	STRUCTURE_SPAWN,
} from '../../src/index.js';
import type { CapabilityName } from '../../src/index.js';
import { ctrlStructLimitTransitionCases } from '../../src/matrices/ctrl-structlimit.js';

// Each type below and at the first level that allows one.
const isActiveCases: readonly { structureType: string; label: string; cap?: CapabilityName }[] = [
	{ structureType: STRUCTURE_EXTENSION, label: 'extension' },
	{ structureType: STRUCTURE_TOWER, label: 'tower' },
	{ structureType: STRUCTURE_STORAGE, label: 'storage' },
	{ structureType: STRUCTURE_LINK, label: 'link' },
	{ structureType: STRUCTURE_EXTRACTOR, label: 'extractor' },
	{ structureType: STRUCTURE_LAB, label: 'lab' },
	{ structureType: STRUCTURE_TERMINAL, label: 'terminal', cap: 'terminal' },
	{ structureType: STRUCTURE_OBSERVER, label: 'observer', cap: 'observer' },
];
const minRcl = (structureType: string) => [1, 2, 3, 4, 5, 6, 7, 8].find(rcl => CONTROLLER_STRUCTURES[structureType][rcl] > 0)!;

describe('CTRL-STRUCTLIMIT-002: isActive by RCL', () => {
	for (const { structureType, label, cap } of isActiveCases) {
		for (const [key, rcl, expected] of [['Below', minRcl(structureType) - 1, false], ['At', minRcl(structureType), true]] as const) {
			test(`CTRL-STRUCTLIMIT-002:${label}${key} a ${label} at RCL ${rcl} reports isActive() === ${expected}`, async ({ shard }) => {
				if (cap) shard.requires(cap);
				await shard.ownedRoom('p1', 'W1N1', rcl);
				const id = await shard.placeStructure('W1N1', {
					pos: [25, 25], structureType, owner: 'p1',
				});
				await shard.tick();

				expect(await shard.runPlayer('p1', code`Game.getObjectById(${id}).isActive()`)).toBe(expected);
			});
		}
	}

	test('CTRL-STRUCTLIMIT-002:spawnAt a spawn at RCL 1 reports isActive() === true', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 1);
		const id = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
		});
		await shard.tick();

		expect(await shard.runPlayer('p1', code`Game.getObjectById(${id}).isActive()`)).toBe(true);
	});

	test('CTRL-STRUCTLIMIT-002:downgrade an extension stays in the room but goes inactive when its level is lost', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1', ticksToDowngrade: 3 }],
		});
		const id = await shard.placeStructure('W1N1', { pos: [25, 25], structureType: STRUCTURE_EXTENSION, owner: 'p1' });
		await shard.tick();

		// Seeded 3: two reads at level 2, then the loss.
		const read = code`({ level: Game.rooms.W1N1.controller.level, active: Game.getObjectById(${id})?.isActive() ?? null })`;
		const reads = [await shard.runPlayer('p1', read), await shard.runPlayer('p1', read), await shard.runPlayer('p1', read)];
		expect(reads).toEqual([{ level: 2, active: true }, { level: 2, active: true }, { level: 1, active: false }]);
	});

	test('CTRL-STRUCTLIMIT-002:levelUp an inactive extension goes active when its room reaches the level', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 1);
		const ctrlPos = await shard.getControllerPos('W1N1');
		const id = await shard.placeStructure('W1N1', { pos: [25, 25], structureType: STRUCTURE_EXTENSION, owner: 'p1' });
		// 30 WORK over 7 upgrades pass CONTROLLER_LEVELS[1].
		const upgraderId = await shard.placeCreep('W1N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y], owner: 'p1', body: body(30, WORK, 5, CARRY, MOVE), store: { energy: 250 },
		});
		await shard.tick();

		const read = code`({ level: Game.rooms.W1N1.controller.level, active: Game.getObjectById(${id}).isActive() })`;
		expect(await shard.runPlayer('p1', read)).toEqual({ level: 1, active: false });
		for (let i = 0; i < 7; i++) {
			await shard.runPlayer('p1', code`Game.getObjectById(${upgraderId}).upgradeController(Game.rooms.W1N1.controller)`);
		}
		expect(await shard.runPlayer('p1', read)).toEqual({ level: 2, active: true });
	});
});

describe('CTRL-STRUCTLIMIT-001: structure count limits', () => {
	// One more than the level allows, the extra one farthest from the controller: it alone is inactive.
	for (const { structureType, rcl, expectedCount } of ctrlStructLimitTransitionCases) {
		test(`CTRL-STRUCTLIMIT-001:${structureType}Rcl${rcl} ${expectedCount} of ${expectedCount + 1} ${structureType}s are active at RCL ${rcl}`, async ({ shard }) => {
			await shard.ownedRoom('p1', 'W1N1', rcl);
			for (let i = 0; i < expectedCount; i++) {
				await shard.placeStructure('W1N1', {
					pos: [10 + i % 30, 10 + 2 * Math.floor(i / 30)], structureType, owner: 'p1',
				});
			}
			const farthestId = await shard.placeStructure('W1N1', { pos: [48, 48], structureType, owner: 'p1' });
			await shard.tick();

			const active = await shard.runPlayer('p1', code`
				const placed = Game.rooms['W1N1'].find(FIND_MY_STRUCTURES)
					.filter(s => s.structureType === ${structureType});
				[placed.length, placed.filter(s => s.isActive()).length, Game.getObjectById(${farthestId}).isActive()]
			`);
			expect(active).toEqual([expectedCount + 1, expectedCount, false]);
		});
	}
});
