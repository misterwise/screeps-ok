export type DocumentedAdapterLimitation =
	| 'controllerDowngrade'
	| 'interRoomTransition'
	| 'flagSupport'
	| 'memorySupport'
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
			// Closed 2026-04-14: xxscreeps adapter now honors
			// RoomSpec.ticksToDowngrade via `#downgradeTime` in createShard.
			return false;
		case 'interRoomTransition':
			// xxscreeps adapter does not support inter-room creep transitions.
			return isBuiltInAdapter('xxscreeps');
		case 'flagSupport':
			// xxscreeps simulate() does not populate Game.flags (no TickPayload-aware player mode).
			return isBuiltInAdapter('xxscreeps');
		case 'memorySupport':
			// xxscreeps simulate() does not populate Memory/RawMemory (no TickPayload-aware player mode).
			return isBuiltInAdapter('xxscreeps');
		case 'xxscreepsPathFinderUseMissing':
			// Closed 2026-04-14: adapter's synthetic PathFinder now includes
			// `use` as a no-op, matching xxscreeps/game/path-finder/index.js.
			return false;
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
