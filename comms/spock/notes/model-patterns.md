# Spock's Notes

## Git Ownership Policy (effective immediately)

I do NOT commit code. Ever.
- Write code and tests as normal.
- When work is ready, drop a message in **Scotty's inbox**.
- Scotty stages, reviews, and commits.
- I do not run `git add` or `git commit`.

Reference: `comms/docs/git-conventions.md`

---

# Model Patterns

## Coverage Scoping

The legacy model files (liverecord.js, entity.js, artwork.js, collection.js,
possession.js, structure.js, entity/human.js, location/court.js,
possession/consumable.js) are 0% covered and must NOT be included in the
coverage config. They are out of scope for Phase 1 and beyond until Kirk
explicitly reassigns them.

vitest.config.js `coverage.include` must explicitly list only the files we own:
- src/models/player.js
- src/models/location.js
- src/models/npc.js
- src/models/item.js
- src/data/locations/**/*.js

## Vitest Version Constraint

Project uses vitest@1.6.1. The @vitest/coverage-v8 package MUST be pinned to
the same major.minor (1.6.x). The repo had 4.x installed from a prior run —
that caused a `parseAstAsync` export error. Fixed by installing 1.6.1 explicitly.

## npm Install Issues

node-sass (legacy devDependency from the original 2019 codebase) requires
native compilation. Use `--legacy-peer-deps` for all npm installs to avoid
peer dep conflicts. Do NOT use `--ignore-scripts` — it breaks uuid and other
packages that need post-install.

## Data Model Conventions

- All model factories return plain objects — no class instances. Serialization-safe.
- Mutative functions are documented as mutative. Pure functions are noted pure.
- clamp() is a private helper in player.js and npc.js — not exported, not shared.
  If a shared utility module appears, move it there. Until then, keep it local.
- adjustStatus() delegates money to adjustMoney() to centralize no-clamp logic.

## Stat Decay Contract (from DECAY_CONFIG in stats.js)

Per tick (1 tick = 15 min game time):
- hunger:   -1/tick, min 0
- energy:   -0.5/tick, min 0
- sobriety: +1/tick toward baseline **80** (NOT 100). Only moves when below 80.
- mood:     ±0.25/tick toward baseline **40**. Moves from either direction.

Sobriety above 80: engine does NOT pull it down. Drinking is what lowers it.
DECAY_CONFIG is exported and can be overridden for tests.

## Critical Failure + Success Interaction (dice.js / actions.js)

Natural 1 triggers criticalFailure outcome in `_selectOutcome()` BEFORE the success check.
If player's stat modifier + natural 1 clears the DC, `diceResult.success` is still true,
but the criticalFailure outcome is returned. This is intended behavior.

Do NOT write tests that assert `result.success === false` on natural 1 alone.
Assert `result.diceResult.criticalFailure === true` and check the outcome instead.

## Integration Test Patterns

- Round-trip test pattern: mutate -> JSON.stringify -> JSON.parse -> re-test functions
- Use `seededRandom(n)` for deterministic dice tests
- Test `toBeUndefined()` on decay change keys that should be absent (e.g. sobriety when already at baseline)
- Integration tests go in `tests/integration/` — separate from unit tests

## Kenton Location Data

- All 17 locations confirmed: exits only reference other Kenton location IDs
  (no cross-neighborhood exits in Phase 1 data).
- Travel times: 1 tick = adjacent/across street, 2-3 ticks = across neighborhood.
- Bars use overnight availability window (openHour > closeHour, e.g. 11, 2).
  isOpen() handles this correctly with the `openHour > closeHour` branch.
- chief_joseph is 0-23 (grounds accessible, building is not — but zone is walkable).
- moms_house and columbia_park are always open (0-23).

## Phase 3 — Complete (all committed)

Five commits landed:
- `[engine]` Bones' simulation engine (schedule.js, simulation.js, character-registry.js + tests)
- `[model]` character.js — replaces npc.js. createNPC() alias kept for backward compat.
- `[build]` Phase 3 code — game.js, useGameLoop.js, workers, ActionMenu, LocationView, GameScreen
- `[build]` TitleScreen/GameScreen loader migration (loadLocations/loadCharacters/loadItems from content/)
- `[cleanup]` Legacy JS data files deleted, tests updated to load from content/ via fs

Test count: 487/487. 19 test files.

## coverage.include — update needed

vitest.config.js still lists src/models/npc.js in coverage include. npc.js is DELETED.
If coverage thresholds are rechecked, update include to:
- src/models/player.js
- src/models/location.js
- src/models/character.js  ← new
- src/models/item.js
Remove npc.js entry. Notify Scotty to commit the config change.

## Vue Template Ref Unwrapping — Critical Gotcha

In Vue `<template>`, top-level refs are auto-unwrapped. `selectedCharacterId` injected
as `ref<string|null>` becomes the string value in template context.
`selectedCharacterId?.value` in a template = `(string)?.value` = always undefined.
In `<script setup>`, `.value` is required as normal.

Caught in LocationView.vue line 31. Fixed before Phase 3 commit.

## JSDoc Comment Block Gotcha — `*/` in content

The sequence `*/` inside a `/** ... */` JSDoc block closes the comment early.
Found in: `content/maps/*/locations/*.json` written in a block comment.
Vitest misreports the line number (points at the comment text, not the real error).
Fix: replace glob-style `*` paths in JSDoc with `{placeholder}` notation.

## Content Loader Pattern (loader.js)

`import.meta.glob('/content/...', { eager: true })` — Vite loads all matching JSON eagerly.
Each glob result value is a Vite module: `{ default: <parsed JSON> }`.
_extractModules() normalizes with `.default ?? m`.
_mergeById() flattens arrays and keys by .id — warns on missing id, does not crash.
Item registry populated at TitleScreen mount (before startNewGame) so it persists across resets.

## npcId → characterId (resolved)

Kirk ruled Option A: `characterId` everywhere. Uhura renamed in content. Contract updated.
`opposedNpcId` in DiceCheck was NOT renamed — it's a distinct concept (contested rolls)
and all current values are null. Leave for future ruling if contested rolls are built.

## SaveGame contract — stale reference fixed

data-contracts.md SaveGame had `npcs: NPC` — updated to `characters: Character`.
game.js loadSave() already supports both keys (backward compat for old saves).
