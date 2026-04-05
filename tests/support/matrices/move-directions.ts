import {
	TOP, TOP_RIGHT, RIGHT, BOTTOM_RIGHT, BOTTOM, BOTTOM_LEFT, LEFT, TOP_LEFT,
} from '../../../src/index.js';

type DirectionConstant =
	| typeof TOP | typeof TOP_RIGHT | typeof RIGHT | typeof BOTTOM_RIGHT
	| typeof BOTTOM | typeof BOTTOM_LEFT | typeof LEFT | typeof TOP_LEFT;

interface DirectionOffset {
	label: string;
	direction: DirectionConstant;
	dx: -1 | 0 | 1;
	dy: -1 | 0 | 1;
}

// Canonical Screeps direction-constant → tile offset mapping.
// Values come from the checked-in constants (TOP..TOP_LEFT), not from the
// engine under test.
export const moveDirectionCases: readonly DirectionOffset[] = [
	{ label: 'TOP',          direction: TOP,          dx:  0, dy: -1 },
	{ label: 'TOP_RIGHT',    direction: TOP_RIGHT,    dx:  1, dy: -1 },
	{ label: 'RIGHT',        direction: RIGHT,        dx:  1, dy:  0 },
	{ label: 'BOTTOM_RIGHT', direction: BOTTOM_RIGHT, dx:  1, dy:  1 },
	{ label: 'BOTTOM',       direction: BOTTOM,       dx:  0, dy:  1 },
	{ label: 'BOTTOM_LEFT',  direction: BOTTOM_LEFT,  dx: -1, dy:  1 },
	{ label: 'LEFT',         direction: LEFT,         dx: -1, dy:  0 },
	{ label: 'TOP_LEFT',     direction: TOP_LEFT,     dx: -1, dy: -1 },
] as const;
