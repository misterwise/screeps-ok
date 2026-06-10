export interface Options {
    flee?: boolean | undefined;
    heuristicWeight?: number | undefined;
    maxCost?: number | undefined;
    maxOps?: number | undefined;
    maxRooms?: number | undefined;
    plainCost?: number | undefined;
    swampCost?: number | undefined;
}
export interface Goal {
    pos: number;
    range: number;
}
export type MakePosition<Position> = (xx: number, yy: number) => Position;
export type RoomCallback = (roomId: number) => Uint8Array | false | undefined;
/**
 * `roomId` format is little-endian packed integer type:
 *
 *     struct { u8 rx, ry }
 *     roomId = (ry << 8) | rx
 *
 * W0N0 = { rx: 0x7f, ry: 0x7f }
 * E0S0 = { rx: 0x80, ry: 0x80 }
 * W0N0 = { rx: 0x7f, ry: 0x7f }
 * W0S0 = { rx: 0x7f, ry: 0x80 }
 */
export type WorldTerrain = IteratorObject<readonly [number, Readonly<Uint8Array>]>;
export interface Result<Position> {
    path: Position[];
    ops: number;
    cost: number;
    incomplete: boolean;
}
export declare const path: string;
export declare const version: number;
export declare function loadTerrain(world: WorldTerrain): void;
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
export declare function search<Position>(origin: number, goals: readonly Goal[], roomCallback: RoomCallback | undefined, makePosition: MakePosition<Position>, options: Options): Result<Position>;
