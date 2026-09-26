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
import type { StructureController } from 'xxscreeps/mods/classic/controller/controller.js';
import { optionalExpiryTime } from 'xxscreeps/game/object.js';

// A pin bump that renames a field would otherwise take the write as a dead own property.
function setField(obj: any, key: `#${string}`, value: unknown): void {
	if (!(key in obj)) throw new Error(`engine-internals: ${obj?.constructor?.name} has no '${key}' at this xxscreeps pin`);
	obj[key] = value;
}

function getField(obj: any, key: `#${string}`): any {
	if (!(key in obj)) throw new Error(`engine-internals: ${obj?.constructor?.name} has no '${key}' at this xxscreeps pin`);
	return obj[key];
}

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
	setField(room, '#level', level);
}

/** SETUP — game/room/room.ts: read `#level` during structure placement to derive
 *  RCL-dependent caps (e.g. extension capacity). */
export function getRoomLevel(room: Room): number {
	return getField(room, '#level');
}

/** SETUP — game/room/room.ts: `#user` is the owning engine userId on the room;
 *  mirrors `controller['#user']`. */
export function setRoomOwner(room: Room, userId: string | null): void {
	setField(room, '#user', userId);
}

/** SETUP — mods/controller/controller.ts: `#user` is the owning engine userId. */
export function setControllerOwner(controller: StructureController, userId: string): void {
	setField(controller, '#user', userId);
}

/** SETUP — mods/controller/controller.ts:28 safeMode getter returns
 *  `Math.max(0, #safeModeUntil - Game.time)`; `#safeModeUntil` is on the Room. */
export function setRoomSafeModeUntil(room: Room, gameTime: number, ticksRemaining: number): void {
	setField(room, '#safeModeUntil', gameTime + ticksRemaining);
}

/** SETUP — mods/controller/controller.ts: ticksToDowngrade getter returns
 *  `Math.max(0, #downgradeTime - Game.time)`. */
export function setControllerDowngradeTime(
	controller: StructureController, gameTime: number, ticksRemaining: number,
): void {
	setField(controller, '#downgradeTime', gameTime + ticksRemaining);
}

/** SETUP — reset all engine-managed controller timers to zero so a canonical
 *  test controller starts from a known state. Used by resetRoomToCanonicalLayout. */
export function resetControllerTimers(controller: StructureController): void {
	const c = controller as any;
	setField(c, '#downgradeTime', 0);
	setField(c, '#progress', 0);
	setField(c, '#reservationEndTime', 0);
	setField(c, '#safeModeCooldownTime', 0);
	setField(c, '#upgradeBlockedUntil', 0);
}

/** SETUP — reset Room-level controller flags to canonical zero state. Used by
 *  resetRoomToCanonicalLayout before re-inserting a fresh controller. */
export function resetRoomControllerFlags(room: Room): void {
	const r = room as any;
	setField(r, '#safeModeUntil', 0);
	setField(r, '#sign', undefined);
}

// ── SETUP: object positioning ────────────────────────────────────────

/** SETUP — game/object.ts: `#posId` is the packed position id used by the spatial
 *  index. Must be kept in sync with `.pos` or spatial lookups miss the object. */
export function bindObjectPos(obj: any, pos: any): void {
	obj.pos = pos;
	setField(obj, '#posId', getField(pos, '#id'));
}

// ── SETUP: lifecycle timers ──────────────────────────────────────────

/** SETUP — mods/classic/creep/creep.ts: ticksToLive getter returns `#ageTime - Game.time`.
 *  mods/mmo/powercreep/powercreep.ts reuses the field with the same absolute-tick
 *  meaning, where a non-zero value additionally marks the roster entry as spawned. */
export function setCreepAgeTime(creep: any, gameTime: number, ticksToLive: number): void {
	setField(creep, '#ageTime', gameTime + ticksToLive);
}

/** SETUP — mods/mmo/powercreep/schema.ts: `#powers` is the packed power vector behind
 *  the `powers` getter and `level`. `cooldownTime` is an absolute tick (`0` = ready);
 *  the public `powers` getter resolves it against `Game.time`. */
export function setPowerCreepPowers(
	creep: any, powers: Array<{ power: number; level: number; cooldownTime: number }>,
): void {
	setField(creep, '#powers', powers);
}

/** SETUP — mods/source/source.ts: ticksToRegeneration getter derives from
 *  `#nextRegenerationTime - Game.time`. */
export function setSourceNextRegenerationTime(
	source: any, gameTime: number, ticksToRegen: number,
): void {
	setField(source, '#nextRegenerationTime', gameTime + ticksToRegen);
}

/** SETUP — mods/mineral/mineral.ts: mineral regen timer, absolute tick. */
export function setMineralNextRegenerationTime(
	mineral: any, gameTime: number, ticksToRegen: number,
): void {
	setField(mineral, '#nextRegenerationTime', gameTime + ticksToRegen);
}

/** SETUP — mods/{resource,road,defense}/processor.ts: `#nextDecayTime` is the
 *  absolute tick the structure decays; ticksToDecay getter returns
 *  `#nextDecayTime - Game.time`. */
export function setStructureNextDecayTime(
	structure: any, gameTime: number, ticksToDecay: number,
): void {
	setField(structure, '#nextDecayTime', gameTime + ticksToDecay);
}

/** SETUP — mods/{logistics/link,chemistry/lab,mineral/extractor,factory/factory}.ts:
 *  cooldown getter returns `Math.max(0, #cooldownTime - Game.time)`. The xxscreeps
 *  processors set this via `structure['#cooldownTime'] = Game.time + ticks`. The
 *  public `cooldown` property is getter-only — direct assignment throws.
 *  Returns true when the structure type stores a `#cooldownTime`, false when the
 *  caller asked to set cooldown on a structure that has no cooldown field
 *  (e.g. a mod stub like StructureNuker on a build without the nuke mod). */
export function setStructureCooldownRemaining(
	structure: any, gameTime: number, ticksRemaining: number,
): boolean {
	if (!('#cooldownTime' in structure)) return false;
	structure['#cooldownTime'] = gameTime + ticksRemaining;
	return true;
}

/** SETUP — mods/factory/factory.ts: `#level` is the permanent factory level set
 *  by an OPERATE_FACTORY power; level getter returns `#level === 0 ? undefined : #level`.
 *  Public `level` property is getter-only. */
export function setFactoryLevel(factory: any, level: number): void {
	setField(factory, '#level', level);
}

/** SETUP — mods/creep/tombstone.ts: `#creep` holds the post-death summary the
 *  tombstone exposes; `#decayTime` is the absolute expiry tick. */
export function primeTombstoneCorpse(tombstone: any, creepSummary: any, decayTime: number): void {
	setField(tombstone, '#creep', creepSummary);
	setField(tombstone, '#decayTime', decayTime);
}

/** SETUP — mods/structure/ruin.ts: `#structure` holds the deceased structure
 *  summary; `#decayTime` is the absolute expiry. */
export function primeRuinStructure(ruin: any, structureSummary: any, decayTime: number): void {
	setField(ruin, '#structure', structureSummary);
	setField(ruin, '#decayTime', decayTime);
}

/** SETUP — mods/source/keeper-lair.ts:26 ticksToSpawn getter returns
 *  `Math.max(0, #nextSpawnTime - Game.time)`. */
export function setKeeperLairNextSpawnTime(
	lair: any, gameTime: number, ticksRemaining: number,
): void {
	setField(lair, '#nextSpawnTime', gameTime + ticksRemaining);
}

/** SETUP — mods/modern/stronghold/invader-core.ts: `#collapseTime` is the absolute tick the
 *  core collapses; the effects getter exposes it as EFFECT_COLLAPSE_TIMER and the
 *  object tick processor removes the core once it elapses. */
export function setInvaderCoreCollapseTime(
	core: any, gameTime: number, ticksRemaining: number,
): void {
	setField(core, '#collapseTime', gameTime + ticksRemaining);
}

/** SETUP — mods/modern/stronghold/schema.ts: `#templateName` is the bunker layout
 *  `deployStronghold` spawns when the deploy timer elapses; it throws when unset. */
export function setInvaderCoreTemplateName(core: any, templateName: string): void {
	setField(core, '#templateName', templateName);
}

/** SETUP — mods/modern/stronghold/processor.ts createCreep intent: an in-progress defender
 *  spawn is an incubating creep at `#ageTime === 0` plus a Spawning record wired
 *  to the core and creep ids; `#spawnTime` is the absolute birth tick. Mirrors
 *  the state the intent processor seeds so the object tick processor completes
 *  the spawn. */
export function primeInvaderCoreSpawning(
	core: any, creep: any, spawning: any, gameTime: number, ticksRemaining: number,
): void {
	setField(creep, '#ageTime', 0);
	setField(spawning, '#spawnId', core.id);
	setField(spawning, '#spawningCreepId', creep.id);
	setField(spawning, '#spawnTime', gameTime + ticksRemaining);
	core.spawning = spawning;
}

/** SETUP — mods/deposit/deposit.ts: cooldown getter derives from `#cooldownTime`;
 *  ticksToDecay wraps `#nextDecayTime` in `requiredExpiryTime`, which throws on
 *  a stale tick, so `decayTicks` is mandatory. `#harvested` feeds the
 *  exhaust-cooldown growth in the harvest processor. */
export function setDepositState(
	deposit: any, gameTime: number,
	state: { cooldownTicks?: number; decayTicks: number; harvested?: number },
): void {
	if (state.cooldownTicks !== undefined) setField(deposit, '#cooldownTime', gameTime + state.cooldownTicks);
	if (state.harvested !== undefined) setField(deposit, '#harvested', state.harvested);
	setField(deposit, '#nextDecayTime', gameTime + state.decayTicks);
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
	return store['#entries']();
}

/** SETUP — mods/creep/creep.ts: after applying CARRY boosts that extend capacity,
 *  resize `#capacity` to the recomputed body-based capacity. */
export function setStoreCapacity(store: any, capacity: number): void {
	setField(store, '#capacity', capacity);
}

// ── SETUP: account keyspace ──────────────────────────────────────────

/** SETUP — mods/mmo/powercreep/model.ts: the account power-creep roster is one blob per
 *  user. The mod exports a loader (`loadPowerCreepsBlob`) but no writer — its own writes
 *  go through the check-gated `mutate`, which would reject seeded states a player would
 *  have to reach over many GPL levels. */
export function powerCreepRosterKey(userId: string): string {
	return `user/${userId}/powerCreeps`;
}

// ── SNAPSHOT ─────────────────────────────────────────────────────────

/** SNAPSHOT — mods/creep/creep.ts:76 `obj.owner` depends on `userInfo` which is
 *  empty during peekRoom; `#user` is the raw engine userId. A power bank has no
 *  user, only a fixed `owner.username`. */
export function readRawOwnerId(obj: any): string | undefined {
	return obj['#user'];
}

/** SNAPSHOT — mods/classic/controller/controller.ts:85 the `reservation` getter resolves the
 *  reserving player through `userInfo`, which is empty during peekRoom. The controller's
 *  `#reservationEndTime` and its room's `#user` carry the same state. */
export function readRawReservation(
	controller: StructureController,
): { userId: string; ticksToEnd: number } | undefined {
	const ticksToEnd = optionalExpiryTime(getField(controller, '#reservationEndTime'));
	return ticksToEnd === undefined ? undefined : { userId: getField(controller.room, '#user'), ticksToEnd };
}

/** SNAPSHOT — mods/classic/controller/controller.ts:102 the `sign` getter resolves the signing
 *  player through `userInfo`; `#sign` on the room is the stored record. */
export function readRawSign(
	controller: StructureController,
): { userId: string; text: string; time: number } | undefined {
	return getField(controller.room, '#sign');
}

/** SNAPSHOT — game/room/room.ts:44 `#initialize` materializes RoomObject
 *  instances and builds the FIND/LOOK indices. peekRoom callbacks that
 *  iterate `#objects` and call render hooks need indices populated first;
 *  the call is idempotent (guarded by `#didInitialize`). */
export function initializeRoomIndices(room: any): void {
	room['#initialize']();
}
