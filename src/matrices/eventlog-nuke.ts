export type NukeEventLogCase = {
	catalogId: 'ROOM-EVENTLOG-026';
	label: string;
	scenario: 'attackIdDirection' | 'noCreepAttackEvents' | 'rampartBeforeCoveredStructure';
};

export const nukeEventLogCases: readonly NukeEventLogCase[] = [
	{
		catalogId: 'ROOM-EVENTLOG-026',
		label: 'attack-object-is-nuke-target-is-structure',
		scenario: 'attackIdDirection',
	},
	{
		catalogId: 'ROOM-EVENTLOG-026',
		label: 'roomwide-creep-kill-emits-no-attack-event',
		scenario: 'noCreepAttackEvents',
	},
	{
		catalogId: 'ROOM-EVENTLOG-026',
		label: 'rampart-attack-entry-precedes-covered-structure',
		scenario: 'rampartBeforeCoveredStructure',
	},
];
