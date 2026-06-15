// The engine's game/pathfinder/index.ts has no emitted .d.ts in our flat node_modules layout: roomSearch's inferred return type references the nested @xxscreeps/pathfinder native package, which TS deems non-portable (TS2742) and so aborts declaration emit. Re-export the two symbols the adapter needs from the sibling modules that do emit declarations.
// TODO: remove once xxscreeps emits dist/game/pathfinder/index.d.ts portably.
declare module 'xxscreeps/game/pathfinder/index.js' {
	export { search } from 'xxscreeps/driver/pathfinder/pathfinder.js';
	export { CostMatrix } from 'xxscreeps/game/pathfinder/cost-matrix.js';
}
