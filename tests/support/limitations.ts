export type DocumentedAdapterLimitation =
	| 'headlessMultiPlayer'
	| 'structureCustomHits'
	| 'controllerDowngrade'
	| 'portalPlacement'
	| 'interRoomTransition'
	| 'flagSupport'
	| 'memorySupport'
	| 'rawMemoryBeforeMemoryAccess'
	| 'npcStructures';

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
	}
}
