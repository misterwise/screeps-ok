import {
	POWER_INFO, powerDuration,
	PWR_OPERATE_SPAWN, PWR_OPERATE_STORAGE, PWR_OPERATE_EXTENSION, PWR_OPERATE_CONTROLLER,
	PWR_DISRUPT_SPAWN, PWR_DISRUPT_TOWER, PWR_DISRUPT_SOURCE, PWR_DISRUPT_TERMINAL,
	CREEP_SPAWN_TIME, STORAGE_CAPACITY, EXTENSION_ENERGY_CAPACITY, CONTROLLER_MAX_UPGRADE_PER_TICK,
	STRUCTURE_SPAWN, STRUCTURE_TOWER, STRUCTURE_TERMINAL,
} from '../index.js';

const levels = (power: number) => POWER_INFO[power].level.map((_, i) => i + 1);

// The operate cases' setups: a spawned creep's parts, and the RCL 8 extensions an operated storage fills.
export const OPERATE_SPAWN_PARTS = 5;
export const OPERATE_EXTENSION_COUNT = 5;

export interface OperatePowerCase {
	readonly key: string;
	readonly power: number;
	readonly level: number;
	/** The magnitude the effect gives: a spawn time, a storage capacity, energy moved, energy upgraded. */
	readonly expected: number;
}

// POWER-OPERATE-001: the operate magnitudes no structure row owns, at each level.
// create-creep.js:51-53, storages/tick.js:10-12, usePower.js:103-128, upgradeController.js:36-45.
export const operatePowerCases: readonly OperatePowerCase[] = [
	...levels(PWR_OPERATE_SPAWN).map(level => ({
		key: `operateSpawnLevel${level}`, power: PWR_OPERATE_SPAWN, level,
		expected: Math.ceil(OPERATE_SPAWN_PARTS * CREEP_SPAWN_TIME * POWER_INFO[PWR_OPERATE_SPAWN].effect![level - 1]),
	})),
	...levels(PWR_OPERATE_STORAGE).map(level => ({
		key: `operateStorageLevel${level}`, power: PWR_OPERATE_STORAGE, level,
		expected: STORAGE_CAPACITY + POWER_INFO[PWR_OPERATE_STORAGE].effect![level - 1],
	})),
	...levels(PWR_OPERATE_EXTENSION).map(level => ({
		key: `operateExtensionLevel${level}`, power: PWR_OPERATE_EXTENSION, level,
		expected: POWER_INFO[PWR_OPERATE_EXTENSION].effect![level - 1] * OPERATE_EXTENSION_COUNT * EXTENSION_ENERGY_CAPACITY[8],
	})),
	...levels(PWR_OPERATE_CONTROLLER).map(level => ({
		key: `operateControllerLevel${level}`, power: PWR_OPERATE_CONTROLLER, level,
		expected: CONTROLLER_MAX_UPGRADE_PER_TICK + POWER_INFO[PWR_OPERATE_CONTROLLER].effect![level - 1],
	})),
];

export interface DisruptPowerCase {
	readonly key: string;
	readonly power: number;
	readonly level: number;
	/** A target the processor accepts: a structure type, or `source`. */
	readonly target: string;
	readonly duration: number;
}

// POWER-DISRUPT-001: each disrupt power's effect duration, per level where POWER_INFO varies it (usePower.js:309-317).
export const disruptPowerCases: readonly DisruptPowerCase[] = ([
	['disruptSpawn', PWR_DISRUPT_SPAWN, STRUCTURE_SPAWN],
	['disruptTower', PWR_DISRUPT_TOWER, STRUCTURE_TOWER],
	['disruptSource', PWR_DISRUPT_SOURCE, 'source'],
	['disruptTerminal', PWR_DISRUPT_TERMINAL, STRUCTURE_TERMINAL],
] as const).flatMap(([key, power, target]) => {
	const perLevel = Array.isArray(POWER_INFO[power].duration);
	return (perLevel ? levels(power) : [1]).map(level => ({
		key: perLevel ? `${key}Level${level}` : key, power, level, target, duration: powerDuration(power, level),
	}));
});
