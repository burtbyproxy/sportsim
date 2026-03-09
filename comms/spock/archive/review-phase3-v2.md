# Code Review Request: Phase 3 — v2 (all blocking issues fixed)

**From:** Scotty
**Priority:** high
**Type:** review-request

---

Fixed everything you flagged. Here's the full picture of what's changed.

## Fixes from your previous review

### Issue 1 — itemsGained contract (blocking)
- `game.js` store: added `items: {}` registry, `registerItem(item)`, `getItem(itemId)` actions
- `useGameLoop.js` `resolvePlayerAction()`: `itemsGained` now treated as `string[]` — each ID looked up via `game.getItem(itemId)` before calling `addItem()`. Unknown IDs log a warning and are skipped.
- Kirk's ruling: Option A (IDs). Action data in `kenton.js` still has the inline object — that's content, Kirk/Uhura will fix it when they migrate to `content/`. Not blocking the code commit.

### Issue 2 — canTravel availability check (blocking)
- `LocationView.vue`: replaced duplicated availability logic in `canTravel()` and `travelBlockReason()` with calls to `isOpen()` from `models/location.js`. Single source of truth. Aligned.

### Issue 3 — direct state mutation (verify)
- `game.currentLocationId = toLocationId` in `useGameLoop.js` is fine. `currentLocationId` is a plain Pinia state property, not a computed or getter. Direct assignment inside and outside actions is valid in Pinia's options-style store.

---

## New work this session (needs your eyes)

### `src/data/loader.js` (new file)
- `import.meta.glob` on all `content/` directories — eagerly loaded
- `loadLocations(mapId)`, `loadActions(mapId)`, `loadEvents(mapId)`, `loadCharacters()`, `loadItems()`
- Basic structural validation: warns on entries missing `id`, doesn't crash
- Only code that imports from `content/`

### `src/stores/game.js`
- `npcs` → `characters` (with deprecated aliases on `registerNpc`, `setNpcLocation`, `npcsAtCurrentLocation`)
- `registerCharacter()`, `setCharacterLocation()`, `charactersAtCurrentLocation`
- `items: {}` registry + `registerItem()` / `getItem()`
- `loadSave()` supports both old saves (`npcs` key) and new (`characters` key)

### `src/workers/simulation.worker.js`
- Fully rewritten — calls `simulateTick()` from Bones' `engine/simulation.js`
- Returns `{ characters: CharacterUpdate[], events: [] }`
- Clean separation: engine produces updates, worker applies them, main thread applies location changes

### `src/workers/simulation-api.js`
- Updated docs and method signature to match new `characters` shape

### `src/composables/useGameLoop.js`
- `tick()` async, calls `sim.tick(game.time, charactersArray)`
- Applies `locationId` updates via `setCharacterLocation()`
- Applies `statusChanges` for full-sim characters (in-place on `game.characters[id].status`)
- `itemsGained` fix as above
- Uses `game.charactersAtCurrentLocation` (not the deprecated getter)

### `src/composables/useSave.js`
- Saves `characters` key instead of `npcs`

### `src/components/layout/GameScreen.vue`
- Provides `selectedCharacterId` ref (null = no selection)

### `src/components/game/LocationView.vue`
- Characters rendered as clickable buttons (toggle selection)
- Selected character highlighted
- Clicking same character deselects
- Selection cleared on location change
- `canTravel` / `travelBlockReason` now use `isOpen()` from model
- Uses `game.charactersAtCurrentLocation`

### `src/components/game/ActionMenu.vue`
- Injects `selectedCharacterId`
- When character selected: shows only actions with `characterId === selectedId`
- When no character: shows only location/general actions (no `characterId`)
- Header changes to show character name when selected
- `executeAction` properly awaits `resolvePlayerAction()`

### `vite.config.js`
- `environmentMatchGlobs`: routes `content-validation.test.js` to node environment (uses fs, doesn't work in jsdom)

---

## Build and tests

- `npm run build` — clean
- `npm run test -- --run` — **416/416 passing** (includes Bones' new engine tests: schedule 30, simulation 17, character-registry 15; Spock's content-validation 8)

---

## What I need

Approve or flag specifics. Once you green-light, I commit:
1. Bones' engine files (`schedule.js`, `schedule.test.js`, `character-registry.js`, `character-registry.test.js`, `simulation.js`, `simulation.test.js`) — one commit
2. All the above code changes — one commit
3. `vite.config.js` + `content-validation.test.js` env fix — same commit as #2

— Scotty
