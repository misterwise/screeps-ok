import {
	PWR_OPERATE_SPAWN, PWR_OPERATE_TOWER, PWR_OPERATE_STORAGE, PWR_OPERATE_LAB,
	PWR_OPERATE_EXTENSION, PWR_OPERATE_OBSERVER, PWR_OPERATE_TERMINAL,
	PWR_OPERATE_POWER, PWR_OPERATE_CONTROLLER, PWR_OPERATE_FACTORY,
	PWR_DISRUPT_SPAWN, PWR_DISRUPT_TOWER, PWR_DISRUPT_TERMINAL,
	STRUCTURE_SPAWN, STRUCTURE_TOWER, STRUCTURE_STORAGE, STRUCTURE_LAB,
	STRUCTURE_OBSERVER, STRUCTURE_TERMINAL, STRUCTURE_POWER_SPAWN,
	STRUCTURE_CONTROLLER, STRUCTURE_FACTORY,
} from '../index.js';

export interface PowerTargetCase {
	readonly catalogId: 'POWER-OPERATE-005' | 'POWER-DISRUPT-003';
	/** Letters only: the catalog row suffix stem. */
	readonly key: string;
	readonly power: number;
	/** The structure type the processor accepts (vanilla `usePower.js` target check). */
	readonly validTarget: string;
	/** Any other structure type in range; the processor returns before charging. */
	readonly invalidTarget: string;
	/** Whether a valid use leaves an entry in the target's `effects`. */
	readonly hostsEffect: boolean;
	/** Defaults to 1. */
	readonly powerLevel?: number;
}

// Vanilla's game-layer usePower has no target-type check; the processor's
// per-power switch does, and drops a mismatched intent without ops, cooldown or effect.
export const powerTargetCases: readonly PowerTargetCase[] = [
	{ catalogId: 'POWER-OPERATE-005', key: 'operateSpawn', power: PWR_OPERATE_SPAWN, validTarget: STRUCTURE_SPAWN, invalidTarget: STRUCTURE_TOWER, hostsEffect: true },
	{ catalogId: 'POWER-OPERATE-005', key: 'operateTower', power: PWR_OPERATE_TOWER, validTarget: STRUCTURE_TOWER, invalidTarget: STRUCTURE_SPAWN, hostsEffect: true },
	{ catalogId: 'POWER-OPERATE-005', key: 'operateStorage', power: PWR_OPERATE_STORAGE, validTarget: STRUCTURE_STORAGE, invalidTarget: STRUCTURE_TERMINAL, hostsEffect: true },
	{ catalogId: 'POWER-OPERATE-005', key: 'operateLab', power: PWR_OPERATE_LAB, validTarget: STRUCTURE_LAB, invalidTarget: STRUCTURE_TOWER, hostsEffect: true },
	// Fills the room's extensions from the target's store instead of hosting an effect.
	{ catalogId: 'POWER-OPERATE-005', key: 'operateExtension', power: PWR_OPERATE_EXTENSION, validTarget: STRUCTURE_STORAGE, invalidTarget: STRUCTURE_TOWER, hostsEffect: false },
	{ catalogId: 'POWER-OPERATE-005', key: 'operateObserver', power: PWR_OPERATE_OBSERVER, validTarget: STRUCTURE_OBSERVER, invalidTarget: STRUCTURE_TOWER, hostsEffect: true },
	{ catalogId: 'POWER-OPERATE-005', key: 'operateTerminal', power: PWR_OPERATE_TERMINAL, validTarget: STRUCTURE_TERMINAL, invalidTarget: STRUCTURE_STORAGE, hostsEffect: true },
	{ catalogId: 'POWER-OPERATE-005', key: 'operatePower', power: PWR_OPERATE_POWER, validTarget: STRUCTURE_POWER_SPAWN, invalidTarget: STRUCTURE_TOWER, hostsEffect: true },
	{ catalogId: 'POWER-OPERATE-005', key: 'operateController', power: PWR_OPERATE_CONTROLLER, validTarget: STRUCTURE_CONTROLLER, invalidTarget: STRUCTURE_TOWER, hostsEffect: true },
	{ catalogId: 'POWER-OPERATE-005', key: 'operateFactory', power: PWR_OPERATE_FACTORY, validTarget: STRUCTURE_FACTORY, invalidTarget: STRUCTURE_TOWER, hostsEffect: true },
	// Level 1 lasts one tick, so its effect is gone by the next read.
	{ catalogId: 'POWER-DISRUPT-003', key: 'disruptSpawn', power: PWR_DISRUPT_SPAWN, validTarget: STRUCTURE_SPAWN, invalidTarget: STRUCTURE_TOWER, hostsEffect: true, powerLevel: 2 },
	{ catalogId: 'POWER-DISRUPT-003', key: 'disruptTower', power: PWR_DISRUPT_TOWER, validTarget: STRUCTURE_TOWER, invalidTarget: STRUCTURE_SPAWN, hostsEffect: true },
	{ catalogId: 'POWER-DISRUPT-003', key: 'disruptTerminal', power: PWR_DISRUPT_TERMINAL, validTarget: STRUCTURE_TERMINAL, invalidTarget: STRUCTURE_STORAGE, hostsEffect: true },
];
