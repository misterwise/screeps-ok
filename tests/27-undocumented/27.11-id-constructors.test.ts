import {
	describe, test, expect, code,
	MOVE, WORK, CARRY, ATTACK,
	FIND_RUINS, FIND_TOMBSTONES,
	STRUCTURE_ROAD, STRUCTURE_SPAWN, STRUCTURE_WALL,
	RESOURCE_ENERGY,
} from '../../src/index.js';
import type { ShardFixture } from '../../src/fixture.js';
import { idConstructorCases } from '../../src/matrices/id-constructors.js';

type EncodedValue = { defined: false } | { defined: true; value: unknown };

interface ConstructorResult {
	instanceOfRequested: boolean;
	liveId: EncodedValue;
	id: EncodedValue;
	posRoomName: EncodedValue;
	roomName: EncodedValue;
	liveFields: Record<string, EncodedValue>;
	constructedFields: Record<string, EncodedValue>;
}

async function setupCaseObject(shard: ShardFixture, objectType: typeof idConstructorCases[number]['objectType']): Promise<string> {
	switch (objectType) {
		case 'creep': {
			await shard.ownedRoom('p1');
			const id = await shard.placeCreep('W1N1', {
				pos: [25, 25],
				owner: 'p1',
				body: [WORK, MOVE, CARRY],
				name: 'idctor-creep',
				store: { [RESOURCE_ENERGY]: 50 },
				ticksToLive: 1234,
			});
			await shard.tick();
			return id;
		}
		case 'structure': {
			await shard.ownedRoom('p1');
			const id = await shard.placeStructure('W1N1', {
				pos: [26, 25],
				owner: 'p1',
				structureType: STRUCTURE_SPAWN,
				hits: 4321,
			});
			await shard.tick();
			return id;
		}
		case 'site': {
			await shard.ownedRoom('p1');
			const id = await shard.placeSite('W1N1', {
				pos: [27, 25],
				owner: 'p1',
				structureType: STRUCTURE_ROAD,
				progress: 7,
			});
			await shard.tick();
			return id;
		}
		case 'resource': {
			await shard.ownedRoom('p1');
			const id = await shard.placeDroppedResource('W1N1', {
				pos: [28, 25],
				resourceType: RESOURCE_ENERGY,
				amount: 200,
			});
			await shard.tick();
			return id;
		}
		case 'tombstone': {
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
			});
			const attackerId = await shard.placeCreep('W1N1', {
				pos: [25, 25],
				owner: 'p1',
				body: [ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, MOVE],
			});
			const targetId = await shard.placeCreep('W1N1', {
				pos: [25, 26],
				owner: 'p2',
				body: [CARRY, MOVE],
				name: 'fallen-idctor',
			});
			await shard.tick();
			await shard.runPlayer('p1', code`
				Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
			`);
			await shard.tick();
			await shard.tick();
			const tombstones = await shard.findInRoom('W1N1', FIND_TOMBSTONES);
			const tombstone = tombstones.find(t => t.creepName === 'fallen-idctor');
			if (!tombstone) throw new Error('setupCaseObject: expected tombstone was not created');
			return tombstone.id;
		}
		case 'ruin': {
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
			});
			const wallId = await shard.placeStructure('W1N1', {
				pos: [30, 25],
				structureType: STRUCTURE_WALL,
				hits: 1,
			});
			const attackerId = await shard.placeCreep('W1N1', {
				pos: [30, 26],
				owner: 'p1',
				body: [ATTACK, ATTACK, MOVE],
			});
			await shard.tick();
			await shard.runPlayer('p1', code`
				Game.getObjectById(${attackerId}).attack(Game.getObjectById(${wallId}))
			`);
			const ruins = await shard.findInRoom('W1N1', FIND_RUINS);
			const ruin = ruins.find(r => r.pos.x === 30 && r.pos.y === 25);
			if (!ruin) throw new Error('setupCaseObject: expected ruin was not created');
			return ruin.id;
		}
		case 'mineral': {
			await shard.ownedRoom('p1');
			const id = await shard.placeMineral('W1N1', {
				pos: [31, 25],
				mineralType: 'H',
				mineralAmount: 0,
				ticksToRegeneration: 100,
			});
			await shard.tick();
			return id;
		}
		case 'source': {
			await shard.ownedRoom('p1');
			const id = await shard.placeSource('W1N1', {
				pos: [32, 25],
				energy: 1000,
				energyCapacity: 3000,
				ticksToRegeneration: 100,
			});
			await shard.tick();
			return id;
		}
	}
}

describe('Undocumented API Surface — id constructors', () => {
	for (const row of idConstructorCases) {
		test(`${row.catalogId} new ${row.constructorName}(id) reconstructs a ${row.label} view with overlay fields`, async ({ shard }) => {
			const id = await setupCaseObject(shard, row.objectType);

			const result = await shard.runPlayer('p1', code`
				const fields = ${row.fields};
				const Ctor = global[${row.constructorName}];
				const live = Game.getObjectById(${id});
				const constructed = new Ctor(live.id);

				function readPath(obj, path) {
					let value = obj;
					for (const part of path.split('.')) {
						if (value == null) return undefined;
						value = value[part];
					}
					return value;
				}

				function encode(value) {
					return value === undefined
						? { defined: false }
						: { defined: true, value };
				}

				const liveFields = {};
				const constructedFields = {};
				for (const field of fields) {
					liveFields[field] = encode(readPath(live, field));
					constructedFields[field] = encode(readPath(constructed, field));
				}

				({
					instanceOfRequested: constructed instanceof Ctor,
					liveId: encode(live && live.id),
					id: encode(constructed.id),
					posRoomName: encode(constructed.pos && constructed.pos.roomName),
					roomName: encode(constructed.room && constructed.room.name),
					liveFields,
					constructedFields,
				})
			`) as unknown as ConstructorResult;

			expect(result.instanceOfRequested).toBe(true);
			expect(result.id).toEqual(result.liveId);
			expect(result.id).toMatchObject({ defined: true });
			expect(result.posRoomName).toEqual({ defined: true, value: 'W1N1' });
			expect(result.roomName).toEqual({ defined: true, value: 'W1N1' });
			for (const field of row.fields) {
				expect(result.constructedFields[field]).toEqual(result.liveFields[field]);
				expect(result.constructedFields[field]).toMatchObject({ defined: true });
			}
		});
	}

	test('UNDOC-IDCTOR-002 new Creep(Memory.targetId) in a later tick exposes live overlay fields', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25],
			owner: 'p1',
			body: [WORK, WORK, WORK, MOVE],
			name: 'memory-target',
			ticksToLive: 1200,
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			Memory.targetId = creep.id;
			creep.move(TOP);
		`);

		const result = await shard.runPlayer('p1', code`
			const live = Game.getObjectById(Memory.targetId);
			const constructed = new Creep(Memory.targetId);
			({
				instanceOfCreep: constructed instanceof Creep,
				id: constructed.id,
				live: {
					id: live.id,
					name: live.name,
					hits: live.hits,
					hitsMax: live.hitsMax,
					fatigue: live.fatigue,
					ticksToLive: live.ticksToLive,
					bodyLength: live.body.length,
					x: live.pos.x,
					y: live.pos.y,
				},
				constructed: {
					id: constructed.id,
					name: constructed.name,
					hits: constructed.hits,
					hitsMax: constructed.hitsMax,
					fatigue: constructed.fatigue,
					ticksToLive: constructed.ticksToLive,
					bodyLength: constructed.body.length,
					x: constructed.pos.x,
					y: constructed.pos.y,
				},
			})
		`) as {
			instanceOfCreep: boolean;
			id: string;
			live: Record<string, unknown>;
			constructed: Record<string, unknown>;
		};

		expect(result.instanceOfCreep).toBe(true);
		expect(result.id).toBe(result.live.id);
		expect(result.constructed).toEqual(result.live);
		expect(result.constructed.fatigue).toBeGreaterThan(0);
	});

	test('UNDOC-IDCTOR-003 new Creep(structureId) returns a Creep view and does not validate the target type', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25],
			owner: 'p1',
			structureType: STRUCTURE_SPAWN,
			hits: 4321,
		});
		await shard.tick();

			const result = await shard.runPlayer('p1', code`
				const spawn = Game.getObjectById(${spawnId});
				const constructed = new Creep(spawn.id);
			({
				instanceOfCreep: constructed instanceof Creep,
				id: constructed.id,
				name: constructed.name,
				hits: constructed.hits,
				hitsMax: constructed.hitsMax,
				fatigueIsUndefined: constructed.fatigue === undefined,
				ticksToLiveIsUndefined: constructed.ticksToLive === undefined,
				spawn: {
					id: spawn.id,
					name: spawn.name,
					hits: spawn.hits,
					hitsMax: spawn.hitsMax,
				},
			})
		`) as {
			instanceOfCreep: boolean;
			id: string;
			name: string;
			hits: number;
			hitsMax: number;
			fatigueIsUndefined: boolean;
			ticksToLiveIsUndefined: boolean;
			spawn: { id: string; name: string; hits: number; hitsMax: number };
		};

		expect(result.instanceOfCreep).toBe(true);
		expect(result.id).toBe(result.spawn.id);
		expect(result.name).toBe(result.spawn.name);
		expect(result.hits).toBe(result.spawn.hits);
		expect(result.hitsMax).toBe(result.spawn.hitsMax);
		expect(result.fatigueIsUndefined).toBe(true);
		expect(result.ticksToLiveIsUndefined).toBe(true);
	});

	test('UNDOC-IDCTOR-004 writes to a constructed Creep view do not mutate the canonical live object', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25],
			owner: 'p1',
			body: [WORK, MOVE],
			name: 'write-target',
		});
		await shard.tick();

			const result = await shard.runPlayer('p1', code`
				const liveBefore = Game.getObjectById(${creepId});
				const constructed = new Creep(liveBefore.id);

			constructed._marker = 'from-constructed';
			constructed.fatigue = 123;
			constructed.hits = 77;

			const liveAfter = Game.getObjectById(${creepId});
			({
				sameBefore: liveBefore === constructed,
				sameAfter: liveAfter === constructed,
				liveBefore: {
					fatigue: liveBefore.fatigue,
					hits: liveBefore.hits,
					markerIsUndefined: liveBefore._marker === undefined,
				},
				constructed: {
					fatigue: constructed.fatigue,
					hits: constructed.hits,
					marker: constructed._marker,
				},
				liveAfter: {
					fatigue: liveAfter.fatigue,
					hits: liveAfter.hits,
					markerIsUndefined: liveAfter._marker === undefined,
				},
			})
		`) as {
			sameBefore: boolean;
			sameAfter: boolean;
			liveBefore: { fatigue: number; hits: number; markerIsUndefined: boolean };
			constructed: { fatigue: number; hits: number; marker: string };
			liveAfter: { fatigue: number; hits: number; markerIsUndefined: boolean };
		};

		expect(result.sameBefore).toBe(false);
		expect(result.sameAfter).toBe(false);
		expect(result.constructed.marker).toBe('from-constructed');
		expect(result.liveBefore.markerIsUndefined).toBe(true);
		expect(result.liveAfter.markerIsUndefined).toBe(true);
		expect(result.constructed.fatigue).toBe(result.liveBefore.fatigue);
		expect(result.constructed.hits).toBe(result.liveBefore.hits);
		expect(result.liveAfter.fatigue).toBe(result.liveBefore.fatigue);
		expect(result.liveAfter.hits).toBe(result.liveBefore.hits);
	});
});
