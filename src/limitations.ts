// Documented adapter limitations — quirks of a specific engine that require
// skipping (not failing) the affected tests. Unlike capabilities (which
// express "this feature area is disabled"), a limitation says "the engine
// implements this but does it in a way that hangs or corrupts the test
// runner if we let the test actually execute."
//
// Adapters declare their own limitations via the `limitations` field on
// `ScreepsOkAdapter`. Tests that target affected behaviors wrap their
// registration with `limitationGated('<name>')`, which skips them at run
// time when the active adapter reports the limitation.
//
// Adding a new limitation:
//   1. Add the name to `AdapterLimitation` below with a one-line comment
//      explaining the engine behavior that forces a skip.
//   2. Set the flag in the affected adapter's `limitations` object.
//   3. Gate the test with `limitationGated('<name>')`.
//
// Closing a limitation: leave the name in the union (tests may still gate
// on it for historical reasons) but stop setting the flag in the adapter.
// The gate becomes a no-op and tests run normally.

import { resolve } from 'node:path';
import type { ScreepsOkAdapter } from './adapter.js';

export type AdapterLimitation =
	/** `pull(self)` enters an infinite loop in the recursive circular-pull
	 *  check, hanging the test runner. Must be skipped, not asserted-to-fail.
	 */
	| 'pullSelfHang'
	/** Closed 2026-04-14: xxscreeps adapter now honors
	 *  `RoomSpec.ticksToDowngrade` via `#downgradeTime` in `createShard`.
	 *  Kept in the union for tests that still wrap with `limitationGated`.
	 */
	| 'controllerDowngrade'
	/** Closed 2026-04-14: adapter's synthetic `PathFinder` now includes
	 *  `use` as a no-op, matching `xxscreeps/game/path-finder/index.js`.
	 */
	| 'xxscreepsPathFinderUseMissing';

export type AdapterLimitations = Partial<Record<AdapterLimitation, boolean>>;

// ── Runtime lookup ────────────────────────────────────────────

type AdapterFactory = { createAdapter(): Promise<ScreepsOkAdapter> };

let cachedAdapter: ScreepsOkAdapter | undefined;

async function loadAdapter(): Promise<ScreepsOkAdapter> {
	if (cachedAdapter) return cachedAdapter;
	const adapterPath = process.env.SCREEPS_OK_ADAPTER;
	if (!adapterPath) throw new Error('SCREEPS_OK_ADAPTER env var not set');
	const mod = (await import(resolve(process.cwd(), adapterPath))) as AdapterFactory;
	cachedAdapter = await mod.createAdapter();
	return cachedAdapter;
}

/**
 * Ask the active adapter whether it reports a given limitation. Used in
 * test bodies that need conditional branching rather than whole-test
 * skipping — for the whole-test case, reach for `limitationGated` instead.
 */
export async function hasDocumentedAdapterLimitation(
	limitation: AdapterLimitation,
): Promise<boolean> {
	const adapter = await loadAdapter();
	return Boolean(adapter.limitations?.[limitation]);
}
