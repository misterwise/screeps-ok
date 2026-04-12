export type DocumentedAdapterLimitation =
	| 'controllerDowngrade'
	| 'portalPlacement'
	| 'interRoomTransition'
	| 'flagSupport'
	| 'memorySupport'
	| 'npcStructures'
	| 'xxscreepsPathFinderUseMissing'
	| 'playerGclControl'
	| 'pullSelfHang';

function activeAdapterPath(): string {
	return process.env.SCREEPS_OK_ADAPTER ?? '';
}

function isBuiltInAdapter(name: 'vanilla' | 'xxscreeps'): boolean {
	const adapterPath = activeAdapterPath();
	return adapterPath.includes(`/adapters/${name}/`) || adapterPath.endsWith(`${name}.ts`) || adapterPath === name;
}

export function hasDocumentedAdapterLimitation(limitation: DocumentedAdapterLimitation): boolean {
	switch (limitation) {
		case 'controllerDowngrade':
			// xxscreeps adapter does not support RoomSpec.ticksToDowngrade.
			return isBuiltInAdapter('xxscreeps');
		case 'portalPlacement':
			// xxscreeps adapter does not support placeObject for portals.
			return isBuiltInAdapter('xxscreeps');
		case 'interRoomTransition':
			// xxscreeps adapter does not support inter-room creep transitions.
			return isBuiltInAdapter('xxscreeps');
		case 'flagSupport':
			// xxscreeps simulate() does not populate Game.flags (no TickPayload-aware player mode).
			return isBuiltInAdapter('xxscreeps');
		case 'memorySupport':
			// xxscreeps simulate() does not populate Memory/RawMemory (no TickPayload-aware player mode).
			return isBuiltInAdapter('xxscreeps');
		case 'npcStructures':
			// xxscreeps doesn't support placeObject for keeperLair/invaderCore.
			return isBuiltInAdapter('xxscreeps');
		case 'xxscreepsPathFinderUseMissing':
			// xxscreeps itself exposes `PathFinder.use` as a no-op in its user
			// sandbox (xxscreeps/dist/game/path-finder/index.js:78), but the
			// screeps-ok xxscreeps adapter builds its own synthetic
			// `PathFinder = { search, CostMatrix }` wrapper at
			// adapters/xxscreeps/index.ts:19 that omits the `use` property.
			// Adding `use: () => {}` to that object would make LEGACY-PATH-003
			// runnable on xxscreeps; until then, gate the test on this limit.
			return isBuiltInAdapter('xxscreeps');
		case 'playerGclControl':
			// xxscreeps synthesizes `Game.gcl.level = ownedRoomCount + 1` and
			// exposes no override, so the per-player room cap can't be reached
			// honestly there. Vanilla supports `PlayerSpec.gcl` (see
			// adapters/vanilla/index.ts createShard); tests that need
			// ERR_GCL_NOT_ENOUGH should set a low gcl on the player spec.
			return isBuiltInAdapter('xxscreeps');
		case 'pullSelfHang':
			// xxscreeps pull(self) enters an infinite loop in the recursive
			// circular-pull check, hanging the test runner. Must skip, not fail.
			return isBuiltInAdapter('xxscreeps');
	}
}
