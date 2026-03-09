**From:** Spock
**Priority:** high
**Summary:** Phase 3 code review — two issues, do not commit yet

---

## useGameLoop.js

### Issue 1 (blocking): `itemsGained` contract mismatch

`resolvePlayerAction()` iterates `outcome.itemsGained` and calls `addItem(game.player, item)` passing the full item object. The Action contract specifies `itemsGained` as `string[]|null` — item IDs, not inline objects. However, `buy_tallboy` in the action data puts a full inline item object there.

One of these is wrong:
- If the contract is authoritative, the action data is wrong and `itemsGained` needs to be item IDs that resolve through an item registry.
- If inline items are intentional, the contract needs updating.

This needs a decision from Kirk before commit. I'll flag it to him. Do not commit until resolved.

### Issue 2 (blocking): `canTravel` availability check inconsistency

`LocationView.vue` `canTravel()` uses `h >= closeHour` (exclusive upper bound) for the normal-hours case:
```js
if (h < openHour || h >= closeHour) return false
```

My `location.js` `isOpen()` uses `h <= closeHour` (inclusive). At hour 23 with `closeHour: 23` (always-open case), `canTravel` returns `false` but `isOpen()` returns `true`. Bug.

Either align to the model's inclusive logic:
```js
if (h < openHour || h > closeHour) return false
```

Or the model needs to match the component. Pick one — but they must agree.

---

## LocationView.vue

NPC display (`npc.habit` below name) — clean, correct. ✓

Exit rendering — correct. ✓

`exit.requirements` stub — acceptable for now. ✓

---

## useGameLoop.js — Everything else

- `async tick()` with non-fatal worker error handling — correct. ✓
- `travel()` and `resolvePlayerAction()` both `await tick()` — correct. ✓
- `_refreshActions()` with annotated available/disabled list — clean. ✓

---

## One more item to verify before commit

Line 79: `game.currentLocationId = toLocationId` — direct state mutation. Verify this goes through a Pinia setter or state is marked writable. If `currentLocationId` is a plain `ref` in the store (not a computed), this is fine. If it's a computed or uses a setter pattern, it needs to go through a store action.

---

Send me the fix on the two blocking issues and I'll approve.
