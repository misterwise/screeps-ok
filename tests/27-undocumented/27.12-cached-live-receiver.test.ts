import { describe, test, expect, code, OK, WORK, CARRY, MOVE, TOP } from '../../src/index.js';

// Counterpart to the destroyed-receiver matrix (§27.12): a cached wrapper whose
// backing object STILL EXISTS next tick stays usable — reads and actions both work.
describe('cached live receiver across ticks', () => {
	test('UNDOC-STALERECV-002 a read method on a creep cached last tick returns its value (no throw)', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 3, owner: 'p1' }],
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [WORK, CARRY, MOVE],
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			globalThis.__okCachedCreep = Game.getObjectById(${creepId}); true
		`);
		await shard.tick();

		const activeWork = await shard.runPlayer('p1', code`
			globalThis.__okCachedCreep.getActiveBodyparts(${WORK})
		`);
		expect(activeWork).toBe(1);
	});

	test('UNDOC-STALERECV-002 an action on a creep cached last tick dispatches and executes', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 3, owner: 'p1' }],
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [WORK, CARRY, MOVE],
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			globalThis.__okCachedCreep2 = Game.getObjectById(${creepId}); true
		`);
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			globalThis.__okCachedCreep2.move(${TOP})
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		// The intent is not silently dropped: the creep actually moved.
		const pos = await shard.runPlayer('p1', code`
			(function () { const c = Game.getObjectById(${creepId}); return [c.pos.x, c.pos.y]; })()
		`);
		expect(pos).toEqual([25, 24]);
	});
});
