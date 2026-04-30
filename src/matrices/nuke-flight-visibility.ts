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
		label: 'target-room-visible-to-target-owner',
		observer: 'p2',
		roomName: 'W2N1',
		expectedHasRoom: true,
		expectedNukeCount: 1,
	},
	{
		catalogId: 'NUKE-FLIGHT-004',
		label: 'launch-room-does-not-list-target-nuke',
		observer: 'p1',
		roomName: 'W1N1',
		expectedHasRoom: true,
		expectedNukeCount: 0,
	},
	{
		catalogId: 'NUKE-FLIGHT-004',
		label: 'target-room-hidden-from-launcher-without-visibility',
		observer: 'p1',
		roomName: 'W2N1',
		expectedHasRoom: false,
		expectedNukeCount: null,
	},
];
