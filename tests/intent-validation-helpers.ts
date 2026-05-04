import type { ShardFixture } from '../src/fixture.js';
import {
	code, CARRY, FIND_CREEPS, MOVE, STRUCTURE_SPAWN, WORK,
} from '../src/index.js';

interface BusyCreepOptions {
	roomName?: string;
	owner?: string;
	name?: string;
	body?: string[];
	observerOwner?: string;
}

export async function spawnBusyCreep(shard: ShardFixture, options: BusyCreepOptions = {}): Promise<string> {
	const roomName = options.roomName ?? 'W1N1';
	const owner = options.owner ?? 'p1';
	const name = options.name ?? 'Busy';
	const body = options.body ?? [MOVE];

	await shard.placeStructure(roomName, {
		pos: [25, 25],
		structureType: STRUCTURE_SPAWN,
		owner,
		store: { energy: 300 },
	});
	if (options.observerOwner !== undefined) {
		await shard.placeCreep(roomName, {
			pos: [20, 20],
			owner: options.observerOwner,
			body: [MOVE],
		});
	}
	await shard.tick();

	const rc = await shard.runPlayer(owner, code`
		Object.values(Game.spawns)[0].spawnCreep(${body}, ${name})
	`);
	if (rc !== 0) throw new Error(`spawnBusyCreep: spawnCreep returned ${rc}`);

	const creeps = await shard.findInRoom(roomName, FIND_CREEPS);
	const creep = creeps.find(candidate => candidate.name === name);
	if (!creep) throw new Error(`spawnBusyCreep: could not find spawning creep '${name}'`);
	return creep.id;
}

interface FatiguedCreepOptions {
	roomName?: string;
	owner?: string;
	observerOwner?: string;
}

export async function placeFatiguedCreep(shard: ShardFixture, options: FatiguedCreepOptions = {}): Promise<string> {
	const roomName = options.roomName ?? 'W1N1';
	const owner = options.owner ?? 'p1';
	const creepId = await shard.placeCreep(roomName, {
		pos: [25, 25],
		owner,
		body: [WORK, WORK, WORK, WORK, WORK, CARRY, MOVE],
	});
	if (options.observerOwner !== undefined) {
		await shard.placeCreep(roomName, {
			pos: [20, 20],
			owner: options.observerOwner,
			body: [MOVE],
		});
	}
	await shard.tick();

	const rc = await shard.runPlayer(owner, code`
		Game.getObjectById(${creepId}).move(TOP)
	`);
	if (rc !== 0) throw new Error(`placeFatiguedCreep: move returned ${rc}`);

	const creep = await shard.expectObject(creepId, 'creep');
	if (creep.fatigue <= 0) throw new Error('placeFatiguedCreep: creep did not become fatigued');
	return creepId;
}
