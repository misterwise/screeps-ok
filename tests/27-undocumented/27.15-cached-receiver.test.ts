import { describe, test, expect, code, OK, WORK, CARRY, MOVE, TOP } from '../../src/index.js';

// Counterpart to UNDOC-STALERECV-001 (a cached receiver whose object was destroyed
// throws). Real bots routinely cache game objects across ticks (creep wrappers,
// structure caches). For an object that STILL EXISTS next tick, vanilla keeps it
// usable: a read returns the object's cached data, and an action records an intent
// keyed by object id. Neither throws. Only a genuinely dangling reference (object
// gone this tick) throws — that case is covered by the STALERECV tests.
describe('UNDOC-STALERECV-002: cached live receiver across ticks', () => {
	test('a read method on a creep cached last tick returns its value (no throw)', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 3, owner: 'p1' }],
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [WORK, CARRY, MOVE],
		});
		await shard.tick();

		// Tick N: cache the live creep on the persistent global.
		await shard.runPlayer('p1', code`
			globalThis.__okCachedCreep = Game.getObjectById(${creepId}); true
		`);
		await shard.tick();

		// Tick N+1: the creep still exists; a read off the cached reference works.
		const activeWork = await shard.runPlayer('p1', code`
			globalThis.__okCachedCreep.getActiveBodyparts(${WORK})
		`);
		expect(activeWork).toBe(1);
	});

	test('an action on a creep cached last tick is accepted (no throw)', async ({ shard }) => {
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

		// The action records an intent keyed by the creep's id against this tick.
		const rc = await shard.runPlayer('p1', code`
			globalThis.__okCachedCreep2.move(${TOP})
		`);
		expect(rc).toBe(OK);
	});
});
