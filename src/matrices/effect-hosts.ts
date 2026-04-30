import {
	PWR_DISRUPT_SOURCE, PWR_DISRUPT_SPAWN, PWR_DISRUPT_TERMINAL,
	PWR_DISRUPT_TOWER, PWR_FORTIFY, PWR_OPERATE_CONTROLLER,
	PWR_OPERATE_FACTORY, PWR_OPERATE_LAB, PWR_OPERATE_OBSERVER,
	PWR_OPERATE_POWER, PWR_OPERATE_SPAWN, PWR_OPERATE_STORAGE,
	PWR_OPERATE_TERMINAL, PWR_OPERATE_TOWER, PWR_REGEN_MINERAL,
	PWR_REGEN_SOURCE, PWR_SHIELD,
	STRUCTURE_FACTORY, STRUCTURE_LAB, STRUCTURE_OBSERVER,
	STRUCTURE_POWER_SPAWN, STRUCTURE_RAMPART, STRUCTURE_SPAWN,
	STRUCTURE_STORAGE, STRUCTURE_TERMINAL, STRUCTURE_TOWER,
	type CapabilityName,
} from '../index.js';

type RoomPoint = readonly [number, number];

export type EffectHostTarget =
	| {
		readonly kind: 'structure';
		readonly structureType: string;
		readonly pos: RoomPoint;
		readonly extra?: Record<string, unknown>;
	}
	| {
		readonly kind: 'source';
		readonly pos: RoomPoint;
		readonly energy?: number;
		readonly energyCapacity?: number;
	}
	| {
		readonly kind: 'mineral';
		readonly pos: RoomPoint;
		readonly mineralType: string;
		readonly mineralAmount?: number;
	}
	| {
		readonly kind: 'controller';
	}
	| {
		readonly kind: 'shieldRampart';
		readonly pos: RoomPoint;
	};

export interface EffectHostCase {
	readonly label: string;
	readonly producer: string;
	readonly targetName: string;
	readonly power: number;
	readonly powerLevel: number;
	readonly expectedPower?: number;
	readonly expectedEffect?: number;
	readonly expectedLevel?: number;
	readonly target: EffectHostTarget;
	readonly capability?: CapabilityName;
}

function powerEffectCase(
	producer: string,
	targetName: string,
	power: number,
	target: EffectHostTarget,
	options: {
		readonly powerLevel?: number;
		readonly expectedEffect?: number | null;
		readonly expectedPower?: number;
		readonly expectedLevel?: number;
		readonly capability?: CapabilityName;
	} = {},
): EffectHostCase {
	const powerLevel = options.powerLevel ?? 1;
	const result: EffectHostCase = {
		label: `${producer}->${targetName}`,
		producer,
		targetName,
		power,
		powerLevel,
		expectedPower: options.expectedPower ?? power,
		expectedLevel: options.expectedLevel ?? powerLevel,
		target,
		capability: options.capability,
	};
	if (options.expectedEffect !== null) {
		return { ...result, expectedEffect: options.expectedEffect ?? power };
	}
	return result;
}

export const effectHostCases: readonly EffectHostCase[] = [
	powerEffectCase('PWR_OPERATE_TOWER', 'StructureTower', PWR_OPERATE_TOWER, {
		kind: 'structure', structureType: STRUCTURE_TOWER, pos: [25, 25],
		extra: { store: { energy: 1000 } },
	}),
	powerEffectCase('PWR_OPERATE_STORAGE', 'StructureStorage', PWR_OPERATE_STORAGE, {
		kind: 'structure', structureType: STRUCTURE_STORAGE, pos: [25, 25],
		extra: { store: { energy: 1000 } },
	}),
	// Level 2 keeps one positive tick after the apply tick; level 1 duration is 1.
	powerEffectCase('PWR_DISRUPT_SPAWN', 'StructureSpawn', PWR_DISRUPT_SPAWN, {
		kind: 'structure', structureType: STRUCTURE_SPAWN, pos: [25, 25],
		extra: { store: { energy: 300 } },
	}, { powerLevel: 2 }),
	powerEffectCase('PWR_DISRUPT_TOWER', 'StructureTower', PWR_DISRUPT_TOWER, {
		kind: 'structure', structureType: STRUCTURE_TOWER, pos: [25, 25],
		extra: { store: { energy: 1000 } },
	}),
	powerEffectCase('PWR_OPERATE_SPAWN', 'StructureSpawn', PWR_OPERATE_SPAWN, {
		kind: 'structure', structureType: STRUCTURE_SPAWN, pos: [25, 25],
		extra: { store: { energy: 300 } },
	}),
	powerEffectCase('PWR_REGEN_SOURCE', 'Source', PWR_REGEN_SOURCE, {
		kind: 'source', pos: [25, 25], energy: 0, energyCapacity: 3000,
	}),
	powerEffectCase('PWR_DISRUPT_SOURCE', 'Source', PWR_DISRUPT_SOURCE, {
		kind: 'source', pos: [25, 25], energy: 0, energyCapacity: 3000,
	}),
	powerEffectCase('PWR_REGEN_MINERAL', 'Mineral', PWR_REGEN_MINERAL, {
		kind: 'mineral', pos: [25, 25], mineralType: 'H', mineralAmount: 1000,
	}),
	powerEffectCase('PWR_OPERATE_OBSERVER', 'StructureObserver', PWR_OPERATE_OBSERVER, {
		kind: 'structure', structureType: STRUCTURE_OBSERVER, pos: [25, 25],
	}, { capability: 'observer' }),
	powerEffectCase('PWR_OPERATE_FACTORY', 'StructureFactory', PWR_OPERATE_FACTORY, {
		kind: 'structure', structureType: STRUCTURE_FACTORY, pos: [25, 25],
		extra: { store: { energy: 100 } },
	}, { capability: 'factory' }),
	powerEffectCase('PWR_OPERATE_TERMINAL', 'StructureTerminal', PWR_OPERATE_TERMINAL, {
		kind: 'structure', structureType: STRUCTURE_TERMINAL, pos: [25, 25],
		extra: { store: { energy: 1000 } },
	}, { capability: 'market' }),
	powerEffectCase('PWR_DISRUPT_TERMINAL', 'StructureTerminal', PWR_DISRUPT_TERMINAL, {
		kind: 'structure', structureType: STRUCTURE_TERMINAL, pos: [25, 25],
		extra: { store: { energy: 1000 } },
	}, { capability: 'market' }),
	powerEffectCase('PWR_OPERATE_LAB', 'StructureLab', PWR_OPERATE_LAB, {
		kind: 'structure', structureType: STRUCTURE_LAB, pos: [25, 25],
		extra: { store: { energy: 100 } },
	}, { capability: 'chemistry' }),
	powerEffectCase('PWR_OPERATE_POWER', 'StructurePowerSpawn', PWR_OPERATE_POWER, {
		kind: 'structure', structureType: STRUCTURE_POWER_SPAWN, pos: [25, 25],
		extra: { store: { energy: 1000, power: 100 } },
	}),
	powerEffectCase('PWR_OPERATE_CONTROLLER', 'StructureController', PWR_OPERATE_CONTROLLER, {
		kind: 'controller',
	}),
	// Level 2 keeps one positive tick after the apply tick; level 1 duration is 1.
	powerEffectCase('PWR_FORTIFY', 'StructureRampart', PWR_FORTIFY, {
		kind: 'structure', structureType: STRUCTURE_RAMPART, pos: [25, 25],
		extra: { hits: 10000 },
	}, { powerLevel: 2 }),
	powerEffectCase('PWR_SHIELD', 'temporary StructureRampart', PWR_SHIELD, {
		kind: 'shieldRampart', pos: [25, 25],
	}, { expectedEffect: null }),
] as const;
