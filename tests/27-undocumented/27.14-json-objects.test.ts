import {
	describe, test, expect, code,
	MOVE, WORK, CARRY,
	COLOR_BLUE, COLOR_RED,
	RESOURCE_ENERGY, RESOURCE_SILICON,
	STRUCTURE_ROAD, STRUCTURE_SPAWN, STRUCTURE_TOWER,
} from '../../src/index.js';
import type { ShardFixture } from '../../src/fixture.js';
import { jsonObjectCases } from '../../src/matrices/json-objects.js';
import type { JsonObjectCaseKey } from '../../src/matrices/json-objects.js';

type EncodedValue = { defined: false } | { defined: true; value: unknown };

interface JsonSerializationResult {
	present: boolean;
	threw: boolean;
	error: string | null;
	stringType: string;
	parsedType: string;
	liveFields: Record<string, EncodedValue>;
	parsedFields: Record<string, EncodedValue>;
}

async function setupJsonObjectCase(shard: ShardFixture, key: JsonObjectCaseKey): Promise<string> {
	switch (key) {
		case 'room':
			await shard.ownedRoom('p1', 'W1N1', 3);
			await shard.tick();
			return "Game.rooms['W1N1']";

		case 'roomPosition':
			await shard.ownedRoom('p1');
			await shard.tick();
			return "new RoomPosition(24, 25, 'W1N1')";

		case 'ownedCreep': {
			await shard.ownedRoom('p1');
			await shard.placeCreep('W1N1', {
				pos: [25, 25],
				owner: 'p1',
				body: [WORK, CARRY, MOVE],
				name: 'json-owned-creep',
				ticksToLive: 1234,
			});
			await shard.tick();
			return "Game.creeps['json-owned-creep']";
		}

		case 'hostileCreep': {
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [{ name: 'W1N1', rcl: 3, owner: 'p1' }],
			});
			await shard.placeCreep('W1N1', {
				pos: [26, 25],
				owner: 'p2',
				body: [WORK, MOVE],
				name: 'json-hostile-creep',
			});
			await shard.tick();
			return "Game.rooms['W1N1'].find(FIND_HOSTILE_CREEPS).find(c => c.name === 'json-hostile-creep')";
		}

		case 'controller':
			await shard.ownedRoom('p1', 'W1N1', 3);
			await shard.tick();
			return "Game.rooms['W1N1'].controller";

		case 'ownedStructure': {
			await shard.ownedRoom('p1', 'W1N1', 3);
			const id = await shard.placeStructure('W1N1', {
				pos: [24, 25],
				structureType: STRUCTURE_TOWER,
				owner: 'p1',
				hits: 1234,
			});
			await shard.tick();
			return `Game.getObjectById(${JSON.stringify(id)})`;
		}

		case 'hostileStructure': {
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [{ name: 'W1N1', rcl: 3, owner: 'p1' }],
			});
			const id = await shard.placeStructure('W1N1', {
				pos: [24, 26],
				structureType: STRUCTURE_TOWER,
				owner: 'p2',
				hits: 2345,
			});
			await shard.tick();
			return `Game.getObjectById(${JSON.stringify(id)})`;
		}

		case 'source': {
			await shard.ownedRoom('p1');
			const id = await shard.placeSource('W1N1', {
				pos: [20, 20],
				energy: 1500,
				energyCapacity: 3000,
			});
			await shard.tick();
			return `Game.getObjectById(${JSON.stringify(id)})`;
		}

		case 'mineral': {
			await shard.ownedRoom('p1');
			const id = await shard.placeMineral('W1N1', {
				pos: [21, 20],
				mineralType: 'H',
				mineralAmount: 50000,
			});
			await shard.tick();
			return `Game.getObjectById(${JSON.stringify(id)})`;
		}

		case 'droppedResource': {
			await shard.ownedRoom('p1');
			const id = await shard.placeDroppedResource('W1N1', {
				pos: [22, 20],
				resourceType: RESOURCE_ENERGY,
				amount: 200,
			});
			await shard.tick();
			return `Game.getObjectById(${JSON.stringify(id)})`;
		}

		case 'constructionSite': {
			await shard.ownedRoom('p1');
			const id = await shard.placeSite('W1N1', {
				pos: [23, 20],
				owner: 'p1',
				structureType: STRUCTURE_ROAD,
				progress: 7,
			});
			await shard.tick();
			return `Game.getObjectById(${JSON.stringify(id)})`;
		}

		case 'flag':
			await shard.ownedRoom('p1');
			await shard.placeFlag('W1N1', {
				pos: [24, 20],
				owner: 'p1',
				name: 'json-flag',
				color: COLOR_RED,
				secondaryColor: COLOR_BLUE,
			});
			await shard.tick();
			return "Game.flags['json-flag']";

		case 'tombstone': {
			await shard.ownedRoom('p1');
			const id = await shard.placeTombstone('W1N1', {
				pos: [25, 20],
				creepName: 'json-fallen',
				store: { [RESOURCE_ENERGY]: 50 },
				ticksToDecay: 100,
			});
			await shard.tick();
			return `Game.getObjectById(${JSON.stringify(id)})`;
		}

		case 'ruin': {
			await shard.ownedRoom('p1');
			const id = await shard.placeRuin('W1N1', {
				pos: [26, 20],
				structureType: STRUCTURE_SPAWN,
				structureOwner: 'p1',
				store: { [RESOURCE_ENERGY]: 100 },
				ticksToDecay: 200,
			});
			await shard.tick();
			return `Game.getObjectById(${JSON.stringify(id)})`;
		}

		case 'deposit': {
			await shard.ownedRoom('p1');
			const id = await shard.placeObject('W1N1', 'deposit', {
				pos: [27, 20],
				depositType: RESOURCE_SILICON,
			});
			await shard.tick();
			return `Game.getObjectById(${JSON.stringify(id)})`;
		}

		case 'nuke': {
			await shard.ownedRoom('p1');
			const id = await shard.placeNuke('W1N1', {
				pos: [28, 20],
				launchRoomName: 'W2N1',
				timeToLand: 100,
			});
			await shard.tick();
			return `Game.getObjectById(${JSON.stringify(id)})`;
		}

		case 'ownedPowerCreep': {
			await shard.ownedRoom('p1', 'W1N1', 8);
			const id = await shard.placePowerCreep('W1N1', {
				pos: [29, 20],
				owner: 'p1',
				name: 'json-owned-power',
				powers: {},
				store: { ops: 10 },
			});
			await shard.tick();
			return `Game.getObjectById(${JSON.stringify(id)})`;
		}

		case 'hostilePowerCreep': {
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
			});
			const id = await shard.placePowerCreep('W1N1', {
				pos: [30, 20],
				owner: 'p2',
				name: 'json-hostile-power',
				powers: {},
				store: { ops: 10 },
			});
			await shard.tick();
			return `Game.getObjectById(${JSON.stringify(id)})`;
		}
	}
}

describe('Undocumented API Surface — game object JSON serialization', () => {
	for (const row of jsonObjectCases) {
		test(`${row.catalogId} ${row.key} JSON.stringify(${row.label}) returns a plain snapshot`, async ({ shard }) => {
			if (row.requiredCapability) shard.requires(row.requiredCapability);

			const selector = await setupJsonObjectCase(shard, row.key);
			const result = await shard.runPlayer('p1', code`
				const selector = ${selector};
				const fields = ${row.fields};
				const value = eval(selector);

				function readPath(obj, path) {
					let current = obj;
					for (const part of path.split('.')) {
						if (current == null) return undefined;
						current = current[part];
					}
					return current;
				}

				function encode(value) {
					return value === undefined
						? { defined: false }
						: { defined: true, value };
				}

				function collectFields(obj) {
					const out = {};
					for (const field of fields) {
						out[field] = encode(readPath(obj, field));
					}
					return out;
				}

				let stringified;
				let parsed;
				let error = null;
				try {
					stringified = JSON.stringify(value);
					parsed = JSON.parse(stringified);
				} catch (err) {
					error = err && err.message ? err.message : String(err);
				}

				({
					present: value != null,
					threw: error !== null,
					error,
					stringType: typeof stringified,
					parsedType: parsed === null ? 'null' : Array.isArray(parsed) ? 'array' : typeof parsed,
					liveFields: value == null ? {} : collectFields(value),
					parsedFields: parsed == null ? {} : collectFields(parsed),
				})
			`) as unknown as JsonSerializationResult;

			expect(result.present).toBe(true);
			expect(result.threw, result.error ?? 'JSON.stringify threw').toBe(false);
			expect(result.stringType).toBe('string');
			expect(result.parsedType).toBe('object');
			for (const field of row.fields) {
				expect(result.liveFields[field], field).toMatchObject({ defined: true });
				expect(result.parsedFields[field], field).toEqual(result.liveFields[field]);
			}
		});
	}
});
