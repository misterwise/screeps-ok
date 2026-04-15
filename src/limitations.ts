export type DocumentedAdapterLimitation =
	| 'controllerDowngrade'
	| 'xxscreepsPathFinderUseMissing'
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
		case 'xxscreepsPathFinderUseMissing':
			// Closed 2026-04-14: adapter's synthetic PathFinder now includes
			// `use` as a no-op, matching xxscreeps/game/path-finder/index.js.
			return false;
		case 'pullSelfHang':
			// xxscreeps pull(self) enters an infinite loop in the recursive
			// circular-pull check, hanging the test runner. Must skip, not fail.
			return isBuiltInAdapter('xxscreeps');
	}
}
