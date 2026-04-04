import { TERRAIN_PLAIN, TERRAIN_WALL, TERRAIN_SWAMP } from '../../../src/index.js';

export const roomTerrainCases = [
	{ label: 'plain', pos: { x: 10, y: 10 }, expectedMask: TERRAIN_PLAIN },
	{ label: 'wall', pos: { x: 11, y: 10 }, expectedMask: TERRAIN_WALL },
	{ label: 'swamp', pos: { x: 12, y: 10 }, expectedMask: TERRAIN_SWAMP },
] as const;

export const roomTerrainLayout = (() => {
	const terrain = new Array(2500).fill(TERRAIN_PLAIN);
	terrain[10 * 50 + 11] = TERRAIN_WALL;
	terrain[10 * 50 + 12] = TERRAIN_SWAMP;
	return terrain;
})();
