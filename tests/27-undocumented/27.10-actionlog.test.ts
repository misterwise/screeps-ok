import type { ShardFixture } from '../../src/fixture.js';
import type { RoomActionLogCapture } from '../../src/index.js';
import { describe, test, expect, code, body,
	OK,
	WORK, CARRY, MOVE, ATTACK, HEAL, CLAIM, TOUGH,
	STRUCTURE_ROAD, STRUCTURE_RAMPART, STRUCTURE_TOWER, STRUCTURE_LINK, STRUCTURE_LAB,
	LAB_REACTION_AMOUNT,
} from '../../src/index.js';
import { actionLogCreepCases } from '../../src/matrices/actionlog-creep.js';
import { actionLogTargetCases } from '../../src/matrices/actionlog-target.js';
import { actionLogStructureCases } from '../../src/matrices/actionlog-struct.js';

type ActionLogObject = RoomActionLogCapture['objects'][number];

async function resolveIds(
	shard: ShardFixture,
	ids: Record<string, string>,
	player = 'p1',
): Promise<Record<string, string>> {
	const json = await shard.runPlayer(player, code`
		const ids = ${ids};
		JSON.stringify(Object.fromEntries(
			Object.entries(ids).map(([key, id]) => [key, Game.getObjectById(id).id])
		))
	`) as string;
	return JSON.parse(json) as Record<string, string>;
}

function expectAction(
	capture: RoomActionLogCapture,
	id: string,
	action: string,
	payload: Record<string, unknown>,
): ActionLogObject {
	const object = capture.objects.find(entry => entry.id === id);
	expect(object).toBeDefined();
	expect(object!.actionLog[action]).toEqual(payload);
	return object!;
}

function expectNoAction(capture: RoomActionLogCapture, id: string, action: string): void {
	const object = capture.objects.find(entry => entry.id === id);
	expect(object?.actionLog[action]).toBeUndefined();
}

async function damageFriendlyCreep(shard: ShardFixture, targetId: string, pos: [number, number]): Promise<void> {
	const attackerId = await shard.placeCreep('W1N1', {
		pos, owner: 'p2',
		body: [ATTACK, MOVE],
	});
	const rc = await shard.runPlayer('p2', code`
		Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
	`);
	expect(rc).toBe(OK);
}

async function runCreepActionScenario(
	shard: ShardFixture,
	scenario: typeof actionLogCreepCases[number]['scenario'],
): Promise<{ capture: RoomActionLogCapture; actorId: string }> {
	if (scenario === 'attack') {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const actor = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [ATTACK, MOVE],
		});
		const target = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2',
			body: body(5, TOUGH, MOVE),
		});
		const ids = await resolveIds(shard, { actor });
		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${actor}).attack(Game.getObjectById(${target}))
		`);
		expect(rc).toBe(OK);
		return { capture: await shard.captureActionLog('W1N1'), actorId: ids.actor! };
	}

	if (scenario === 'harvest') {
		await shard.ownedRoom('p1');
		const actor = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		const source = await shard.placeSource('W1N1', {
			pos: [25, 26], energy: 3000, energyCapacity: 3000,
		});
		const ids = await resolveIds(shard, { actor });
		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${actor}).harvest(Game.getObjectById(${source}))
		`);
		expect(rc).toBe(OK);
		return { capture: await shard.captureActionLog('W1N1'), actorId: ids.actor! };
	}

	if (scenario === 'build') {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const actor = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
			store: { energy: 50 },
		});
		const site = await shard.placeSite('W1N1', {
			pos: [25, 26], owner: 'p1',
			structureType: STRUCTURE_ROAD,
		});
		const ids = await resolveIds(shard, { actor });
		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${actor}).build(Game.getObjectById(${site}))
		`);
		expect(rc).toBe(OK);
		return { capture: await shard.captureActionLog('W1N1'), actorId: ids.actor! };
	}

	if (scenario === 'repair') {
		await shard.ownedRoom('p1');
		const actor = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
			store: { energy: 50 },
		});
		const road = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_ROAD,
			hits: 100,
		});
		const ids = await resolveIds(shard, { actor });
		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${actor}).repair(Game.getObjectById(${road}))
		`);
		expect(rc).toBe(OK);
		return { capture: await shard.captureActionLog('W1N1'), actorId: ids.actor! };
	}

	if (scenario === 'heal' || scenario === 'rangedHeal') {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const targetPos: [number, number] = scenario === 'heal' ? [25, 26] : [25, 27];
		const attackerPos: [number, number] = scenario === 'heal' ? [25, 27] : [25, 28];
		const actor = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [HEAL, MOVE],
		});
		const target = await shard.placeCreep('W1N1', {
			pos: targetPos, owner: 'p1',
			body: body(5, TOUGH, MOVE),
		});
		const ids = await resolveIds(shard, { actor });
		await damageFriendlyCreep(shard, target, attackerPos);
		const method = scenario === 'heal' ? 'heal' : 'rangedHeal';
		const rc = await shard.runPlayer('p1', code`
			const actor = Game.getObjectById(${actor});
			const target = Game.getObjectById(${target});
			actor[${method}](target)
		`);
		expect(rc).toBe(OK);
		return { capture: await shard.captureActionLog('W1N1'), actorId: ids.actor! };
	}

	if (scenario === 'upgradeController') {
		await shard.ownedRoom('p1');
		const actor = await shard.placeCreep('W1N1', {
			pos: [2, 1], owner: 'p1',
			body: [WORK, CARRY, MOVE],
			store: { energy: 50 },
		});
		const ids = await resolveIds(shard, { actor });
		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${actor}).upgradeController(Game.rooms.W1N1.controller)
		`);
		expect(rc).toBe(OK);
		return { capture: await shard.captureActionLog('W1N1'), actorId: ids.actor! };
	}

	await shard.createShard({
		players: ['p1'],
		rooms: [{ name: 'W1N1' }],
	});
	const actor = await shard.placeCreep('W1N1', {
		pos: [2, 1], owner: 'p1',
		body: [CLAIM, MOVE],
	});
	const ids = await resolveIds(shard, { actor });
	const rc = await shard.runPlayer('p1', code`
		Game.getObjectById(${actor}).reserveController(Game.rooms.W1N1.controller)
	`);
	expect(rc).toBe(OK);
	return { capture: await shard.captureActionLog('W1N1'), actorId: ids.actor! };
}

async function runTargetActionScenario(
	shard: ShardFixture,
	scenario: typeof actionLogTargetCases[number]['scenario'],
): Promise<{ capture: RoomActionLogCapture; targetId: string }> {
	await shard.createShard({
		players: ['p1', 'p2'],
		rooms: [{ name: 'W1N1', rcl: 3, owner: 'p1' }],
	});

	if (scenario === 'meleeAttackCreep') {
		const actor = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [ATTACK, MOVE],
		});
		const target = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2',
			body: body(5, TOUGH, MOVE),
		});
		const ids = await resolveIds(shard, { target });
		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${actor}).attack(Game.getObjectById(${target}))
		`);
		expect(rc).toBe(OK);
		return { capture: await shard.captureActionLog('W1N1'), targetId: ids.target! };
	}

	if (scenario === 'meleeHealCreep') {
		const actor = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [HEAL, MOVE],
		});
		const target = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: body(5, TOUGH, MOVE),
		});
		const ids = await resolveIds(shard, { target });
		await damageFriendlyCreep(shard, target, [25, 27]);
		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${actor}).heal(Game.getObjectById(${target}))
		`);
		expect(rc).toBe(OK);
		return { capture: await shard.captureActionLog('W1N1'), targetId: ids.target! };
	}

	if (scenario === 'towerAttackCreep') {
		const tower = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
			store: { energy: 1000 },
		});
		const target = await shard.placeCreep('W1N1', {
			pos: [25, 28], owner: 'p2',
			body: body(10, TOUGH, MOVE),
		});
		const ids = await resolveIds(shard, { target });
		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${tower}).attack(Game.getObjectById(${target}))
		`);
		expect(rc).toBe(OK);
		return { capture: await shard.captureActionLog('W1N1'), targetId: ids.target! };
	}

	const tower = await shard.placeStructure('W1N1', {
		pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
		store: { energy: 1000 },
	});
	const target = await shard.placeCreep('W1N1', {
		pos: [25, 27], owner: 'p1',
		body: body(5, TOUGH, MOVE),
	});
	const ids = await resolveIds(shard, { target });
	await damageFriendlyCreep(shard, target, [25, 28]);
	const rc = await shard.runPlayer('p1', code`
		Game.getObjectById(${tower}).heal(Game.getObjectById(${target}))
	`);
	expect(rc).toBe(OK);
	return { capture: await shard.captureActionLog('W1N1'), targetId: ids.target! };
}

async function runStructureActionScenario(
	shard: ShardFixture,
	scenario: typeof actionLogStructureCases[number]['scenario'],
): Promise<{ capture: RoomActionLogCapture; structureId: string }> {
	await shard.createShard({
		players: ['p1', 'p2'],
		rooms: [{ name: 'W1N1', rcl: 6, owner: 'p1' }],
	});

	if (scenario === 'towerAttack') {
		const tower = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
			store: { energy: 1000 },
		});
		const target = await shard.placeCreep('W1N1', {
			pos: [25, 28], owner: 'p2',
			body: body(5, TOUGH, MOVE),
		});
		const ids = await resolveIds(shard, { tower });
		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${tower}).attack(Game.getObjectById(${target}))
		`);
		expect(rc).toBe(OK);
		return { capture: await shard.captureActionLog('W1N1'), structureId: ids.tower! };
	}

	if (scenario === 'towerHeal') {
		const tower = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
			store: { energy: 1000 },
		});
		const target = await shard.placeCreep('W1N1', {
			pos: [25, 27], owner: 'p1',
			body: body(5, TOUGH, MOVE),
		});
		const ids = await resolveIds(shard, { tower });
		await damageFriendlyCreep(shard, target, [25, 28]);
		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${tower}).heal(Game.getObjectById(${target}))
		`);
		expect(rc).toBe(OK);
		return { capture: await shard.captureActionLog('W1N1'), structureId: ids.tower! };
	}

	if (scenario === 'towerRepair') {
		const tower = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
			store: { energy: 1000 },
		});
		const rampart = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_RAMPART, owner: 'p1',
			hits: 100,
		});
		const ids = await resolveIds(shard, { tower });
		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${tower}).repair(Game.getObjectById(${rampart}))
		`);
		expect(rc).toBe(OK);
		return { capture: await shard.captureActionLog('W1N1'), structureId: ids.tower! };
	}

	if (scenario === 'linkTransferEnergy') {
		const link = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LINK, owner: 'p1',
			store: { energy: 400 },
		});
		const target = await shard.placeStructure('W1N1', {
			pos: [25, 35], structureType: STRUCTURE_LINK, owner: 'p1',
			store: { energy: 0 },
		});
		const ids = await resolveIds(shard, { link });
		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${link}).transferEnergy(Game.getObjectById(${target}), 100)
		`);
		expect(rc).toBe(OK);
		return { capture: await shard.captureActionLog('W1N1'), structureId: ids.link! };
	}

	if (scenario === 'labRunReaction') {
		const lab = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000 },
		});
		const lab1 = await shard.placeStructure('W1N1', {
			pos: [25, 27], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000, H: LAB_REACTION_AMOUNT },
		});
		const lab2 = await shard.placeStructure('W1N1', {
			pos: [27, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000, O: LAB_REACTION_AMOUNT },
		});
		const ids = await resolveIds(shard, { lab });
		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${lab}).runReaction(Game.getObjectById(${lab1}), Game.getObjectById(${lab2}))
		`);
		expect(rc).toBe(OK);
		return { capture: await shard.captureActionLog('W1N1'), structureId: ids.lab! };
	}

	const lab = await shard.placeStructure('W1N1', {
		pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
		store: { energy: 2000, OH: LAB_REACTION_AMOUNT },
	});
	const lab1 = await shard.placeStructure('W1N1', {
		pos: [25, 27], structureType: STRUCTURE_LAB, owner: 'p1',
		store: { energy: 2000 },
	});
	const lab2 = await shard.placeStructure('W1N1', {
		pos: [27, 25], structureType: STRUCTURE_LAB, owner: 'p1',
		store: { energy: 2000 },
	});
	const ids = await resolveIds(shard, { lab });
	const rc = await shard.runPlayer('p1', code`
		Game.getObjectById(${lab}).reverseReaction(Game.getObjectById(${lab1}), Game.getObjectById(${lab2}))
	`);
	expect(rc).toBe(OK);
	return { capture: await shard.captureActionLog('W1N1'), structureId: ids.lab! };
}

describe('Room history action log', () => {
	for (const row of actionLogCreepCases) {
		test(`ACTIONLOG-CREEP-001:${row.label} successful creep actions render source-side action markers`, async ({ shard }) => {
			shard.requires('actionLogCapture');
			const { capture, actorId } = await runCreepActionScenario(shard, row.scenario);
			const entry = expectAction(capture, actorId, row.action, row.expected);
			expect(entry.type).toBe('creep');
		});
	}

	for (const row of actionLogTargetCases) {
		test(`ACTIONLOG-TARGET-001:${row.label} successful incoming effects render target-side markers`, async ({ shard }) => {
			shard.requires('actionLogCapture');
			const { capture, targetId } = await runTargetActionScenario(shard, row.scenario);
			const entry = expectAction(capture, targetId, row.action, row.expected);
			expect(entry.type).toBe('creep');
		});
	}

	for (const row of actionLogStructureCases) {
		test(`ACTIONLOG-STRUCT-001:${row.label} successful structure actions render source-side markers`, async ({ shard }) => {
			shard.requires('actionLogCapture');
			if (row.capability) shard.requires(row.capability);
			const { capture, structureId } = await runStructureActionScenario(shard, row.scenario);
			expectAction(capture, structureId, row.action, row.expected);
		});
	}

	test('ACTIONLOG-SAY-001 say() renders message text and public visibility in the action-log artifact', async ({ shard }) => {
		shard.requires('actionLogCapture');
		await shard.ownedRoom('p1');
		const creep = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [MOVE],
		});
		const ids = await resolveIds(shard, { creep });

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creep}).say('hello', true)
		`);
		expect(rc).toBe(OK);

		const capture = await shard.captureActionLog('W1N1');
		expectAction(capture, ids.creep!, 'say', { message: 'hello', isPublic: true });
	});

	test('ACTIONLOG-TICK-001 action-log capture is scoped to the tick that generated the marker', async ({ shard }) => {
		shard.requires('actionLogCapture');
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const attacker = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [ATTACK, MOVE],
		});
		const target = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2',
			body: body(5, TOUGH, MOVE),
		});
		const ids = await resolveIds(shard, { attacker });

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${attacker}).attack(Game.getObjectById(${target}))
		`);
		expect(rc).toBe(OK);

		const actionTick = await shard.captureActionLog('W1N1');
		expectAction(actionTick, ids.attacker!, 'attack', { x: 25, y: 26 });

		await shard.tick();
		const laterTick = await shard.captureActionLog('W1N1');
		expectNoAction(laterTick, ids.attacker!, 'attack');
	});

	test('ACTIONLOG-DEDUP-001 a repeated same-type marker exposes only the later payload for that object and tick', async ({ shard }) => {
		shard.requires('actionLogCapture');
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 3, owner: 'p1' }],
		});
		const tower = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
			store: { energy: 1000 },
		});
		const first = await shard.placeCreep('W1N1', {
			pos: [25, 28], owner: 'p2',
			body: body(5, TOUGH, MOVE),
		});
		const second = await shard.placeCreep('W1N1', {
			pos: [26, 28], owner: 'p2',
			body: body(5, TOUGH, MOVE),
		});
		const ids = await resolveIds(shard, { tower });

		const result = await shard.runPlayer('p1', code`
			const tower = Game.getObjectById(${tower});
			({
				first: tower.attack(Game.getObjectById(${first})),
				second: tower.attack(Game.getObjectById(${second})),
			})
		`) as { first: number; second: number };
		expect(result.first).toBe(OK);
		expect(result.second).toBe(OK);

		const capture = await shard.captureActionLog('W1N1');
		const entry = expectAction(capture, ids.tower!, 'attack', { x: 26, y: 28 });
		expect(Object.keys(entry.actionLog).filter(action => action === 'attack')).toEqual(['attack']);
	});
});
