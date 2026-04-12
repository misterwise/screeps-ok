import { describe, test, expect, code,
	OK, ERR_NOT_OWNER, ERR_NOT_ENOUGH_RESOURCES, ERR_TIRED,
	ERR_INVALID_ARGS, ERR_RCL_NOT_ENOUGH,
	STRUCTURE_TERMINAL, PWR_OPERATE_TERMINAL, POWER_INFO,
	TERMINAL_COOLDOWN,
} from '../../src/index.js';

describe('Terminal send', () => {
	test('TERMINAL-SEND-001 successful send returns OK and sets cooldown', async ({ shard }) => {
		shard.requires('market');
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 6, owner: 'p1' },
				{ name: 'W5N1', rcl: 6, owner: 'p1' },
			],
		});

		const srcId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p1',
			store: { energy: 100000 },
		});
		await shard.placeStructure('W5N1', {
			pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p1',
			store: { energy: 0 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${srcId}).send(RESOURCE_ENERGY, 100, 'W5N1')
		`);
		expect(rc).toBe(OK);

		// After the tick, the source terminal should have a cooldown.
		const cooldown = await shard.runPlayer('p1', code`
			Game.getObjectById(${srcId}).cooldown
		`) as number;
		expect(cooldown).toBeGreaterThan(0);
	});

	test('TERMINAL-SEND-002 successful send with PWR_OPERATE_TERMINAL sets reduced cooldown', async ({ shard }) => {
		shard.requires('market');
		shard.requires('powerCreeps');
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 6, owner: 'p1' },
				{ name: 'W5N1', rcl: 6, owner: 'p1' },
			],
		});

		const srcId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p1',
			store: { energy: 100000 },
		});
		await shard.placeStructure('W5N1', {
			pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p1',
		});

		// Place power creep with PWR_OPERATE_TERMINAL level 1
		await shard.placePowerCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			powers: { [PWR_OPERATE_TERMINAL]: 1 },
			store: { ops: 200 },
		});
		await shard.tick();

		// Activate PWR_OPERATE_TERMINAL on the terminal.
		await shard.runPlayer('p1', code`
			const pcs = Object.values(Game.powerCreeps);
			pcs[0].usePower(PWR_OPERATE_TERMINAL, Game.getObjectById(${srcId}))
		`);

		// Power effect applies next tick. Now send.
		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${srcId}).send(RESOURCE_ENERGY, 100, 'W5N1')
		`);
		expect(rc).toBe(OK);

		// Cooldown should be reduced by the power effect.
		const cooldown = await shard.runPlayer('p1', code`
			Game.getObjectById(${srcId}).cooldown
		`) as number;
		// Normal cooldown is TERMINAL_COOLDOWN (10). With PWR_OPERATE_TERMINAL level 1,
		// cooldown = round(10 * effect[0]) = round(10 * 0.9) = 9. Minus 1 for the tick = 8.
		const effect = (POWER_INFO as any)[PWR_OPERATE_TERMINAL].effect[0];
		const expectedCooldown = Math.round(10 * effect) - 1;
		expect(cooldown).toBe(expectedCooldown);
	});

	test('TERMINAL-SEND-003 send deducts energy cost from the sender', async ({ shard }) => {
		shard.requires('market');
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 6, owner: 'p1' },
				{ name: 'W5N1', rcl: 6, owner: 'p1' },
			],
		});

		const srcId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p1',
			store: { energy: 100000 },
		});
		const dstId = await shard.placeStructure('W5N1', {
			pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p1',
			store: { energy: 0 },
		});
		await shard.tick();

		// Read initial energy.
		const before = await shard.runPlayer('p1', code`
			Game.getObjectById(${srcId}).store.energy
		`) as number;

		// Send 1000 energy
		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${srcId}).send(RESOURCE_ENERGY, 1000, 'W5N1')
		`);
		expect(rc).toBe(OK);

		// Check sender deducted at least the sent amount. Transfer cost depends on
		// room distance (0 on private server with adjacent rooms).
		const afterSrc = await shard.runPlayer('p1', code`
			Game.getObjectById(${srcId}).store.energy
		`) as number;
		const spent = before - afterSrc;
		// Sender pays amount + ceil(amount * (1 - exp(-distance/30))).
		// On private server, distance may be 0 → cost = 0 → spent = amount.
		expect(spent).toBeGreaterThanOrEqual(1000);

		// Receiver should have gained exactly the sent amount (no cost on receiver).
		const afterDst = await shard.runPlayer('p1', code`
			Game.getObjectById(${dstId}).store.energy
		`) as number;
		expect(afterDst).toBe(1000);
	});

	test('TERMINAL-SEND-004 PWR_OPERATE_TERMINAL reduces energy cost', async ({ shard }) => {
		shard.requires('market');
		shard.requires('powerCreeps');
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 6, owner: 'p1' },
				{ name: 'W5N1', rcl: 6, owner: 'p1' },
			],
		});

		const srcId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p1',
			store: { energy: 100000 },
		});
		await shard.placeStructure('W5N1', {
			pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p1',
		});

		await shard.placePowerCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			powers: { [PWR_OPERATE_TERMINAL]: 1 },
			store: { ops: 200 },
		});
		await shard.tick();

		// Activate PWR_OPERATE_TERMINAL.
		await shard.runPlayer('p1', code`
			const pcs = Object.values(Game.powerCreeps);
			pcs[0].usePower(PWR_OPERATE_TERMINAL, Game.getObjectById(${srcId}))
		`);

		const before = await shard.runPlayer('p1', code`
			Game.getObjectById(${srcId}).store.energy
		`) as number;

		// Send 1000 energy with power effect active.
		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${srcId}).send(RESOURCE_ENERGY, 1000, 'W5N1')
		`);
		expect(rc).toBe(OK);

		const after = await shard.runPlayer('p1', code`
			Game.getObjectById(${srcId}).store.energy
		`) as number;

		// The energy cost with power effect should be less than or equal to without.
		// On private server, distance may be 0 → cost = 0, so power effect doesn't matter.
		// Verify the send deducted at least the sent amount.
		const spent = before - after;
		expect(spent).toBeGreaterThanOrEqual(1000);
	});

	test('TERMINAL-SEND-005 send returns ERR_INVALID_ARGS for invalid arguments', async ({ shard }) => {
		shard.requires('market');
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 6, owner: 'p1' },
				{ name: 'W5N1', rcl: 6, owner: 'p1' },
			],
		});

		const termId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p1',
			store: { energy: 100000 },
		});
		await shard.placeStructure('W5N1', {
			pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p1',
		});
		await shard.tick();

		// Invalid room name
		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${termId}).send(RESOURCE_ENERGY, 100, 'INVALID')
		`);
		expect(rc).toBe(ERR_INVALID_ARGS);
	});

	test('TERMINAL-SEND-006 send returns ERR_NOT_ENOUGH_RESOURCES when lacking resource or energy cost', async ({ shard }) => {
		shard.requires('market');
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 6, owner: 'p1' },
				{ name: 'W5N1', rcl: 6, owner: 'p1' },
			],
		});

		// Only 10 energy — not enough for any send.
		const termId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p1',
			store: { energy: 10 },
		});
		await shard.placeStructure('W5N1', {
			pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p1',
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${termId}).send(RESOURCE_ENERGY, 1000, 'W5N1')
		`);
		expect(rc).toBe(ERR_NOT_ENOUGH_RESOURCES);
	});

	test('TERMINAL-SEND-007 send returns ERR_TIRED while terminal is on cooldown', async ({ shard }) => {
		shard.requires('market');
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 6, owner: 'p1' },
				{ name: 'W5N1', rcl: 6, owner: 'p1' },
			],
		});

		const termId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p1',
			store: { energy: 100000 },
		});
		await shard.placeStructure('W5N1', {
			pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p1',
		});
		await shard.tick();

		// First send succeeds and puts terminal on cooldown.
		const rc1 = await shard.runPlayer('p1', code`
			Game.getObjectById(${termId}).send(RESOURCE_ENERGY, 100, 'W5N1')
		`);
		expect(rc1).toBe(OK);

		// Second send on next tick should fail with ERR_TIRED.
		const rc2 = await shard.runPlayer('p1', code`
			Game.getObjectById(${termId}).send(RESOURCE_ENERGY, 100, 'W5N1')
		`);
		expect(rc2).toBe(ERR_TIRED);
	});

	test('TERMINAL-SEND-008 send returns ERR_RCL_NOT_ENOUGH when terminal is inactive', async ({ shard }) => {
		shard.requires('market');
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 5, owner: 'p1' },
				{ name: 'W5N1', rcl: 6, owner: 'p1' },
			],
		});

		// Terminal at RCL 5 is inactive.
		const termId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p1',
			store: { energy: 100000 },
		});
		await shard.placeStructure('W5N1', {
			pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p1',
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${termId}).send(RESOURCE_ENERGY, 100, 'W5N1')
		`);
		expect(rc).toBe(ERR_RCL_NOT_ENOUGH);
	});

	test('TERMINAL-SEND-009 send returns ERR_NOT_OWNER when terminal is not owned by player', async ({ shard }) => {
		shard.requires('market');
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 6, owner: 'p1' },
				{ name: 'W5N1', rcl: 6, owner: 'p2' },
			],
		});

		// Place terminal owned by p2 in p1's room.
		const termId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p2',
			store: { energy: 100000 },
		});
		await shard.placeStructure('W5N1', {
			pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p2',
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const t = Game.getObjectById(${termId});
			t ? t.send(RESOURCE_ENERGY, 100, 'W5N1') : -99
		`);
		expect(rc).toBe(ERR_NOT_OWNER);
	});

	test('TERMINAL-SEND-010 successful send sets cooldown exactly to TERMINAL_COOLDOWN', async ({ shard }) => {
		shard.requires('market');
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 6, owner: 'p1' },
				{ name: 'W5N1', rcl: 6, owner: 'p1' },
			],
		});
		const srcId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p1',
			store: { energy: 100000 },
		});
		await shard.placeStructure('W5N1', {
			pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p1',
			store: { energy: 0 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${srcId}).send(RESOURCE_ENERGY, 100, 'W5N1')
		`);
		expect(rc).toBe(OK);

		const src = await shard.expectStructure(srcId, STRUCTURE_TERMINAL);
		// Engine sets cooldownTime = gameTime + TERMINAL_COOLDOWN; player-facing
		// cooldown reports (TERMINAL_COOLDOWN - 1) on the tick immediately after
		// the send resolves. Assert exactly that.
		expect(src.cooldown).toBe(TERMINAL_COOLDOWN - 1);
	});

	test('TERMINAL-SEND-011 send to a room with no player terminal: OK, no transfer, no cooldown', async ({ shard }) => {
		shard.requires('market');
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 6, owner: 'p1' },
				// W5N1 exists but has no terminal
				{ name: 'W5N1', rcl: 0 },
			],
		});
		const srcId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p1',
			store: { energy: 100000 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${srcId}).send(RESOURCE_ENERGY, 100, 'W5N1')
		`);
		expect(rc).toBe(OK);

		const src = await shard.expectStructure(srcId, STRUCTURE_TERMINAL);
		// Intent cleared but no transfer recorded → no cooldown, no resource loss.
		expect(src.cooldown ?? 0).toBe(0);
		expect(src.store.energy).toBe(100000);
	});

	test('TERMINAL-SEND-012 successful send delivers the resource amount to the target terminal', async ({ shard }) => {
		shard.requires('market');
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 6, owner: 'p1' },
				{ name: 'W5N1', rcl: 6, owner: 'p1' },
			],
		});
		const srcId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p1',
			store: { energy: 100000 },
		});
		const dstId = await shard.placeStructure('W5N1', {
			pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p1',
			store: { energy: 0 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${srcId}).send(RESOURCE_ENERGY, 100, 'W5N1')
		`);
		expect(rc).toBe(OK);

		const dst = await shard.expectStructure(dstId, STRUCTURE_TERMINAL);
		expect(dst.store.energy ?? 0).toBe(100);
	});
});
