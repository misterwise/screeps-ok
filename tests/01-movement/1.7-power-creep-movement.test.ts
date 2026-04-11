import { describe, test, expect, code,
	OK, MOVE,
} from '../../src/index.js';

describe('Power creep movement collision', () => {
	test('MOVE-POWER-001 a power creep loses a movement collision tie to a regular creep', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});

		// A regular creep and a power creep both attempt to move into the same
		// empty tile [25, 24] from opposite sides at equal range.
		// Regular creep at [25, 25] moves TOP.
		// Power creep   at [25, 23] moves BOTTOM.
		// On a tie, power creeps must lose: the regular creep ends on [25, 24]
		// and the power creep stays at [25, 23].
		const regularId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE], name: 'regular',
		});
		await shard.placePowerCreep('W1N1', {
			pos: [25, 23], owner: 'p1', name: 'pc', powers: {}, store: { ops: 10 },
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const reg = Game.creeps['regular'];
			const pc = Game.powerCreeps['pc'];
			({
				regRc: reg.move(TOP),
				pcRc: pc.move(BOTTOM),
			})
		`) as { regRc: number; pcRc: number };
		expect(result.regRc).toBe(OK);
		expect(result.pcRc).toBe(OK);

		// Regular creep wins the tile.
		const regular = await shard.expectObject(regularId, 'creep');
		expect(regular.pos.x).toBe(25);
		expect(regular.pos.y).toBe(24);

		// Power creep is still on its starting tile.
		const pcPos = await shard.runPlayer('p1', code`
			const pc = Game.powerCreeps['pc'];
			pc ? ({ x: pc.pos.x, y: pc.pos.y }) : null
		`) as { x: number; y: number } | null;
		expect(pcPos).not.toBeNull();
		expect(pcPos!.x).toBe(25);
		expect(pcPos!.y).toBe(23);
	});
});
