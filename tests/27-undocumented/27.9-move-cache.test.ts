import { describe, test, expect, code, MOVE, WORK, OK, ERR_TIRED } from '../../src/index.js';

describe('Undocumented API Surface — creep.memory._move (moveTo reusePath cache)', () => {
	test('UNDOC-MOVECACHE-001 moveTo with reusePath > 0 writes _move with path/dest/time/room keys', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE], name: 'walker',
		});
		await shard.tick();

		// game/creeps.js:285-290: the target, the tick, the serialized path and the creep's room.
		const result = await shard.runPlayer('p1', code`
			const creep = Game.creeps['walker'];
			const rc = creep.moveTo(10, 10, { reusePath: 5 });
			const mv = creep.memory._move;
			({ rc, keys: Object.keys(mv).sort(), dest: mv.dest, timeIsTick: mv.time === Game.time, pathIsStr: typeof mv.path === 'string', room: mv.room })
		`);
		expect(result).toEqual({
			rc: OK,
			keys: ['dest', 'path', 'room', 'time'],
			dest: { x: 10, y: 10, room: 'W1N1' },
			timeIsTick: true,
			pathIsStr: true,
			room: 'W1N1',
		});
	});

	test('UNDOC-MOVECACHE-002 _move.path round-trips through Room.deserializePath / Room.serializePath', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE], name: 'walker',
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const creep = Game.creeps['walker'];
			creep.moveTo(10, 10, { reusePath: 5 });
			const path = creep.memory._move.path;
			const deser = Room.deserializePath(path);
			const reser = Room.serializePath(deser);
			({
				hasPath: typeof path === 'string' && path.length > 0,
				deserIsArray: Array.isArray(deser),
				deserHasSteps: Array.isArray(deser) && deser.length > 0,
				stepShape: Array.isArray(deser) && deser[0]
					&& typeof deser[0].x === 'number'
					&& typeof deser[0].y === 'number'
					&& typeof deser[0].direction === 'number',
				roundTripEqual: reser === path,
			})
		`) as {
			hasPath: boolean;
			deserIsArray: boolean;
			deserHasSteps: boolean;
			stepShape: boolean;
			roundTripEqual: boolean;
		};

		expect(result.hasPath).toBe(true);
		expect(result.deserIsArray).toBe(true);
		expect(result.deserHasSteps).toBe(true);
		expect(result.stepShape).toBe(true);
		expect(result.roundTripEqual).toBe(true);
	});

	test('UNDOC-MOVECACHE-003 deleting _move forces moveTo to recompute on the next tick', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE], name: 'walker',
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Game.creeps['walker'].moveTo(10, 10, { reusePath: 20 });
			'ok'
		`);

		const result = await shard.runPlayer('p1', code`
			const creep = Game.creeps['walker'];
			const before = creep.memory._move && creep.memory._move.time;
			delete creep.memory._move;
			creep.moveTo(10, 10, { reusePath: 20 });
			const after = creep.memory._move && creep.memory._move.time;
			({
				beforeWasSet: typeof before === 'number',
				afterIsGameTime: after === Game.time,
			})
		`) as { beforeWasSet: boolean; afterIsGameTime: boolean };

		expect(result.beforeWasSet).toBe(true);
		expect(result.afterIsGameTime).toBe(true);
	});

	test('UNDOC-MOVECACHE-004 fatigued moveTo with reusable path and visualization does not recompute', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, WORK, WORK, WORK, MOVE],
			name: 'walker',
		});
		await shard.tick();

		const initial = await shard.runPlayer('p1', code`
			const creep = Game.creeps['walker'];
			const rc = creep.moveTo(10, 10, { reusePath: 20 });
			({ rc, hasMove: !!creep.memory._move })
		`) as { rc: number; hasMove: boolean };
		expect(initial.rc).toBe(OK);
		expect(initial.hasMove).toBe(true);

		const result = await shard.runPlayer('p1', code`
			Memory.__screepsOkMoveCostCalls = 0;
			const creep = Game.creeps['walker'];
			const target = new RoomPosition(10, 10, 'W1N1');
			const rc = creep.moveTo(target, {
				reusePath: 20,
				visualizePathStyle: { stroke: '#ffffff' },
				costCallback(roomName, matrix) {
					Memory.__screepsOkMoveCostCalls++;
					return matrix;
				},
			});
			({
				rc,
				costCalls: Memory.__screepsOkMoveCostCalls,
				fatigue: creep.fatigue,
				hasMove: !!creep.memory._move,
			})
		`) as { rc: number; costCalls: number; fatigue: number; hasMove: boolean };

		expect(result.fatigue).toBeGreaterThan(0);
		expect(result.hasMove).toBe(true);
		expect(result.rc).toBe(ERR_TIRED);
		expect(result.costCalls).toBe(0);
	});
});
