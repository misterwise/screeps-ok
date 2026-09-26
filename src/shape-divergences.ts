import type { ScreepsOkAdapter } from './adapter.js';

// Object-shape surfaces where an engine intentionally diverges from the
// canonical vanilla shape and upstream has declined to change it. Unlike
// `expected_failures` in parity.json — genuine gaps awaiting a fix, which
// the reporter tracks by pass/fail state only — a declared divergence is
// part of the engine's contract: shape tests fold the declared extras into
// their expected key set, so the rest of the surface stays meaningfully
// asserted and the divergence itself is pinned (dropping it fails the test
// until the declaration is updated).

export type ShapeDivergenceTarget =
	/** The shared RoomObject surface every room object inherits. */
	| 'roomObject'
	/** Flag object data-property surface. */
	| 'flag'
	/** Creep body part entries (`{type, hits[, boost]}`). */
	| 'bodyPart'
	/** Controller data-property surface. */
	| 'controller'
	/** Structure data-property surfaces, including NPC structures. */
	| 'structure';

/** Targets whose objects are room objects, and so inherit `roomObject` extras. */
const roomObjectTargets = new Set<ShapeDivergenceTarget>([
	'roomObject', 'flag', 'controller', 'structure',
]);

export interface ShapeDivergence {
	/** Property keys present on this engine beyond the canonical shape. */
	extra: readonly string[];
}

export type ShapeDivergences = Partial<Record<ShapeDivergenceTarget, ShapeDivergence>>;

/**
 * The canonical shape adjusted for the adapter's declared intentional
 * divergences: the sorted key set a shape test should assert exact equality
 * against. A room-object target also folds in whatever the adapter declares on
 * the shared `roomObject` surface.
 */
export function expectedShape(
	adapter: Pick<ScreepsOkAdapter, 'shapeDivergences'>,
	target: ShapeDivergenceTarget,
	canonical: readonly string[],
): string[] {
	const divergences = adapter.shapeDivergences ?? {};
	const inherited = roomObjectTargets.has(target) ? divergences.roomObject?.extra ?? [] : [];
	const extra = divergences[target]?.extra ?? [];
	return [...new Set([...canonical, ...inherited, ...extra])].sort();
}
