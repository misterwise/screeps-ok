export type DocumentedAdapterLimitation =
	| 'headlessMultiPlayer'
	| 'structureCustomHits'
	| 'controllerDowngrade'
	| 'portalPlacement'
	| 'interRoomTransition'
	| 'flagSupport'
	| 'memorySupport'
	| 'rawMemoryBeforeMemoryAccess'
	| 'npcStructures'
	| 'vanillaTerrainPathfinder'
	| 'xxscreepsPathFinderUseMissing'
	| 'playerGclControl';

function activeAdapterPath(): string {
	return process.env.SCREEPS_OK_ADAPTER ?? '';
}

function isBuiltInAdapter(name: 'vanilla' | 'xxscreeps'): boolean {
	const adapterPath = activeAdapterPath();
	return adapterPath.includes(`/adapters/${name}/`) || adapterPath.endsWith(`${name}.ts`) || adapterPath === name;
}

export function hasDocumentedAdapterLimitation(limitation: DocumentedAdapterLimitation): boolean {
	switch (limitation) {
		case 'headlessMultiPlayer':
			// Vanilla's mockup runtime disables users that own no room objects, so a
			// declared second player without an owned room cannot execute code there.
			return isBuiltInAdapter('vanilla');
		case 'structureCustomHits':
			// Vanilla's addRoomObject produces objects that getObject cannot find
			// when a custom hits value is provided on unowned structures like containers.
			return isBuiltInAdapter('vanilla');
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
		case 'rawMemoryBeforeMemoryAccess':
			// Vanilla adapter's main loop accesses Memory._screepsOk before user code runs,
			// so RawMemory.set() before first Memory access can't be tested (Memory is already parsed).
			return isBuiltInAdapter('vanilla');
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
			// Both adapters hardcode a high GCL at user creation (vanilla sets
			// gcl: 10_000_000, xxscreeps synthesizes Game.gcl.level = ownedRoomCount+1),
			// and neither exposes an API to override it. Tests that need to force
			// ERR_GCL_NOT_ENOUGH by exceeding the room cap therefore cannot run
			// honestly. Gated on both adapters until a player gcl override is added.
			return isBuiltInAdapter('vanilla') || isBuiltInAdapter('xxscreeps');
		case 'vanillaTerrainPathfinder':
			// Vanilla adapter (screeps-server-mockup + @screeps/driver) caches
			// terrain in `staticTerrainData` inside the engine_runner process
			// the first time any user runs code (see
			// node_modules/@screeps/driver/lib/runtime/make.js:18-51,
			// `getAllTerrainData()` early-returns once the cache is populated).
			// Because the runner is a long-lived child process shared across
			// tests, terrain set via `RoomSpec.terrain` after that first call
			// is invisible to player code that reads terrain via
			// `Room.getTerrain()`, `PathFinder.search()`, `findPath()`, or
			// any moveTo() that triggers pathfinding. The engine processor
			// still respects the wall (creeps cannot physically step on it,
			// which is why MOVE-BASIC-002 happens to pass), so this only
			// affects tests that observe terrain through the player API.
			// A real fix requires invalidating that runner-side cache, which
			// has no public API today; the framework workaround would be a
			// per-test ScreepsServer instance or a runner-only restart with
			// careful queue resync.
			return isBuiltInAdapter('vanilla');
	}
}
