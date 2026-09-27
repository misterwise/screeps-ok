import {
	TOP, TOP_RIGHT, RIGHT, BOTTOM_RIGHT, BOTTOM, BOTTOM_LEFT, LEFT, TOP_LEFT,
} from '../index.js';

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
	{ label: 'top',          direction: TOP,          dx:  0, dy: -1 },
	{ label: 'topRight',    direction: TOP_RIGHT,    dx:  1, dy: -1 },
	{ label: 'right',        direction: RIGHT,        dx:  1, dy:  0 },
	{ label: 'bottomRight', direction: BOTTOM_RIGHT, dx:  1, dy:  1 },
	{ label: 'bottom',       direction: BOTTOM,       dx:  0, dy:  1 },
	{ label: 'bottomLeft',  direction: BOTTOM_LEFT,  dx: -1, dy:  1 },
	{ label: 'left',         direction: LEFT,         dx: -1, dy:  0 },
	{ label: 'topLeft',     direction: TOP_LEFT,     dx: -1, dy: -1 },
] as const;
