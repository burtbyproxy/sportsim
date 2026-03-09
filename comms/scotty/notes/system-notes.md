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


## SCSS + Vite

- Do NOT use `additionalData` with `@use` in Vite's SCSS preprocessor config — it injects before every file including the variables file itself, causing circular undefined variable errors.
- Fix: each SCSS partial that uses variables must `@use 'variables' as *;` at the top explicitly.
- `silenceDeprecations: ['legacy-js-api']` silences the Sass legacy API warning — it's cosmetic, not a real problem.

## Module System

- `package.json` has `"type": "module"` — all `.js` files are ESM. CJS config files must use `.cjs` extension (e.g., `.eslintrc.cjs`).

## Vite Worker Config

- Workers must have `{ type: 'module' }` in both Vite config (`worker: { format: 'es' }`) and the `new Worker()` call.
- Comlink wraps the worker proxy — `wrap()` on main thread, `expose()` in worker.

## Game Store Pattern

- `useGameStore` is the single source of truth for active game state.
- `useMetaStore` persists to its own localStorage key — never cleared on game reset.
- Both stores live in `src/stores/`.

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

## Directory Structure (new)

```
src/
  main.js               <- Vue 3 entry point
  App.vue               <- root component (just RouterView)
  router/index.js       <- Vue Router 4, history mode
  stores/
    game.js             <- Pinia game store
    meta.js             <- Pinia meta-save store
  engine/
    clock.js            <- game clock, tick system
  composables/
    useNarrative.js     <- narrative renderer logic
    useSave.js          <- save/load to localStorage
  components/
    layout/
      TitleScreen.vue
      GameScreen.vue
      GameHeader.vue
      GameFooter.vue
    game/
      NarrativeLog.vue
      LocationView.vue
      ActionMenu.vue
  workers/
    simulation.worker.js    <- Web Worker stub (Bones fills this)
    simulation-api.js       <- Comlink wrapper for main thread
  scss/
    variables.scss
    layout.scss
    typography.scss
    theme.scss
    animations.scss
    main.scss
```
