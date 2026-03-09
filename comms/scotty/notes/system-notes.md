# Scotty's Engineering Notes

## Git Ownership Policy (Admiral's orders)

- **I am the sole code committer.** Nobody else runs `git add` or `git commit` on `src/`, `tests/`, or config files.
- Spock and Bones write code, notify me via inbox when ready. I review, stage, commit.
- Kirk commits all `comms/` changes.
- When staging code from others: `git add` ONLY the specific files they flagged. Never `git add .` or `git add <directory>`. Be surgical.
- If in doubt: `git status` first, then add file by file.

## Gatekeeper Rules

- Review everything before it goes in — mine included.
- Sloppy? Send it back. Clever when simple would do? Send it back. Breaks a contract? Send it back.
- If the repo breaks, it's on me. Act accordingly.

## Pre-Commit Checklist (NON-NEGOTIABLE)

1. Code ready → drop summary in Spock's inbox for review
2. Wait for Spock's response
3. Fix anything flagged
4. THEN commit

This applies to MY code too. Especially mine. No exceptions.

## Vitest Environment

- Default test environment is `jsdom` (set in `vite.config.js`).
- Tests that use Node.js `fs` (e.g. reading `content/` JSON files) must use the node environment.
- **Do NOT rely on `// @vitest-environment node` comment alone** — it did not work reliably in Vitest 1.6.1 in this project.
- **Working fix:** use `environmentMatchGlobs` in `vite.config.js` to explicitly route test files to the node environment. Example:
  ```js
  environmentMatchGlobs: [
    ['tests/content-validation.test.js', 'node'],
    ['tests/integration/action-pipeline.test.js', 'node'],
    ['tests/kenton-locations.test.js', 'node'],
  ]
  ```
- When adding new test files that use `fs`, add them to this list AND add `// @vitest-environment node` comment for documentation.

## SCSS + Vite

- Do NOT use `additionalData` with `@use` in Vite's SCSS preprocessor config — it injects before every file including the variables file itself, causing circular undefined variable errors.
- Fix: each SCSS partial that uses variables must `@use 'variables' as *;` at the top explicitly.
- `silenceDeprecations: ['legacy-js-api']` silences the Sass legacy API warning — it's cosmetic, not a real problem.

## Module System

- `package.json` has `"type": "module"` — all `.js` files are ESM. CJS config files must use `.cjs` extension (e.g., `.eslintrc.cjs`).

## Vite Worker Config

- Workers must have `{ type: 'module' }` in both Vite config (`worker: { format: 'es' }`) and the `new Worker()` call.
- Comlink wraps the worker proxy — `wrap()` on main thread, `expose()` in worker.

## Content Architecture

- **All game content lives in `content/`** — JSON files. This is Uhura's domain.
- **`src/data/loader.js`** is the ONLY code that imports from `content/`. Everything else goes through the loader.
- Loader uses `import.meta.glob` (Vite) for browser/worker use; tests use Node.js `fs` directly.
- Content is validated automatically by `tests/content-validation.test.js` — runs in node environment.
- `content/` structure:
  ```
  content/
    characters/           <- one JSON per character
    items/                <- JSON arrays of items (consumables.json, junk.json, etc.)
    maps/
      kenton/
        locations/        <- one JSON per location
        actions/          <- JSON arrays of actions, grouped by area
        events/           <- (Phase 4)
  ```

## Character / NPC Terminology

- **`character.js`** is the unified model — replaces `npc.js` (deleted).
- Store uses `game.characters`, `game.registerCharacter()`, `game.setCharacterLocation()`.
- `registerNpc()`, `setNpcLocation()`, `npcsAtCurrentLocation` are **deprecated aliases** — still work, do not remove until all callers are gone.
- Simulation tiers: `fixed` (schedule lookup only), `routine` (multi-stop + transit), `full` (status-driven + stat decay).
- `createNPC()` in `character.js` is a deprecated alias for `createCharacter()` — kept for `tests/npc.test.js`.

## Simulation Worker

- `simulation.worker.js` calls `simulateTick(characters, gameTime)` from `engine/simulation.js`.
- Returns `{ characters: CharacterUpdate[], events: [] }`.
- `CharacterUpdate`: `{ id, locationId, statusChanges? }`.
- Worker failure is **non-fatal** — caught in `useGameLoop.tick()`, logged as warning, game continues.
- `statusChanges` from full-sim characters applied in-place to `game.characters[id].status`.

## Game Loop

- `useGameLoop.tick()` is async — awaits sim worker.
- `travel()` and `resolvePlayerAction()` are both async — await tick().
- `game.moveTo(locationId)` handles `currentLocationId`, `player.currentLocationId`, and `visitCount` atomically — use it, don't duplicate inline.
- `itemsGained` in action outcomes is `string[]` (item IDs) — look up via `game.getItem(itemId)` before calling `addItem()`.

## Character Selection UI

- `selectedCharacterId` is a `ref<string|null>` provided by `GameScreen.vue`, injected by `LocationView.vue` and `ActionMenu.vue`.
- In templates, refs are auto-unwrapped — use `selectedCharacterId === character.id` NOT `selectedCharacterId?.value === character.id`.
- In script, use `.value` as normal.
- `LocationView` sets selection on character click, clears it on location change.
- `ActionMenu` filters: character selected → show actions with matching `characterId`; none selected → show actions without `characterId`.

## Game Store Pattern

- `useGameStore` is the single source of truth for active game state.
- `useMetaStore` persists to its own localStorage key — never cleared on game reset.
- Both stores live in `src/stores/`.
- Item registry (`game.items`) populated at startup in `TitleScreen.vue` via `loadItems()` — not saved/loaded (it's static content). Must be populated before `loadSave()` is called if player inventory needs item lookups.

## Narrative Renderer

- `useNarrative()` is provided via Vue's `provide/inject` from `GameScreen.vue`.
- Child components (LocationView, etc.) inject it to enqueue text.
- NarrativeLog handles DOM rendering and auto-scroll.
- Skip: click anywhere on the log or press space/enter.

## Save System

- Save index at `sportsim_saves` (array of {id, name, timestamp}).
- Each save at `sportsim_save_{uuid}`.
- Meta-save at `sportsim_meta`.
- Auto-save overwrites the 'auto' named slot.
- `loadSave()` supports old saves with `npcs` key and new saves with `characters` key.

## Directory Structure

```
src/
  main.js
  App.vue
  router/index.js
  stores/
    game.js             <- Pinia game store (characters, items, locations, player, time)
    meta.js
  engine/
    clock.js
    actions.js          <- getAvailableActions, resolveAction, meetsRequirements
    dice.js
    stats.js            <- getStatDecayEffects, DECAY_CONFIG, gainStatXP
    events.js
    unlocks.js
    schedule.js         <- resolveSchedule, isInTransit, getTransitDestination
    character-registry.js
    simulation.js       <- simulateTick (three-tier)
  composables/
    useNarrative.js
    useSave.js
    useGameLoop.js      <- async tick, sim wired, item registry, character filtering
  data/
    loader.js           <- ONLY file that imports from content/
  models/
    player.js
    character.js        <- unified (replaces npc.js)
    item.js
    location.js
  components/
    layout/
      TitleScreen.vue   <- uses loader for init
      GameScreen.vue    <- provides selectedCharacterId, loads actionRegistry from loader
      GameHeader.vue
      GameFooter.vue
    game/
      NarrativeLog.vue
      LocationView.vue  <- clickable characters, isOpen() for travel
      ActionMenu.vue    <- filters by selectedCharacterId
  workers/
    simulation.worker.js    <- calls simulateTick()
    simulation-api.js       <- Comlink wrapper
  scss/
    variables.scss, layout.scss, typography.scss, theme.scss, animations.scss, main.scss

content/
  characters/           <- Uhura's domain
  items/
  maps/kenton/
    locations/
    actions/
    events/             <- Phase 4

tests/
  content-validation.test.js  <- node env, validates all content/ JSON
  integration/
    action-pipeline.test.js   <- node env, loads from content/
    player-lifecycle.test.js
  player.test.js, npc.test.js (→ character.js), item.test.js, location.test.js
  character.test.js, kenton-locations.test.js (node env, loads from content/)
  src/engine/*.test.js
```
