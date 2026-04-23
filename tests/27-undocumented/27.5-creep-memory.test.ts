import { describe, test, expect, code, MOVE } from '../../src/index.js';

describe('Undocumented API Surface — creep.memory accessor', () => {
	test('UNDOC-CREEPMEM-001 creep.memory and Memory.creeps[name] are aliased within a tick', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE], name: 'worker',
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			Memory.creeps = Memory.creeps || {};
			Memory.creeps.worker = Memory.creeps.worker || {};

			Game.creeps['worker'].memory.viaCreep = 'A';
			const readViaMemory = Memory.creeps['worker'].viaCreep;

			Memory.creeps['worker'].viaMemory = 'B';
			const readViaCreep = Game.creeps['worker'].memory.viaMemory;

			Game.creeps['worker'].memory.shared = { n: 1 };
			const sameRef = Game.creeps['worker'].memory.shared === Memory.creeps['worker'].shared;

			({ readViaMemory, readViaCreep, sameRef })
		`) as { readViaMemory: unknown; readViaCreep: unknown; sameRef: boolean };

		expect(result.readViaMemory).toBe('A');
		expect(result.readViaCreep).toBe('B');
		expect(result.sameRef).toBe(true);
	});

	test('UNDOC-CREEPMEM-002 deleting Memory.creeps[name] makes creep.memory read as an empty object that writes back', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE], name: 'worker',
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			Memory.creeps = Memory.creeps || {};
			Memory.creeps.worker = { existing: 'value' };

			delete Memory.creeps['worker'];
			const immediateAfterDelete = Memory.creeps['worker'];

			const mem = Game.creeps['worker'].memory;
			const memIsObject = mem !== null && typeof mem === 'object';
			const memIsEmpty = Object.keys(mem).length === 0;

			Game.creeps['worker'].memory.written = 'back';
			const roundTrip = Memory.creeps['worker'] && Memory.creeps['worker'].written;

			({
				immediateAfterDelete: typeof immediateAfterDelete,
				memIsObject,
				memIsEmpty,
				roundTrip,
			})
		`) as {
			immediateAfterDelete: string;
			memIsObject: boolean;
			memIsEmpty: boolean;
			roundTrip: unknown;
		};

		expect(result.immediateAfterDelete).toBe('undefined');
		expect(result.memIsObject).toBe(true);
		expect(result.memIsEmpty).toBe(true);
		expect(result.roundTrip).toBe('back');
	});
});
