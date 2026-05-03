import {
	ATTACK, HEAL, MOVE, RANGED_ATTACK, TOUGH, WORK,
} from '../index.js';

export const invaderRaidBodies = {
	smallMelee: [
		TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, WORK, ATTACK, MOVE,
	],
	smallRanged: [
		TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, MOVE,
	],
	smallHealer: [
		MOVE, MOVE, MOVE, MOVE, HEAL, HEAL, HEAL, HEAL, HEAL, MOVE,
	],
	bigMelee: [
		TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
		TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
		MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE,
		MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE,
		MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
		WORK, WORK, WORK, WORK, ATTACK, ATTACK, MOVE,
	],
	bigRanged: [
		TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
		MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE,
		MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE,
		MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
		RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
		RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
		RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
		WORK, MOVE,
	],
	bigHealer: [
		MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE,
		MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE,
		MOVE, MOVE, MOVE, MOVE, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL,
		HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL,
		HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, MOVE,
	],
} as const;

export type InvaderRaidBodyKey = keyof typeof invaderRaidBodies;
export type InvaderRaidBoostSet = 'center' | 'nonCenter';

export interface InvaderRaidExpectedCreep {
	readonly body: InvaderRaidBodyKey;
	readonly boosts: InvaderRaidBoostSet | null;
}

export interface InvaderRaidCompositionCase {
	readonly label: string;
	readonly roomName: string;
	readonly coreRoom: string;
	readonly owner?: string;
	readonly rcl?: number;
	readonly exitTiles: ReadonlyArray<readonly [number, number]>;
	readonly random: readonly number[];
	readonly expected: ReadonlyArray<InvaderRaidExpectedCreep>;
}

const nonCenterBoosts: Record<string, string> = {
	[HEAL]: 'LO',
	[RANGED_ATTACK]: 'KO',
	[WORK]: 'ZH',
	[ATTACK]: 'UH',
	[TOUGH]: 'GO',
};

const centerBoosts: Record<string, string> = {
	[HEAL]: 'XLHO2',
	[RANGED_ATTACK]: 'XKHO2',
	[WORK]: 'XZH2O',
	[ATTACK]: 'XUH2O',
	[TOUGH]: 'XGHO2',
};

export function invaderRaidExpectedBody(
	expected: InvaderRaidExpectedCreep,
): Array<{ type: string; boost?: string }> {
	const boosts = expected.boosts === 'center' ? centerBoosts
		: expected.boosts === 'nonCenter' ? nonCenterBoosts
			: null;
	return invaderRaidBodies[expected.body].map(type => {
		const boost = boosts?.[type];
		return boost ? { type, boost } : { type };
	});
}

export const invaderRaidCompositionCases: readonly InvaderRaidCompositionCase[] = [
	{
		label: 'non-center neutral no escalation spawns a boosted small Melee',
		roomName: 'W1N1',
		coreRoom: 'W1N2',
		exitTiles: [[25, 0]],
		random: [0, 0.1, 0, 0, 0.101, 0.5, 0.5],
		expected: [
			{ body: 'smallMelee', boosts: 'nonCenter' },
		],
	},
	{
		label: 'owned RCL 3 still uses the small body class',
		roomName: 'W1N1',
		coreRoom: 'W1N2',
		owner: 'p1',
		rcl: 3,
		exitTiles: [[25, 0]],
		random: [0, 0.1, 0, 0, 0.111, 0.5, 0.5],
		expected: [
			{ body: 'smallMelee', boosts: 'nonCenter' },
		],
	},
	{
		label: 'non-center nested small raid assigns index 1 Ranged and index 2 Healer',
		roomName: 'W1N1',
		coreRoom: 'W1N2',
		exitTiles: [[20, 0], [25, 0], [30, 0]],
		random: [
			0, 0.95, 0.95, 0.25,
			0, 0, 0.121,
			0.9, 0, 0.122,
			0, 0.123,
			0.5, 0.5,
		],
		expected: [
			{ body: 'smallMelee', boosts: 'nonCenter' },
			{ body: 'smallRanged', boosts: 'nonCenter' },
			{ body: 'smallHealer', boosts: 'nonCenter' },
		],
	},
	{
		label: 'non-center count five lets deterministic RNG choose index 2 Ranged',
		roomName: 'W1N1',
		coreRoom: 'W1N2',
		exitTiles: [[15, 0], [20, 0], [25, 0], [30, 0], [35, 0]],
		random: [
			0, 0.95, 0.95, 0.99,
			0, 0.9, 0.131,
			0.4, 0.9, 0.132,
			0.9, 0.9, 0.133,
			0.9, 0.134,
			0.9, 0.135,
			0.5, 0.5,
		],
		expected: [
			{ body: 'smallMelee', boosts: null },
			{ body: 'smallHealer', boosts: null },
			{ body: 'smallRanged', boosts: null },
			{ body: 'smallHealer', boosts: null },
			{ body: 'smallHealer', boosts: null },
		],
	},
	{
		label: 'center small raid starts Ranged and caps count to selected exit tiles',
		roomName: 'W5N5',
		coreRoom: 'W5N6',
		exitTiles: [[20, 0], [25, 0]],
		random: [
			0, 0, 0, 0.99,
			0, 0, 0.141,
			0.9, 0, 0.142,
			0.5, 0.5,
		],
		expected: [
			{ body: 'smallRanged', boosts: 'center' },
			{ body: 'smallRanged', boosts: 'center' },
		],
	},
	{
		label: 'non-center owned RCL 4 first escalation uses big bodies without boosts',
		roomName: 'W1N1',
		coreRoom: 'W1N2',
		owner: 'p1',
		rcl: 4,
		exitTiles: [[20, 0], [25, 0]],
		random: [
			0, 0.95, 0.1, 0,
			0, 0, 0.151,
			0.9, 0, 0.152,
			0.5, 0.5,
		],
		expected: [
			{ body: 'bigMelee', boosts: null },
			{ body: 'bigRanged', boosts: null },
		],
	},
	{
		label: 'center owned RCL 4 can assign a big Healer and still has zero boost chance',
		roomName: 'W5N5',
		coreRoom: 'W5N6',
		owner: 'p1',
		rcl: 4,
		exitTiles: [[20, 0], [25, 0]],
		random: [
			0, 0, 0, 0,
			0, 0, 0.161,
			0.1, 0, 0.162,
			0.5, 0.5,
		],
		expected: [
			{ body: 'bigRanged', boosts: null },
			{ body: 'bigHealer', boosts: null },
		],
	},
];
