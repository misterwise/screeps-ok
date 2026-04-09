// Canonical same-tick creep intent priority exclusion table.
// When both a blocker method and a blocked method issue intents in the same
// tick, the blocked method's intent is silently discarded — only the blocker
// method's processor runs.
//
// The priorities map in the engine stores { suppressed: [suppressors] }.
// Each entry below is (blocker, blocked) meaning: blocker's presence causes
// blocked to be skipped.
//
// Source: @screeps/engine/src/processor/intents/creeps/intents.js

interface IntentPriorityCase {
	blocker: string;
	blocked: string;
}

export const intentCreepPriorityCases: readonly IntentPriorityCase[] = [
	// heal blocks rangedHeal
	{ blocker: 'heal', blocked: 'rangedHeal' },

	// rangedHeal blocks attackController; heal blocks attackController
	{ blocker: 'rangedHeal', blocked: 'attackController' },
	{ blocker: 'heal', blocked: 'attackController' },

	// attackController blocks dismantle; rangedHeal, heal block dismantle
	{ blocker: 'attackController', blocked: 'dismantle' },
	{ blocker: 'rangedHeal', blocked: 'dismantle' },
	{ blocker: 'heal', blocked: 'dismantle' },

	// dismantle blocks repair; attackController, rangedHeal, heal block repair
	{ blocker: 'dismantle', blocked: 'repair' },
	{ blocker: 'attackController', blocked: 'repair' },
	{ blocker: 'rangedHeal', blocked: 'repair' },
	{ blocker: 'heal', blocked: 'repair' },

	// repair blocks build; dismantle, attackController, rangedHeal, heal block build
	{ blocker: 'repair', blocked: 'build' },
	{ blocker: 'dismantle', blocked: 'build' },
	{ blocker: 'attackController', blocked: 'build' },
	{ blocker: 'rangedHeal', blocked: 'build' },
	{ blocker: 'heal', blocked: 'build' },

	// build blocks attack; repair, dismantle, attackController, rangedHeal, heal block attack
	{ blocker: 'build', blocked: 'attack' },
	{ blocker: 'repair', blocked: 'attack' },
	{ blocker: 'dismantle', blocked: 'attack' },
	{ blocker: 'attackController', blocked: 'attack' },
	{ blocker: 'rangedHeal', blocked: 'attack' },
	{ blocker: 'heal', blocked: 'attack' },

	// attack blocks harvest; build, repair, dismantle, attackController, rangedHeal, heal block harvest
	{ blocker: 'attack', blocked: 'harvest' },
	{ blocker: 'build', blocked: 'harvest' },
	{ blocker: 'repair', blocked: 'harvest' },
	{ blocker: 'dismantle', blocked: 'harvest' },
	{ blocker: 'attackController', blocked: 'harvest' },
	{ blocker: 'rangedHeal', blocked: 'harvest' },
	{ blocker: 'heal', blocked: 'harvest' },

	// build, repair, rangedHeal block rangedMassAttack
	{ blocker: 'build', blocked: 'rangedMassAttack' },
	{ blocker: 'repair', blocked: 'rangedMassAttack' },
	{ blocker: 'rangedHeal', blocked: 'rangedMassAttack' },

	// rangedMassAttack blocks rangedAttack; build, repair, rangedHeal block rangedAttack
	{ blocker: 'rangedMassAttack', blocked: 'rangedAttack' },
	{ blocker: 'build', blocked: 'rangedAttack' },
	{ blocker: 'repair', blocked: 'rangedAttack' },
	{ blocker: 'rangedHeal', blocked: 'rangedAttack' },
];
