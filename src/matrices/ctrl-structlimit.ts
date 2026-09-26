import {
	CONTROLLER_STRUCTURES,
	STRUCTURE_SPAWN, STRUCTURE_EXTENSION, STRUCTURE_LINK, STRUCTURE_TOWER, STRUCTURE_LAB,
} from '../index.js';

// The types isActive() counts against CONTROLLER_STRUCTURES (@screeps/engine utils.js:456-490).
// It skips unowned ones (road, wall, container: always active, :458) and any type allowed
// only once at RCL 8 (:474); a room can't hold rampart's 2500.
const countedTypes = [STRUCTURE_SPAWN, STRUCTURE_EXTENSION, STRUCTURE_LINK, STRUCTURE_TOWER, STRUCTURE_LAB] as const;

interface StructLimitCase {
	structureType: (typeof countedTypes)[number];
	rcl: number;
	expectedCount: number;
}

// One case per owned level (1-8) at which a counted type's limit changes, the first included.
export const ctrlStructLimitTransitionCases: readonly StructLimitCase[] = countedTypes.flatMap(structureType => {
	const cases: StructLimitCase[] = [];
	for (let rcl = 1; rcl <= 8; rcl++) {
		const expectedCount = CONTROLLER_STRUCTURES[structureType][rcl];
		if (rcl === 1 || expectedCount !== CONTROLLER_STRUCTURES[structureType][rcl - 1]) {
			cases.push({ structureType, rcl, expectedCount });
		}
	}
	return cases;
});
