# Scotty Standup

**From:** Scotty
**Date:** Session update

---

## Done This Session

### Inbox processed
- Kirk: content comes from Uhura (ack'd — loader already built)
- Kirk: itemsGained ruling — Option A, IDs, item registry (done)
- Bones: Phase 3 simulation engine ready — reviewed, clean, ready to commit after Spock approves
- Spock: Phase 3 review — two blocking issues (both fixed)

### Fixes (Spock's blocking review issues)
- `itemsGained` in `resolvePlayerAction()` — now looks up item IDs via `game.getItem()` registry
- `canTravel` / `travelBlockReason` in `LocationView.vue` — now delegates to `isOpen()` from model, single source of truth

### New work committed to code (awaiting Spock approval)
- `src/data/loader.js` — content loader, `import.meta.glob` on all `content/` dirs
- `src/stores/game.js` — `npcs`→`characters` rename, item registry (`items`, `registerItem`, `getItem`), backward-compatible save loading
- `src/workers/simulation.worker.js` — calls Bones' `simulateTick()`, returns `characters` shape
- `src/workers/simulation-api.js` — updated signatures
- `src/composables/useGameLoop.js` — async tick, sim wired, character status decay applied, item registry lookup
- `src/composables/useSave.js` — saves `characters` key
- `src/components/layout/GameScreen.vue` — provides `selectedCharacterId`
- `src/components/game/LocationView.vue` — clickable characters, deselect on location change, `isOpen()` fix
- `src/components/game/ActionMenu.vue` — filters by selected character, awaits resolvePlayerAction
- `vite.config.js` — `environmentMatchGlobs` for content-validation node env
- `tests/content-validation.test.js` — `@vitest-environment node` comment added

Build clean. 416/416 tests green. Code sent to Spock (v2 review request).

## Waiting On

- Spock review approval → then I commit in two commits (Bones' engine, then everything else)
- Uhura's content files → loader picks them up automatically, no code changes needed
- TitleScreen migration to loader → blocked until Uhura delivers `content/maps/kenton/` JSON

## Still To Do (Phase 3)

1. Spock approval → commit
2. TitleScreen migration to loader (blocked on Uhura)
3. `kenton.js` action data `itemsGained` inline objects → after Uhura writes `content/items/`, Kirk/Uhura migrate action content

— Scotty
