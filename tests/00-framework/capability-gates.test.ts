import { describe, test } from '../../src/index.js';

// DEPOSIT-HARVEST-001's section is tagged `capability:deposit`, which both
// built-in adapters support, so requires() never skips these. Neither is the
// row's real test.
describe('capability gates', () => {
	test.fails('DEPOSIT-HARVEST-001 fails when the test never calls shard.requires(\'deposit\')', async ({ shard }) => {
		await shard.ownedRoom('p1');
	});

	test('DEPOSIT-HARVEST-001 passes when the gate comes from matrix data', async ({ shard }) => {
		for (const entry of [{ cap: 'deposit' as const }]) shard.requires(entry.cap);
		await shard.ownedRoom('p1');
	});
});
