/**
 * Engine-internals access surface for the xxscreeps adapter.
 *
 * Every `#`-prefixed field access in `index.ts` and `snapshots.ts` MUST go
 * through a helper in this file. See
 * `docs/xxscreeps-engine-internals-policy.md` for the policy.
 *
 * Categories:
 *   SETUP    — prime initial state the engine then manages.
 *   SNAPSHOT — read during peekRoom when no public getter exists.
 *   INJECT   — add/remove objects from the world.
 *
 * Each helper carries a `<CATEGORY> — <engine file:line>` tag.
 */

import type { Room } from 'xxscreeps/game/room/index.js';
import type { StructureController } from 'xxscreeps/mods/controller/controller.js';

// ── INJECT ───────────────────────────────────────────────────────────

/** INJECT — game/room/room.ts: `#insertObject` appends to the room's object list. */
export function insertRoomObject(room: Room, obj: any, initial = false): void {
	room['#insertObject'](obj, initial);
}

/** INJECT — game/room/room.ts: `#removeObject` removes from the room's object list. */
export function removeRoomObject(room: Room, obj: any): void {
	room['#removeObject'](obj);
}

/** INJECT — game/room/room.ts: `#objects` is the authoritative object collection;
 *  `Room.find()` requires FIND_* constants and has no "all objects" mode. */
export function iterateRoomObjects(room: Room): Iterable<any> {
	return room['#objects'];
}

// ── SETUP: room + controller ─────────────────────────────────────────

/** SETUP — game/room/room.ts: `#level` mirrors the controller's RCL on the room;
 *  consulted by the controller getter and room-energy calculations. */
export function setRoomLevel(room: Room, level: number): void {
	(room as any)['#level'] = level;
}

/** SETUP — game/room/room.ts: read `#level` during structure placement to derive
 *  RCL-dependent caps (e.g. extension capacity). */
export function getRoomLevel(room: Room): number {
	return (room as any)['#level'] ?? 0;
}

/** SETUP — game/room/room.ts: `#user` is the owning engine userId on the room;
 *  mirrors `controller['#user']`. */
export function setRoomOwner(room: Room, userId: string | null): void {
	(room as any)['#user'] = userId;
}

/** SETUP — mods/controller/controller.ts: `#user` is the owning engine userId. */
export function setControllerOwner(controller: StructureController, userId: string): void {
	(controller as any)['#user'] = userId;
}

/** SETUP — mods/controller/controller.ts:28 safeMode getter returns
 *  `Math.max(0, #safeModeUntil - Game.time)`; `#safeModeUntil` is on the Room. */
export function setRoomSafeModeUntil(room: Room, gameTime: number, ticksRemaining: number): void {
	(room as any)['#safeModeUntil'] = gameTime + ticksRemaining;
}

/** SETUP — mods/controller/controller.ts: ticksToDowngrade getter returns
 *  `Math.max(0, #downgradeTime - Game.time)`. */
export function setControllerDowngradeTime(
	controller: StructureController, gameTime: number, ticksRemaining: number,
): void {
	(controller as any)['#downgradeTime'] = gameTime + ticksRemaining;
}

/** SETUP — reset all engine-managed controller timers to zero so a canonical
 *  test controller starts from a known state. Used by resetRoomToCanonicalLayout. */
export function resetControllerTimers(controller: StructureController): void {
	const c = controller as any;
	c['#downgradeTime'] = 0;
	c['#progress'] = 0;
	c['#reservationEndTime'] = 0;
	c['#safeModeCooldownTime'] = 0;
	c['#upgradeBlockedUntil'] = 0;
}

/** SETUP — reset Room-level controller flags to canonical zero state. Used by
 *  resetRoomToCanonicalLayout before re-inserting a fresh controller. */
export function resetRoomControllerFlags(room: Room): void {
	const r = room as any;
	r['#safeModeUntil'] = 0;
	r['#sign'] = undefined;
}

// ── SETUP: object positioning ────────────────────────────────────────

/** SETUP — game/object.ts: `#posId` is the packed position id used by the spatial
 *  index. Must be kept in sync with `.pos` or spatial lookups miss the object. */
export function bindObjectPos(obj: any, pos: any): void {
	obj.pos = pos;
	obj['#posId'] = pos['#id'];
}

// ── SETUP: lifecycle timers ──────────────────────────────────────────

/** SETUP — mods/creep/creep.ts: ticksToLive getter returns `#ageTime - Game.time`. */
export function setCreepAgeTime(creep: any, gameTime: number, ticksToLive: number): void {
	creep['#ageTime'] = gameTime + ticksToLive;
}

/** SETUP — mods/source/source.ts: ticksToRegeneration getter derives from
 *  `#nextRegenerationTime - Game.time`. */
export function setSourceNextRegenerationTime(
	source: any, gameTime: number, ticksToRegen: number,
): void {
	source['#nextRegenerationTime'] = gameTime + ticksToRegen;
}

/** SETUP — mods/mineral/mineral.ts: mineral regen timer, absolute tick. */
export function setMineralNextRegenerationTime(
	mineral: any, gameTime: number, ticksToRegen: number,
): void {
	(mineral as any)['#nextRegenerationTime'] = gameTime + ticksToRegen;
}

/** SETUP — mods/{resource,road,defense}/processor.ts: `#nextDecayTime` is the
 *  absolute tick the structure decays; ticksToDecay getter returns
 *  `#nextDecayTime - Game.time`. */
export function setStructureNextDecayTime(
	structure: any, gameTime: number, ticksToDecay: number,
): void {
	(structure as any)['#nextDecayTime'] = gameTime + ticksToDecay;
}

/** SETUP — mods/creep/tombstone.ts: `#creep` holds the post-death summary the
 *  tombstone exposes; `#decayTime` is the absolute expiry tick. */
export function primeTombstoneCorpse(tombstone: any, creepSummary: any, decayTime: number): void {
	tombstone['#creep'] = creepSummary;
	tombstone['#decayTime'] = decayTime;
}

/** SETUP — mods/structure/ruin.ts: `#structure` holds the deceased structure
 *  summary; `#decayTime` is the absolute expiry. */
export function primeRuinStructure(ruin: any, structureSummary: any, decayTime: number): void {
	ruin['#structure'] = structureSummary;
	ruin['#decayTime'] = decayTime;
}

/** SETUP — mods/source/keeper-lair.ts:26 ticksToSpawn getter returns
 *  `Math.max(0, #nextSpawnTime - Game.time)`. */
export function setKeeperLairNextSpawnTime(
	lair: any, gameTime: number, ticksRemaining: number,
): void {
	lair['#nextSpawnTime'] = gameTime + ticksRemaining;
}

// ── SETUP: store manipulation ────────────────────────────────────────

/** SETUP — game/store.ts: `#add` adds resource amount to the store. Mirrors what
 *  the engine processor does when gameplay deposits resources. */
export function storeAdd(store: any, resource: string, amount: number): void {
	store['#add'](resource, amount);
}

/** SETUP — game/store.ts: `#subtract` removes resource amount. */
export function storeSubtract(store: any, resource: string, amount: number): void {
	store['#subtract'](resource, amount);
}

/** SETUP — game/store.ts: `#entries` iterates [resource, amount] pairs. */
export function storeEntries(store: any): Iterable<[string, number]> {
	return typeof store?.['#entries'] === 'function'
		? store['#entries']()
		: Object.entries(store ?? {});
}

/** SETUP — mods/creep/creep.ts: after applying CARRY boosts that extend capacity,
 *  resize `#capacity` to the recomputed body-based capacity. */
export function setStoreCapacity(store: any, capacity: number): void {
	(store as any)['#capacity'] = capacity;
}

// ── SNAPSHOT ─────────────────────────────────────────────────────────

/** SNAPSHOT — mods/creep/creep.ts:76 `obj.owner` depends on `userInfo` which is
 *  empty during peekRoom; `#user` is the raw engine userId. */
export function readRawOwnerId(obj: any): string | undefined {
	return obj['#user'] ?? obj.owner?.username;
}

/** SNAPSHOT — game/room/room.ts:44 `#initialize` materializes RoomObject
 *  instances and builds the FIND/LOOK indices. peekRoom callbacks that
 *  iterate `#objects` and call render hooks need indices populated first;
 *  the call is idempotent (guarded by `#didInitialize`). */
export function initializeRoomIndices(room: any): void {
	room['#initialize']?.();
}
