import pf from '#pf';
export const path = pf.path;
export const version = pf.version;
export function loadTerrain(world) {
    pf.loadTerrain([...world.map(([room, terrain]) => ({ room, terrain }))]);
}
/**
 * `position` format is little-endian backed "world position" type:
 *
 *     struct { u16 wx, wy; };
 * 		 wx = rx * 50 + xx;
 *     wy = ry * 50 + yy;
 *     position = (yy << 16) | xx
 *
 * RoomPosition(0, 0, 'W127N127') = { wx: 0, wy: 0 }
 * RoomPosition(49, 49, 'E127S127') = { xx: 12799, yy: 12799 }
 */
export function search(origin, goals, roomCallback, makePosition, options) {
    // Short circuit if there are no goals
    if (goals.length === 0) {
        return { path: [], ops: 0, cost: 0, incomplete: false };
    }
    // Extract and cast options
    const plainCost = Number(options.plainCost ?? 1) | 0;
    const swampCost = Number(options.swampCost ?? 5) | 0;
    const heuristicWeight = Number(options.heuristicWeight) || 1.2;
    const maxOps = Number(options.maxOps ?? 0x7fffffff) | 0;
    const maxCost = Number(options.maxCost ?? 0x7fffffff) | 0;
    const maxRooms = Number(options.maxRooms ?? 16) | 0;
    const flee = Boolean(options.flee);
    // Invoke native code
    const ret = pf.search(origin, goals, roomCallback, plainCost, swampCost, maxRooms, maxOps, maxCost, flee, heuristicWeight);
    // Translate results
    return {
        ...ret,
        path: makeCompletePath(makePosition, ret.path),
    };
}
function makeCompletePath(make, path) {
    const iterable = function* () {
        const first = path[0];
        if (first !== undefined) {
            let xx = first & 0xffff;
            let yy = first >> 16;
            yield make(xx, yy);
            for (let ii = 1; ii < path.length; ++ii) {
                const next = path[ii];
                const nx = next & 0xffff;
                const ny = next >> 16;
                const dx = Math.sign(nx - xx);
                const dy = Math.sign(ny - yy);
                while (nx !== xx || ny !== yy) {
                    xx += dx;
                    yy += dy;
                    yield make(xx, yy);
                }
            }
        }
    }();
    const result = [...iterable];
    result.pop();
    return result.reverse();
}
//# sourceMappingURL=pathfinder.mjs.map