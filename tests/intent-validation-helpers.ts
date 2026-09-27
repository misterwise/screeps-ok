import { expect } from 'vitest';
import type { ShardFixture } from '../src/fixture.js';
import type { PlayerCode } from '../src/code.js';
import type { StaleArgumentCase } from '../src/matrices/stale-argument.js';
import {
	body, code, BODYPART_COST, CARRY, CLAIM, EXTENSION_ENERGY_CAPACITY, FIND_CREEPS, MOVE, OK, RANGED_ATTACK,
	SPAWN_ENERGY_CAPACITY, STRUCTURE_EXTENSION, STRUCTURE_SPAWN, WORK,
} from '../src/index.js';

interface BusyCreepOptions {
	roomName?: string;
	owner?: string;
	name?: string;
	body?: string[];
	observerOwner?: string;
	/** The spawn's tile, where the creep stays while it spawns. Defaults to (25, 25). */
	pos?: [number, number];
}

// A body that costs more than a spawn holds draws on full extensions along
// y = 40; the room's RCL must allow them (RCL 3 has ten, enough for CLAIM).
export async function spawnBusyCreep(shard: ShardFixture, options: BusyCreepOptions = {}): Promise<string> {
	const roomName = options.roomName ?? 'W1N1';
	const owner = options.owner ?? 'p1';
	const name = options.name ?? 'Busy';
	const body = options.body ?? [MOVE];

	const spawnId = await shard.placeStructure(roomName, {
		pos: options.pos ?? [25, 25],
		structureType: STRUCTURE_SPAWN,
		owner,
		store: { energy: SPAWN_ENERGY_CAPACITY },
	});
	const cost = body.reduce((sum, part) => sum + BODYPART_COST[part], 0);
	const extensionEnergy = EXTENSION_ENERGY_CAPACITY[3];
	for (let i = 0; SPAWN_ENERGY_CAPACITY + i * extensionEnergy < cost; i++) {
		await shard.placeStructure(roomName, {
			pos: [20 + i, 40], structureType: STRUCTURE_EXTENSION, owner, store: { energy: extensionEnergy },
		});
	}
	if (options.observerOwner !== undefined) {
		await shard.placeCreep(roomName, {
			pos: [20, 20],
			owner: options.observerOwner,
			body: [MOVE],
		});
	}
	await shard.tick();

	const rc = await shard.runPlayer(owner, code`
		Game.getObjectById(${spawnId}).spawnCreep(${body}, ${name})
	`);
	if (rc !== OK) throw new Error(`spawnBusyCreep: spawnCreep returned ${rc}`);

	const creeps = await shard.findInRoom(roomName, FIND_CREEPS);
	const creep = creeps.find(candidate => candidate.name === name);
	if (!creep) throw new Error(`spawnBusyCreep: could not find spawning creep '${name}'`);
	return creep.id;
}

// No room spec field reserves a controller: `reserver` reserves the neutral
// room in-test, with enough CLAIM parts to outlast the next few ticks.
export async function reserveRoom(shard: ShardFixture, reserver: string, roomName: string): Promise<void> {
	const ctrlPos = await shard.getControllerPos(roomName);
	const reserverId = await shard.placeCreep(roomName, {
		pos: [ctrlPos!.x, ctrlPos!.y + 1],
		owner: reserver,
		body: [CLAIM, CLAIM, CLAIM, CLAIM, CLAIM, MOVE],
	});
	await shard.tick();
	const rc = await shard.runPlayer(reserver, code`
		Game.getObjectById(${reserverId}).reserveController(Game.rooms[${roomName}].controller)
	`);
	if (rc !== OK) throw new Error(`reserveRoom: reserveController returned ${rc}`);
}

interface FatiguedCreepOptions {
	roomName?: string;
	owner?: string;
	observerOwner?: string;
	/** A hostile player whose creep destroys the fatigued creep's only MOVE part as it moves. */
	moveBreaker?: string;
}

export async function placeFatiguedCreep(shard: ShardFixture, options: FatiguedCreepOptions = {}): Promise<string> {
	const roomName = options.roomName ?? 'W1N1';
	const owner = options.owner ?? 'p1';
	const creepId = await shard.placeCreep(roomName, {
		pos: [25, 25],
		owner,
		// Damage lands on body[0] first: BODYPART_HITS of it takes the MOVE part alone.
		body: options.moveBreaker ? [MOVE, WORK, WORK, WORK, WORK, WORK] : [WORK, WORK, WORK, WORK, WORK, CARRY, MOVE],
	});
	if (options.observerOwner !== undefined) {
		await shard.placeCreep(roomName, {
			pos: [20, 20],
			owner: options.observerOwner,
			body: [MOVE],
		});
	}
	const breakerId = options.moveBreaker
		? await shard.placeCreep(roomName, { pos: [25, 27], owner: options.moveBreaker, body: body(10, RANGED_ATTACK, MOVE) })
		: undefined;
	await shard.tick();

	const move = code`Game.getObjectById(${creepId}).move(TOP)`;
	const rcs = breakerId
		? await shard.runPlayers({
			[owner]: move,
			[options.moveBreaker!]: code`Game.getObjectById(${breakerId}).rangedAttack(Game.getObjectById(${creepId}))`,
		})
		: { [owner]: await shard.runPlayer(owner, move) };
	if (Object.values(rcs).some(rc => rc !== OK)) throw new Error(`placeFatiguedCreep: ${JSON.stringify(rcs)}`);

	const creep = await shard.expectObject(creepId, 'creep');
	if (creep.fatigue <= 0) throw new Error('placeFatiguedCreep: creep did not become fatigued');
	if (options.moveBreaker && creep.body.some(part => part.type === MOVE && part.hits > 0)) {
		throw new Error('placeFatiguedCreep: the MOVE part survived');
	}
	return creepId;
}

export async function expectStaleArgumentRejected(
	shard: ShardFixture,
	userId: string,
	row: StaleArgumentCase,
	playerCode: PlayerCode,
): Promise<void> {
	if (row.expected === 'runtime') {
		await shard.expectRunPlayerError(userId, playerCode, 'runtime');
	} else {
		expect(await shard.runPlayer(userId, playerCode)).toBe(row.expected);
	}
}
