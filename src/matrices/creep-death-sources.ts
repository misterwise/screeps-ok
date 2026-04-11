export const creepDeathResourceCases = [
	{
		label: 'source=suicide',
		creepName: 'SuicideCreep',
		ticksToLive: undefined,
		trigger: 'suicide',
	},
	{
		label: 'source=ticksToLive',
		creepName: 'AgingCreep',
		ticksToLive: 1,
		trigger: 'ticksToLive',
	},
] as const;
