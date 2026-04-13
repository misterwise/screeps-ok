import { describe, test, expect, code,
	OK,
	PWR_OPERATE_TOWER, PWR_DISRUPT_TOWER,
	STRUCTURE_TOWER,
} from '../../src/index.js';

describe('Tower power effects', () => {
	test('TOWER-POWER-001 PWR_OPERATE_TOWER modifies tower power', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});

		const towerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
			store: { energy: 1000 },
		});
		await shard.placePowerCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			powers: { [PWR_OPERATE_TOWER]: 1 },
			store: { ops: 200 },
		});
		await shard.tick();

		// Activate PWR_OPERATE_TOWER and verify the effect lands on the tower.
		const rc = await shard.runPlayer('p1', code`
			const pc = Object.values(Game.powerCreeps)[0];
			pc.usePower(PWR_OPERATE_TOWER, Game.getObjectById(${towerId}))
		`);
		expect(rc).toBe(OK);

		const effects = await shard.runPlayer('p1', code`
			const tower = Game.getObjectById(${towerId});
			tower.effects ? tower.effects.map(e => ({ effect: e.effect, level: e.level })) : []
		`) as Array<{ effect: number; level: number }>;
		const opEffect = effects.find(e => e.effect === PWR_OPERATE_TOWER);
		expect(opEffect).toBeDefined();
		expect(opEffect!.level).toBe(1);
	});

	test('TOWER-POWER-002 PWR_OPERATE_TOWER and PWR_DISRUPT_TOWER can coexist on same tower', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});

		const towerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
			store: { energy: 1000 },
		});
		// Place two power creeps — one for operate, one for disrupt.
		await shard.placePowerCreep('W1N1', {
			pos: [25, 26], owner: 'p1', name: 'Operator',
			powers: { [PWR_OPERATE_TOWER]: 1 },
			store: { ops: 200 },
		});
		await shard.placePowerCreep('W1N1', {
			pos: [25, 27], owner: 'p1', name: 'Disruptor',
			powers: { [PWR_DISRUPT_TOWER]: 1 },
			store: { ops: 200 },
		});
		await shard.tick();

		// Apply operate.
		await shard.runPlayer('p1', code`
			const pcs = Object.values(Game.powerCreeps);
			const op = pcs.find(p => p.name === 'Operator');
			op.usePower(PWR_OPERATE_TOWER, Game.getObjectById(${towerId}))
		`);

		// Apply disrupt.
		await shard.runPlayer('p1', code`
			const pcs = Object.values(Game.powerCreeps);
			const dis = pcs.find(p => p.name === 'Disruptor');
			dis.usePower(PWR_DISRUPT_TOWER, Game.getObjectById(${towerId}))
		`);

		// Both effects should be present.
		const effects = await shard.runPlayer('p1', code`
			const tower = Game.getObjectById(${towerId});
			tower.effects ? tower.effects.map(e => e.effect).sort() : []
		`) as number[];
		expect(effects).toContain(PWR_OPERATE_TOWER);
		expect(effects).toContain(PWR_DISRUPT_TOWER);
	});
});
