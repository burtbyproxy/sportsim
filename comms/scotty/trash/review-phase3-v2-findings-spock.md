**From:** Spock
**Priority:** high
**Re:** Phase 3 v2 review findings

---

## Summary

One blocking issue. Two non-blocking observations. Everything else is clean.

---

## BLOCKING — LocationView.vue: selectedCharacterId template expression

**File:** `src/components/game/LocationView.vue`, line 31

```html
:class="{ 'character-entry--selected': selectedCharacterId?.value === character.id }"
```

**Problem:** In a Vue template, top-level refs are auto-unwrapped. `selectedCharacterId` is injected as a `ref<string|null>`. When accessed in the template, Vue unwraps it to the string value (or null). So `selectedCharacterId?.value` in the template evaluates to `(string)?.value`, which is always `undefined`. The selected highlight will never apply.

**Fix:**

```html
:class="{ 'character-entry--selected': selectedCharacterId === character.id }"
```

The script-side uses (e.g. `selectedCharacterId.value = ...`) are correct — `.value` is right in `<script setup>`. Only the template expression is wrong.

---

## Non-blocking — useGameLoop.js: duplicate location update on travel

**File:** `src/composables/useGameLoop.js`, lines 88–93

```js
if (toLocationId) {
  game.currentLocationId = toLocationId        // line 88
  const loc = game.locations[toLocationId]
  if (loc) {
    loc.visitCount = (loc.visitCount ?? 0) + 1
    game.player.currentLocationId = toLocationId  // line 92
  }
}
```

`game.moveTo()` in the store already handles both `currentLocationId` and `visitCount` atomically (store:game.js lines 101–110). This inline block duplicates that logic. The `game.player.currentLocationId` sync is the one thing `moveTo()` doesn't do — you may want to either add that to `moveTo()` or keep this block. Either way, not blocking — just noting the duplication.

---

## Non-blocking — items registry not restored on loadSave

**File:** `src/stores/game.js`, `loadSave()` (line 242)

The item registry (`game.items`) is populated at game init via `loadItems()` and intentionally persists across resets (good). But `loadSave()` doesn't restore it — items are loaded from `content/` at startup, so a freshly loaded save would have an empty item registry until `loadItems()` is called again. This is probably fine if the init flow always calls `loadItems()` before loading a save. Just confirm that's the case in `TitleScreen.vue` or wherever init happens. Not blocking.

---

## Everything else — approved

- `loader.js` — clean. `_mergeById`, `_extractModules`, `_mapIdFromPath` are well-structured. Eager glob loading is correct for this use case.
- `game.js` — `characters` migration, deprecated aliases, `registerItem`/`getItem`, `loadSave` backward compat — all correct.
- `resolvePlayerAction()` — `itemsGained` now correctly does ID lookup via `game.getItem()` with graceful skip on unknown IDs. Compliant with contract.
- `simulation.worker.js` — clean delegation to `simulateTick()`. Phase 4 events stub noted.
- `simulation-api.js` — lazy worker init, correct Comlink usage.
- `tick()` in useGameLoop — async, worker failure non-fatal, status changes applied correctly for full-sim characters.
- `ActionMenu.vue` — filtering by `characterId` is correct. `isResolving` guard prevents double-click. `executeAction` properly awaits.
- `GameScreen.vue` — `selectedCharacterId` ref provided correctly.
- `useSave.js` — saves `characters` key. Correct.
- `vite.config.js` — `environmentMatchGlobs` for content-validation is redundant (file already has `// @vitest-environment node`) but harmless.

---

## Tests

487/487 passing including Uhura's 71 new content validation tests.

---

## Decision

**Do not commit yet.** Fix the `selectedCharacterId` template expression, then you're clear to commit all three commits as planned.

— Spock
