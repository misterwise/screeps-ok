import {
	TOP, TOP_RIGHT, RIGHT, BOTTOM_RIGHT, BOTTOM, BOTTOM_LEFT, LEFT, TOP_LEFT,
} from '../index.js';

export const roomPositionDirectionCases = [
	{ label: 'top', target: { x: 25, y: 24 }, expectedDirection: TOP },
	{ label: 'topRight', target: { x: 26, y: 24 }, expectedDirection: TOP_RIGHT },
	{ label: 'right', target: { x: 26, y: 25 }, expectedDirection: RIGHT },
	{ label: 'bottomRight', target: { x: 26, y: 26 }, expectedDirection: BOTTOM_RIGHT },
	{ label: 'bottom', target: { x: 25, y: 26 }, expectedDirection: BOTTOM },
	{ label: 'bottomLeft', target: { x: 24, y: 26 }, expectedDirection: BOTTOM_LEFT },
	{ label: 'left', target: { x: 24, y: 25 }, expectedDirection: LEFT },
	{ label: 'topLeft', target: { x: 24, y: 24 }, expectedDirection: TOP_LEFT },
] as const;
