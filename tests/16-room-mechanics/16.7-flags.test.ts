import { describe, test, expect, code,
	OK, COLOR_RED, COLOR_BLUE, COLOR_GREEN, COLOR_WHITE,
	FLAGS_LIMIT,
} from '../../src/index.js';
import { flagCreateValidationCases } from '../../src/matrices/flag-create-validation.js';

// COLOR_WHITE is the last color constant (COLORS_ALL runs 1-10).
const NOT_A_COLOR = COLOR_WHITE + 1;

describe('Flags', () => {
	test('FLAG-001 Room.createFlag creates a flag visible in Game.flags for the creating player only', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});

		const rc = await shard.runPlayer('p1', code`Game.rooms['W1N1'].createFlag(25, 25, 'alpha')`);
		expect(rc).toBe('alpha');
		const seen = await shard.runPlayers({
			p1: code`const flag = Game.flags.alpha; flag && [flag.name, flag.pos.x, flag.pos.y, flag.pos.roomName]`,
			p2: code`Game.flags.alpha ?? null`,
		});
		expect(seen).toEqual({ p1: ['alpha', 25, 25, 'W1N1'], p2: null });
	});

	test('FLAG-002 a created flag stores name, color, and secondaryColor', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const rc = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].createFlag(10, 10, 'colored', COLOR_RED, COLOR_BLUE)
		`);
		expect(rc).toBe('colored');
		// The next tick reads the stored flag.
		const stored = await shard.runPlayer('p1', code`
			const flag = Game.flags['colored'];
			[flag.name, flag.color, flag.secondaryColor]
		`);
		expect(stored).toEqual(['colored', COLOR_RED, COLOR_BLUE]);
	});

	test('FLAG-004 Flag.remove() removes the flag from the player flag set', async ({ shard }) => {
		await shard.ownedRoom('p1');

		// Create the flag.
		await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].createFlag(10, 10, 'toRemove');
			'ok'
		`);

		// Remove it — returns OK (intent submitted).
		const rc = await shard.runPlayer('p1', code`
			Game.flags['toRemove'].remove()
		`);
		expect(rc).toBe(OK);

		// After the tick processes the remove intent, the flag should be gone.
		const stillExists = await shard.runPlayer('p1', code`
			!!Game.flags['toRemove']
		`);
		expect(stillExists).toBe(false);
	});

	test('FLAG-005 Flag.setColor updates the flag color and secondaryColor', async ({ shard }) => {
		await shard.ownedRoom('p1');

		await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].createFlag(10, 10, 'recolor', COLOR_RED, COLOR_RED);
			'ok'
		`);

		// setColor submits an intent — observe on next tick.
		const rc = await shard.runPlayer('p1', code`
			Game.flags['recolor'].setColor(COLOR_GREEN, COLOR_WHITE)
		`);
		expect(rc).toBe(OK);

		const result = await shard.runPlayer('p1', code`
			const flag = Game.flags['recolor'];
			({ color: flag.color, secondary: flag.secondaryColor })
		`) as { color: number; secondary: number };
		expect(result.color).toBe(COLOR_GREEN);
		expect(result.secondary).toBe(COLOR_WHITE);
	});

	test('FLAG-006 Flag.setPosition moves the flag to the requested room position', async ({ shard }) => {
		await shard.ownedRoom('p1');

		await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].createFlag(10, 10, 'movable');
			'ok'
		`);

		// setPosition submits an intent — observe on next tick.
		const rc = await shard.runPlayer('p1', code`
			Game.flags['movable'].setPosition(30, 35)
		`);
		expect(rc).toBe(OK);

		const result = await shard.runPlayer('p1', code`
			const flag = Game.flags['movable'];
			({ x: flag.pos.x, y: flag.pos.y })
		`) as { x: number; y: number };
		expect(result.x).toBe(30);
		expect(result.y).toBe(35);
	});

	for (const row of flagCreateValidationCases) {
		test(`FLAG-009:${row.label} createFlag() validation returns the canonical code`, async ({ shard }) => {
			await shard.ownedRoom('p1');
			const blockers = shard.validationBlockers(row);
			const name = blockers.has('invalid-name-length')
				? 'x'.repeat(101)
				: blockers.has('name-exists') || blockers.has('name-created')
					? 'dup'
					: 'flag';
			if (blockers.has('name-exists')) {
				await shard.placeFlag('W1N1', {
					pos: [10, 10],
					owner: 'p1',
					name,
				});
			}
			const x = blockers.has('invalid-coords') ? -1 : 25;
			const color = blockers.has('invalid-color') ? NOT_A_COLOR : COLOR_RED;
			const secondaryColor = blockers.has('invalid-secondary-color') ? NOT_A_COLOR : COLOR_BLUE;

			const rc = await shard.runPlayer('p1', code`
				if (${blockers.has('name-created')}) Game.rooms['W1N1'].createFlag(10, 10, ${name});
				if (${blockers.has('flag-cap-full')}) {
					for (let i = 0; i < ${FLAGS_LIMIT}; i++) Game.flags['stub' + i] = {};
				}
				Game.rooms['W1N1'].createFlag(${x}, 25, ${name}, ${color}, ${secondaryColor})
			`);
			expect(rc).toBe(row.expectedRc);
		});
	}

	test('FLAG-010 RoomPosition.createFlag without room visibility throws before validation', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1' },
			],
		});
		await shard.tick();

		const err = await shard.expectRunPlayerError('p1', code`
			new RoomPosition(25, 25, 'W2N1').createFlag(${'x'.repeat(101)}, 99, 99)
		`, 'runtime');
		expect(err.engineMessage).toMatch(/Could not access room W2N1/);
	});
});
