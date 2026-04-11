import {
	TOP, TOP_RIGHT, RIGHT, BOTTOM_RIGHT, BOTTOM, BOTTOM_LEFT, LEFT, TOP_LEFT,
} from '../index.js';

export const roomPositionDirectionCases = [
	{ label: 'TOP', target: { x: 25, y: 24 }, expectedDirection: TOP },
	{ label: 'TOP_RIGHT', target: { x: 26, y: 24 }, expectedDirection: TOP_RIGHT },
	{ label: 'RIGHT', target: { x: 26, y: 25 }, expectedDirection: RIGHT },
	{ label: 'BOTTOM_RIGHT', target: { x: 26, y: 26 }, expectedDirection: BOTTOM_RIGHT },
	{ label: 'BOTTOM', target: { x: 25, y: 26 }, expectedDirection: BOTTOM },
	{ label: 'BOTTOM_LEFT', target: { x: 24, y: 26 }, expectedDirection: BOTTOM_LEFT },
	{ label: 'LEFT', target: { x: 24, y: 25 }, expectedDirection: LEFT },
	{ label: 'TOP_LEFT', target: { x: 24, y: 24 }, expectedDirection: TOP_LEFT },
] as const;
