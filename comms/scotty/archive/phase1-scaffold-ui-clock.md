# Phase 1: Scaffold, UI, Clock, Narrative Renderer

**From:** Kirk
**Priority:** high
**Type:** task

---

## Summary

Tear out the old Vue 2 / Webpack / PHP stack and build the new foundation. You own the build system, the Vue app shell, the game clock, the narrative renderer, the Worker infrastructure, and the save/load system.

## Prerequisites

- Read `comms/docs/data-contracts.md` — these are your interfaces. Build to them.
- Read `comms/docs/narrative-voice.md` — understand what the narrative renderer needs to deliver.
- Coordinate with Spock (models) and Bones (engines) — your UI consumes their output.

## Deliverables

### 1. Vite + Vue 3 Scaffold
- Initialize Vite with `@vitejs/plugin-vue`
- Vue 3 with Composition API
- Vue Router 4 (history mode)
- Pinia stores (game + meta)
- SCSS pipeline
- ESLint + Prettier config
- Vitest config
- **Do NOT delete old files yet** — put new app in `src/` and we'll clean up old files in a separate commit after everything works

### 2. Pinia Stores
- `stores/game.js` — holds `Player`, `GameTime`, current location, NPC states, fired events, counters. Actions for time advancement, player state changes, location transitions.
- `stores/meta.js` — holds `MetaSave` (unlocks, completed runs, global counters). Persists to separate localStorage key. Survives game resets.

### 3. Game Clock (`engine/clock.js`)
- 15-minute tick granularity
- Advance time by N ticks
- Calculate period (morning/afternoon/evening/night/late_night) from hour
- Day-of-week tracking
- Expose `GameTime` object per contract

### 4. Narrative Renderer (`composables/useNarrative.js` + `components/game/NarrativeLog.vue`)
This is the soul of the UI. The game's personality lives in HOW text appears.

- Accept `NarrativeText` (array of `NarrativeToken`) per contract
- **Typewriter animation** — characters appear one at a time
- **Variable speed** — `instant`, `fast`, `normal`, `slow`, `crawl` (configurable ms-per-char)
- **Pause control** — `pauseAfter` on each token (milliseconds)
- **Style rendering** — bold, italic, color, highlight, whisper (small/faded), shout (large/bright)
- **Effect rendering** — `flicker` (CSS animation), `glitch` (brief randomization), `fade` (opacity transition). Keep these simple for Phase 1.
- **Skip mechanism** — click or keypress skips animation, shows all text instantly
- **Scrolling log** — NarrativeLog component shows history of rendered text, auto-scrolls to bottom
- **Queue system** — multiple NarrativeText objects can be queued, rendered sequentially
- Emit events on: animation start, animation complete, skip (for future sound hooks)

### 5. Layout Components
- `GameHeader.vue` — status bar showing: time (human-readable), money, health, energy, mood, sobriety, hunger. Updated reactively from game store.
- `GameFooter.vue` — minimal, maybe just a one-liner of current status or last action result.
- `GameScreen.vue` — main gameplay layout: header, narrative log (main area), action menu (bottom or side).
- `TitleScreen.vue` — main menu: New Game, Load Game, Unlocks (grayed out for now). Styled to look like a terminal boot sequence.

### 6. Game Components
- `LocationView.vue` — renders current location description (via narrative renderer), lists exits as clickable links, shows NPCs present.
- `ActionMenu.vue` — lists available actions as clickable items. Grayed-out items for failed requirements (show why on hover/focus). Consumes action list from game store.

### 7. Save/Load (`composables/useSave.js`)
- Save full game state to localStorage (key: `sportsim_save_{id}`)
- Load game state from localStorage
- List available saves
- Delete a save
- Auto-save on location change (optional, can be toggled)
- Meta-save uses separate key (`sportsim_meta`)

### 8. Web Worker Scaffold
- `workers/simulation.worker.js` — stub Worker that accepts a `tick(gameTime)` call and returns `{ npcs: [], events: [] }` for now. The real simulation logic comes from Bones in Phase 3.
- `workers/simulation-api.js` — Comlink wrapper. Main thread imports this, calls `sim.tick()`.
- Install `comlink` as dependency.

### 9. SCSS
- Dark theme. Terminal aesthetic. Think green-on-black or amber-on-black, but stylized — not a literal terminal emulator.
- Monospace font for narrative text. Sans-serif for UI elements.
- Layout: header fixed top, footer fixed bottom, main area fills middle. Scrollable narrative log.
- `_variables.scss`, `_layout.scss`, `_typography.scss`, `_theme.scss`, `_animations.scss`

## Notes

- The narrative renderer is the most important piece. Spend time on it. If the text animation doesn't feel right, the whole game falls flat.
- Don't worry about the dice engine, action resolution, or NPC simulation — Bones handles those. Your action menu just displays what the game store says is available and emits events when clicked.
- Spock is building the Player and Location models. Import his code. Don't duplicate it.
- Keep the UI ugly-functional for Phase 1. We polish in Phase 5. Make it work, not pretty.

## Acceptance Criteria

Player can:
1. See a title screen and start a new game
2. Arrive at Mom's House with an animated text description
3. See a status bar with time, money, health, etc.
4. See a list of exits and click one to move
5. Watch time advance when moving
6. See a different description at the new location
7. See descriptions change when visiting at different times (if time has advanced enough)
8. Save the game
9. Reload the page, load the save, and be where they left off
10. Skip text animation by clicking/pressing a key
