export type NukeFlightVisibilityCase = {
	catalogId: 'NUKE-FLIGHT-004';
	label: string;
	observer: 'p1' | 'p2';
	roomName: 'W1N1' | 'W2N1';
	expectedHasRoom: boolean;
	expectedNukeCount: number | null;
};

export const nukeFlightVisibilityCases: readonly NukeFlightVisibilityCase[] = [
	{
		catalogId: 'NUKE-FLIGHT-004',
		label: 'targetRoomVisibleToTargetOwner',
		observer: 'p2',
		roomName: 'W2N1',
		expectedHasRoom: true,
		expectedNukeCount: 1,
	},
	{
		catalogId: 'NUKE-FLIGHT-004',
		label: 'launchRoomDoesNotListTargetNuke',
		observer: 'p1',
		roomName: 'W1N1',
		expectedHasRoom: true,
		expectedNukeCount: 0,
	},
	{
		catalogId: 'NUKE-FLIGHT-004',
		label: 'targetRoomHiddenFromLauncherWithoutVisibility',
		observer: 'p1',
		roomName: 'W2N1',
		expectedHasRoom: false,
		expectedNukeCount: null,
	},
];
