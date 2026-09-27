import {
	POWER_INFO, powerOps,
	PWR_OPERATE_SPAWN, PWR_OPERATE_TOWER, PWR_OPERATE_STORAGE, PWR_OPERATE_LAB,
	PWR_OPERATE_EXTENSION, PWR_OPERATE_OBSERVER, PWR_OPERATE_TERMINAL,
	PWR_OPERATE_POWER, PWR_OPERATE_CONTROLLER, PWR_OPERATE_FACTORY,
	PWR_DISRUPT_SPAWN, PWR_DISRUPT_TOWER, PWR_DISRUPT_SOURCE, PWR_DISRUPT_TERMINAL,
	PWR_REGEN_SOURCE, PWR_REGEN_MINERAL,
	STRUCTURE_SPAWN, STRUCTURE_TOWER, STRUCTURE_STORAGE, STRUCTURE_LAB,
	STRUCTURE_OBSERVER, STRUCTURE_TERMINAL, STRUCTURE_POWER_SPAWN,
	STRUCTURE_CONTROLLER, STRUCTURE_FACTORY,
} from '../index.js';

type PowerCostRow = 'POWER-OPERATE-002' | 'POWER-DISRUPT-002' | 'POWER-REGEN-002';

export interface PowerCostCase {
	readonly catalogId: PowerCostRow;
	readonly key: string;
	readonly power: number;
	/** A target the processor accepts: a structure type, or `source` / `mineral`. */
	readonly target: string;
	readonly level: number;
	readonly ops: number;
	readonly cooldown: number;
	readonly range: number;
}

const cases: ReadonlyArray<{ catalogId: PowerCostRow; key: string; power: number; target: string }> = [
	{ catalogId: 'POWER-OPERATE-002', key: 'operateSpawn', power: PWR_OPERATE_SPAWN, target: STRUCTURE_SPAWN },
	{ catalogId: 'POWER-OPERATE-002', key: 'operateTower', power: PWR_OPERATE_TOWER, target: STRUCTURE_TOWER },
	{ catalogId: 'POWER-OPERATE-002', key: 'operateStorage', power: PWR_OPERATE_STORAGE, target: STRUCTURE_STORAGE },
	{ catalogId: 'POWER-OPERATE-002', key: 'operateLab', power: PWR_OPERATE_LAB, target: STRUCTURE_LAB },
	// Fills the room's extensions from a storage; charged only when it moves energy.
	{ catalogId: 'POWER-OPERATE-002', key: 'operateExtension', power: PWR_OPERATE_EXTENSION, target: STRUCTURE_STORAGE },
	{ catalogId: 'POWER-OPERATE-002', key: 'operateObserver', power: PWR_OPERATE_OBSERVER, target: STRUCTURE_OBSERVER },
	{ catalogId: 'POWER-OPERATE-002', key: 'operateTerminal', power: PWR_OPERATE_TERMINAL, target: STRUCTURE_TERMINAL },
	{ catalogId: 'POWER-OPERATE-002', key: 'operatePower', power: PWR_OPERATE_POWER, target: STRUCTURE_POWER_SPAWN },
	{ catalogId: 'POWER-OPERATE-002', key: 'operateController', power: PWR_OPERATE_CONTROLLER, target: STRUCTURE_CONTROLLER },
	{ catalogId: 'POWER-OPERATE-002', key: 'operateFactory', power: PWR_OPERATE_FACTORY, target: STRUCTURE_FACTORY },
	{ catalogId: 'POWER-DISRUPT-002', key: 'disruptSpawn', power: PWR_DISRUPT_SPAWN, target: STRUCTURE_SPAWN },
	{ catalogId: 'POWER-DISRUPT-002', key: 'disruptTower', power: PWR_DISRUPT_TOWER, target: STRUCTURE_TOWER },
	{ catalogId: 'POWER-DISRUPT-002', key: 'disruptSource', power: PWR_DISRUPT_SOURCE, target: 'source' },
	{ catalogId: 'POWER-DISRUPT-002', key: 'disruptTerminal', power: PWR_DISRUPT_TERMINAL, target: STRUCTURE_TERMINAL },
	{ catalogId: 'POWER-REGEN-002', key: 'regenSource', power: PWR_REGEN_SOURCE, target: 'source' },
	{ catalogId: 'POWER-REGEN-002', key: 'regenMineral', power: PWR_REGEN_MINERAL, target: 'mineral' },
];

// POWER-OPERATE-002, POWER-DISRUPT-002, POWER-REGEN-002: a use's ops, cooldown and range from
// POWER_INFO (usePower.js:27-50, :318-325); a power whose ops vary by level runs each level.
export const powerCostCases: readonly PowerCostCase[] = cases.flatMap(({ catalogId, key, power, target }) => {
	const info = POWER_INFO[power];
	const levels = Array.isArray(info.ops) ? info.level.map((_, i) => i + 1) : [1];
	return levels.map(level => ({
		catalogId,
		key: levels.length > 1 ? `${key}Level${level}` : key,
		power,
		target,
		level,
		ops: powerOps(power, level),
		cooldown: info.cooldown,
		range: info.range!,
	}));
});
