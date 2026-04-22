# PR-15 follow-up: foreign-segment coverage gaps

Five canonical vanilla behaviors that PR-15's implementation in xxscreeps handles but no external test exercises. Drafted for future implementation in `tests/25-memory/25.1-25.3-memory.test.ts` with matching `behaviors.md` catalog entries.

All five are cheap additions — they reuse the existing two-player harness from `RAWMEMORY-FOREIGN-002` (a p2 creep placed in p1's room so p1 can learn p2's username via `FIND_HOSTILE_CREEPS`, followed by cross-shard `runPlayer` calls). Each test adds one assertion about a distinct lifecycle or error path.

## Catalog entries to add to `behaviors.md`

Insert after the existing `RAWMEMORY-FOREIGN-004` entry in §25.3:

```
- `RAWMEMORY-FOREIGN-005` `behavior` `needs_vanilla_verification`
  A foreign-segment request persists across ticks: after `setActiveForeignSegment`,
  subsequent ticks deliver the segment via `RawMemory.foreignSegment` without
  the caller re-invoking `setActiveForeignSegment`.
- `RAWMEMORY-FOREIGN-006` `behavior` `needs_vanilla_verification`
  `setActiveForeignSegment(null)` clears the pending foreign-segment request;
  the next tick's `RawMemory.foreignSegment` is `undefined`.
- `RAWMEMORY-FOREIGN-007` `behavior` `needs_vanilla_verification`
  `setActiveForeignSegment` with an unknown username results in
  `RawMemory.foreignSegment === undefined` on the next tick (no throw, no crash).
- `RAWMEMORY-FOREIGN-008` `behavior` `needs_vanilla_verification`
  Revocation via `setPublicSegments` takes effect on the next foreign read:
  after a target removes a segment id from its public set, the foreign
  reader's `RawMemory.foreignSegment` becomes `undefined`.
- `RAWMEMORY-FOREIGN-009` `behavior` `needs_vanilla_verification`
  `setActiveForeignSegment` with an explicit id that the target has not
  published via `setPublicSegments` yields `RawMemory.foreignSegment === undefined`
  on the next tick.
```

Flip `needs_vanilla_verification` → `verified_vanilla` after running each test against the vanilla adapter.

## Test sketches

All tests follow the harness shape from `RAWMEMORY-FOREIGN-002`:

```ts
await shard.createShard({
  players: ['p1', 'p2'],
  rooms: [
    { name: 'W1N1', rcl: 1, owner: 'p1' },
    { name: 'W2N1', rcl: 1, owner: 'p2' },
  ],
});
await shard.placeCreep('W1N1', { pos: [10, 10], owner: 'p2', body: [MOVE] });
await shard.tick();
```

### RAWMEMORY-FOREIGN-005: foreign segment persists across ticks

**Assertion:** After a single `setActiveForeignSegment` call, the segment is delivered on tick N+1 AND tick N+2 without re-calling.

**Flow:**
1. p2 publishes segment 2: `RawMemory.setActiveSegments([2])`, tick, `segments[2] = 'persistent'`, `setPublicSegments([2])`, `setDefaultPublicSegment(2)`, tick.
2. p1 requests: `setActiveForeignSegment(p2username)`, tick.
3. p1 tick N+2: assert `RawMemory.foreignSegment.data === 'persistent'`.
4. p1 tick N+3 (no `setActiveForeignSegment` call): assert `RawMemory.foreignSegment.data === 'persistent'`.

**Regression trap:** catches closure-only resolution (data loss on PlayerInstance restart) and buggy one-shot request consumption.

### RAWMEMORY-FOREIGN-006: setActiveForeignSegment(null) clears

**Assertion:** After a successful foreign-segment request and delivery, calling `setActiveForeignSegment(null)` causes the next tick's `foreignSegment` to be `undefined`.

**Flow:**
1. p2 publishes segment 0, p1 requests, confirms delivery on tick N+1 (same setup as 002).
2. p1 tick N+2: `RawMemory.setActiveForeignSegment(null)`.
3. p1 tick N+3: assert `RawMemory.foreignSegment === undefined`.

**Notes:**
- The `undefined` check must be inside player code (`fs === undefined`) — JSON transport between runner and test may normalize undefined to null.
- Vanilla implementation: `activeForeignSegment = null` in runtime.js then user-doc `$unset` in make.js. xxscreeps implementation: `requestedForeignSegment = null` then save() persists empty string.

### RAWMEMORY-FOREIGN-007: unknown username fails gracefully

**Assertion:** `setActiveForeignSegment('DoesNotExist')` does not throw and yields `foreignSegment === undefined` next tick.

**Flow:**
1. No setup for p2's segments needed. Just create p1's room.
2. p1 tick N: assert no throw when calling `setActiveForeignSegment('DoesNotExist-a8f3')` (pick a name that cannot collide with NPC usernames like Invader / Source Keeper; append random suffix to be safe).
3. p1 tick N+1: assert `RawMemory.foreignSegment === undefined`.

**Regression trap:** vanilla's `db.users.findOne` returning null would null-deref if the resolver doesn't guard; xxscreeps implementation's `findUserByName` returns null and the resolver preserves prior state.

### RAWMEMORY-FOREIGN-008: revocation takes effect next tick

**Assertion:** Target's mid-request `setPublicSegments([])` causes the foreign reader's `foreignSegment` to become undefined on the subsequent tick.

**Flow:**
1. p2 publishes segment 4: `setActiveSegments([4])`, tick, `segments[4] = 'revocable'`, `setPublicSegments([4])`, `setDefaultPublicSegment(4)`, tick.
2. p1 requests: `setActiveForeignSegment(p2username)`, tick.
3. p1 tick: confirm `foreignSegment.data === 'revocable'`.
4. p2 revokes: `setPublicSegments([])`, tick.
5. p1 tick (no new `setActiveForeignSegment` call): assert `foreignSegment === undefined`.

**Notes:**
- Revocation is authorization-side, not data-side: the blob still exists in storage; only the public-segments membership set is modified.
- xxscreeps implementation: `shard.data.sismember` at refresh returns false → `payload.foreignSegment` stays unset.
- Tests the distinction between "persisted request" and "current authorization" — even though p1's request is still live, authorization has been withdrawn.

### RAWMEMORY-FOREIGN-009: explicit id without public grant

**Assertion:** `setActiveForeignSegment(p2, 5)` where p2 has NOT included 5 in `setPublicSegments` yields `foreignSegment === undefined`.

**Flow:**
1. p2 publishes segment 7 only: `setActiveSegments([7])`, tick, `segments[7] = 'seg7'`, `setPublicSegments([7])`, tick. (Deliberately no `setDefaultPublicSegment` so the default-fallback path isn't exercised.)
2. p1 requests the WRONG id: `setActiveForeignSegment(p2username, 5)`, tick.
3. p1 tick: assert `foreignSegment === undefined`.

**Regression trap:** distinct from 003 (which tests default-fallback-when-not-public). This asserts that explicitly-requested non-public ids are also rejected — guards against an implementation that only consults `publicSegments` in the default-fallback path.

## Implementation order

1. Add the five catalog entries to `behaviors.md`.
2. Write the five tests in `tests/25-memory/25.1-25.3-memory.test.ts` after `RAWMEMORY-FOREIGN-004`.
3. Run `node scripts/test.js vanilla tests/25-memory/` — all five should pass.
4. Flip `needs_vanilla_verification` → `verified_vanilla` in behaviors.md for each one that passes.
5. Run `node scripts/test.js xxscreeps tests/25-memory/` — all five should pass against the current pin (PR-15 landed).
6. If any fail on xxscreeps, it's either a PR-15 bug (unlikely; tests 002-004 cover the core paths) or a missing code path I didn't implement — file as parity gap.

## Scope notes

- Don't test input validation (`setPublicSegments(['abc'])`, `setDefaultPublicSegment(100)`). Throwing is engine-internal; message text isn't contract.
- Don't test the prior-resolution reuse optimization (same username + explicit id skips username lookup). Pure implementation detail, unobservable externally.
- Don't test cross-shard scoping explicitly. The `createShard` harness is single-shard and the test infrastructure doesn't expose multi-shard scenarios; this would require a separate multi-shard test track.
