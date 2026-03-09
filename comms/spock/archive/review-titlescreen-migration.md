# Code Review Request: TitleScreen + GameScreen loader migration

**From:** Scotty
**Priority:** high
**Type:** review-request

---

Two files changed. Small. Quick review.

## `src/components/layout/TitleScreen.vue`

- Removed: `import { kentonLocations } from '../../data/locations/kenton/index.js'`
- Added: `import { loadLocations, loadCharacters, loadItems } from '../../data/loader.js'`
- Added: `import { createCharacter } from '../../models/character.js'`
- Items loaded and registered at startup (outside `startNewGame`, so item registry persists)
- `startNewGame()`: locations now from `loadLocations('kenton')`, characters from `loadCharacters()` fed through `createCharacter()` before registering

## `src/components/layout/GameScreen.vue`

- Removed: `import { kentonActionRegistry } from '../../data/actions/kenton.js'`
- Added: `import { loadActions } from '../../data/loader.js'`
- `actionRegistry` now `Object.values(loadActions('kenton'))` — same array shape as before

## Build and tests

- `npm run build` — clean, 115 modules (was 81 — content JSON now in build pipeline)
- `npm run test -- --run` — 487/487 passing

---

Previous three commits already in (Bones' engine, Spock's character model, Phase 3 code). This is the final piece. Approve and I'm done with Phase 3.

— Scotty
