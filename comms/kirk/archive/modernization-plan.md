# SportSim Modernization Plan — The Full Rebuild

**Author:** Kirk
**Status:** Approved by Admiral
**Date:** Stardate 2026.03.08

---

## Mission Statement

Rebuild SportSim from the ground up as a text-based sandbox simulation set in early-90s Portland, Oregon. The player starts as a broke nobody in Kenton and becomes whatever Portland makes them — starving artist, alcoholic, vagrant, amateur PI, cult leader, creative visionary, strip club regular, or all of the above.

Sports management sim DNA — stats, time management, resource allocation, reputation — but the "sport" is surviving and thriving in the most beautifully unhinged city in America. Portland in all its grimy, strip-clubs-per-capita, pre-gentrification glory.

The game does not flinch.

---

## Strategic Decisions (Final)

| Decision | Choice | Notes |
|---|---|---|
| Architecture | Full client-side | No backend. All game logic in browser. Saves to localStorage. Deploy as static files. |
| Navigation | Pure text | Descriptions, exit lists, click to move. Classic text adventure. |
| Starting scope | Kenton only | One neighborhood, deep content. Prove the game loop. |
| Character system | Emergent identity | No class selection. You become what you do. |
| Unlocks | General-purpose meta-progression | Archetypes, locations, items, perks, modifiers — all unlockable. Data-driven triggers. |
| Starting archetypes | Unlockable across playthroughs | First run: blank slate. Earn archetypes through play. Unlock = starting template for future runs. |
| Time period | Early 90s Portland | Pre-Portlandia. Tonya Harding era. Skinheads vs antifa. Crack residue. Cheap rent. Raw city. |
| Win condition | Layered | Sandbox default + soft endings (death, arrest, fame, leaving) + archetype mastery endings. |
| Tone ceiling | None | Drugs, violence, sex work, addiction — all fair game. Craft over shock. No moralizing. |
| MVP scope | One in-game day | Wake up at Mom's, navigate Kenton, do things, sleep. 20-30 min real time. |
| Content authorship | Kirk drafts, Admiral edits | Kirk generates volume, Admiral holds the truth of Portland. |
| Narrative voice | Texture then brick | Literary sensory detail punctuated by blunt plain language. See `comms/docs/narrative-voice.md`. |
| What to salvage | Kenton location data (17 locations), tone | Everything else rebuilt from scratch. |

---

## Tech Stack

| Layer | Tech | Replaces | Notes |
|---|---|---|---|
| Framework | **Vue 3** (Composition API) | Vue 2 | Lighter, faster, better DX |
| Build | **Vite** | Webpack 4 | Near-instant HMR, zero config |
| State | **Pinia** | Vuex (unused) | Official Vue 3 state manager |
| Styling | **SCSS** | SCSS (keep) | Vite handles natively |
| Routing | **Vue Router 4** | Vue Router 3 | Required for Vue 3 |
| Persistence | **localStorage** | MySQL (nonexistent) | Game saves + meta-progression |
| Testing | **Vitest** | Nothing | Vite-native test runner |
| Linting | **ESLint + Prettier** | Nothing | Non-negotiable |
| Types | **JSDoc** | Nothing | Type hints without compile step. Revisit TS later. |
| Worker Comms | **Comlink** (Google Chrome Labs) | Nothing | 1.1kB. Makes Web Workers trivial. |
| UI Library | **Custom narrative renderer** | Nothing | See Narrative Renderer section. |

### Deleted

- `api.php`, `console.php`, `composer.*`, `vendor/` — no PHP
- `.htaccess` — no Apache
- `webpack.config.js` — replaced by Vite
- `dist/` — Vite builds its own output
- `assets/img/map-*` — no image maps
- All existing Vue components — rebuilt
- All existing JS models — syntax errors, wrong patterns
- `src/services/Locations.js` — no API calls

### Kept (migrated)

- `src/data/maps/north/kenton.json` — 17 real locations, migrated to new format
- Tone and flavor from `readme.md`
- `comms/` infrastructure

---

## Architecture

```
src/
  main.js                    <- Vue 3 entry
  App.vue                    <- Root
  router/index.js            <- Vue Router 4
  stores/
    game.js                  <- Pinia: game state (time, player, location)
    meta.js                  <- Pinia: meta-progression (unlocks, run history)
  engine/
    clock.js                 <- Time system (15-min increments, actions cost time)
    dice.js                  <- Dice engine (d20, skill checks, saving throws)
    actions.js               <- Action registry and resolution
    events.js                <- Random + triggered event system
    unlocks.js               <- Unlock trigger evaluation
    stats.js                 <- Stat calc, modifiers, thresholds
  workers/
    simulation.worker.js     <- Web Worker: NPC simulation loop
    simulation-api.js        <- Comlink wrapper for main thread
  models/
    player.js                <- Stats, inventory, status effects, psyche
    npc.js                   <- Personality, schedule, relations, psyche
    location.js              <- Description, exits, NPCs, actions
    item.js                  <- Consumables, possessions, tools
  data/
    locations/kenton/        <- One file per location
    npcs/                    <- NPC definitions
    items/                   <- Item definitions
    events/                  <- Event definitions
    archetypes/              <- Archetype defs + unlock criteria
    unlocks/                 <- All other unlock defs
  components/
    layout/
      GameHeader.vue         <- Status bar (time, money, health, mood)
      GameFooter.vue         <- Action feedback / quick status
    screens/
      TitleScreen.vue        <- Main menu, new game, load, unlocks gallery
      GameScreen.vue         <- Primary gameplay view
      GameOverScreen.vue     <- Death/ending screen
    game/
      LocationView.vue       <- Current location description + exits + NPCs
      ActionMenu.vue         <- Available actions at current location/context
      InventoryView.vue      <- Player inventory
      StatsView.vue          <- Player stats / character sheet
      DialogueView.vue       <- NPC conversation interface
      EventView.vue          <- Event narrative display
      NarrativeLog.vue       <- Scrolling log with animated text rendering
  composables/
    useGame.js               <- Game loop orchestration
    useNarrative.js          <- Text animation and rendering engine
    useSave.js               <- Save/load game state
    useMeta.js               <- Meta-progression queries
  utils/
    random.js                <- Seeded RNG, weighted picks, dice rolls
    text.js                  <- String templating, description generation
  scss/
    _variables.scss
    _layout.scss
    _typography.scss         <- Terminal/text-adventure aesthetic
    _theme.scss              <- Dark theme, Portland vibes
    _animations.scss         <- Text animation keyframes
    sim.scss                 <- Entry point
```

---

## Core Systems

### 1. Dice Engine

Under the hood, this is a tabletop RPG. Every meaningful action resolves through dice rolls. The player never sees the dice unless they dig for it — the narrative wraps the results.

- **d20 core mechanic** for skill checks and contested rolls
- **Modifiers** from stats, status effects, items, abilities, altered states
- **Difficulty classes (DC)** set per action/context
- **Critical success/failure** on natural 20/1 with special narrative outcomes
- **NPCs use the same system** — they roll to do their own things in the background
- **Perception-dependent abilities** modify rolls in ways the player may not understand (drunk = penalty to Wits checks, BUT bonus to Charm at certain thresholds because you think you're charming and confidence is its own modifier)

The dice engine runs in the main thread for player actions (instant resolution) and in a **Web Worker** for NPC simulation (background processing via Comlink).

### 2. NPC Simulation (Web Worker)

NPCs live their own lives. Every game tick, a Web Worker runs the simulation loop:

- Roll for NPC movement (do they stay or go?)
- Roll for NPC actions (do they drink, fight, sleep, wander?)
- Update NPC stats (hunger, sobriety, mood — same system as player)
- Resolve NPC-NPC interactions (two NPCs at the same bar might talk, fight, or leave)
- Check for NPC-triggered events
- Level up NPC skills based on their actions (same progression as player)

When the player enters a location, the simulation results are already there. NPCs arrived because the dice put them there. The world feels alive because it IS alive — just offscreen.

**Tech:** Comlink wraps the Worker. Main thread calls `sim.tick(gameTime)` and gets back `{ npcs, events, worldState }`.

### 3. Game Clock

Every action costs time (15-min increments). Time drives NPC schedules, location availability, events, stat decay.

- **Day structure:** Morning (6am-12pm) / Afternoon (12pm-5pm) / Evening (5pm-9pm) / Night (9pm-12am) / Late Night (12am-6am)
- **Time passes when you act.** Standing still costs nothing.
- **Location availability by time.** The Dancin' Bare isn't open at 9am. Mom kicks you out during the day. The liquor store closes at midnight.

### 4. Player Character

Starts with base stats, no items, no money, no reputation. Everything earned or lost.

**8 stats (1-100, start ~10-20):**

| Category | Stats | Purpose |
|---|---|---|
| Physical | Stamina, Toughness | Endurance, damage resistance |
| Mental | Wits, Creativity | Problem-solving, art quality, cons |
| Social | Charm, Reputation | NPC interactions, access |
| Spiritual | Luck, Karma | Random outcomes, cosmic justice |

**6 status effects (always active):**
- Hunger (0-100)
- Sobriety (0-100)
- Energy (0-100)
- Mood (0-100)
- Health (0-100)
- Money ($0.00+)

**Psyche system:**
- **Trauma** — acquired through events, never fully healed. Changes perceptions and available actions.
- **Obsessions** — grow from repeated behavior. Weight action menus toward the obsession.
- **Insanities** — perception diverges from consensus reality. May or may not reflect actual truth.

**Ambiguous abilities:**
- Tied to altered states (drunk, stoned, exhausted, starving, manic)
- Presented as real within the narrative. Never confirmed or denied.
- Have real mechanical effects via the dice engine
- NPCs have them too

**Emergent identity:**
- Invisible "archetype scores" tracked based on actions
- Cross thresholds = game/NPCs treat you differently
- No class selection — you ARE what you DO

**Leveling:**
- Stats improve through use (do physical things → Stamina goes up)
- Abilities unlock at stat thresholds
- NPCs level the same way in the background simulation
- Character level = aggregate of all stats, gives a rough power indicator

### 5. Narrative Renderer

Custom Vue composable. NOT a terminal emulator — a **narrative engine** that happens to look like one.

**Core features:**
- **Typewriter text animation** — characters appear one at a time, variable speed
- **Speed control** — slow for dramatic reveals, fast for mundane info, pause for impact
- **Word-at-a-time mode** — for critical moments, words appear individually with pauses
- **Text styling** — color, bold, italic based on context (mood, location, NPC personality)
- **Screen effects** — flicker, glitch, fade for altered states (drunk vision, exhaustion blur)
- **Scrolling narrative log** — history of recent text, scrollable
- **Instant mode** — player can click/key to skip animation and show all text immediately
- **Sound hooks** — emit events for text sounds (key clicks, dings) if audio is added later

**Why custom:** jQuery Terminal and blessed solve the wrong problem. We don't want a command-line emulator. We want a narrative delivery system where HOW text appears is as important as what it says. "You are not welcome here." revealed one word at a time hits completely differently than dumped on screen.

### 6. Location System

Pure text. Each location has:
- **Description** (varies by time of day, player state, visit count)
- **Exits** (connected locations with travel time)
- **NPCs present** (populated by simulation Worker)
- **Available actions** (context-dependent, filtered by requirements)
- **Discovery state** (some locations must be discovered)

Starting knowledge: Mom's house and immediate surroundings. Kenton unfolds as you explore.

### 7. Action System

Data-driven. Each action has:
- **Time cost** (15-min increments)
- **Requirements** (stats, items, location, time, sobriety, etc.)
- **Dice check** (stat + modifiers vs DC)
- **Success/failure outcomes** (different stat changes, items, money, events)
- **Critical success/failure** (special narrative + amplified effects)
- **Narrative text** (success, failure, critical variants)

### 8. Event System

Random and triggered events. Primary narrative vehicle.
- **Random events** — probability + conditions (time, location, stats)
- **Triggered events** — fire on specific conditions (first visit, stat threshold, item)
- **Chain events** — multi-step narratives with choices
- **NPC-generated events** — when the simulation produces something the player should see

### 9. Meta-Progression / Unlock System

Persists across playthroughs. Data-driven trigger conditions.

**Categories:** archetypes, starting locations, starting perks/items, game modifiers, lore entries.

**Trigger system:** Flexible condition evaluator. Supports stat thresholds, event completion, counters, death conditions, run completion, discovery — anything.

---

## Build Phases

### Phase 1: Foundation
**Goal:** Walk around Kenton, see animated descriptions, time passes, save/load. The narrative renderer makes it feel alive even without actions.

- Vite + Vue 3 scaffold (rip out everything old)
- Pinia stores (game state, meta-progression)
- Vue Router 4
- Game clock engine
- Dice engine (core rolls, modifiers, DC checks)
- Player model (stats, status effects, psyche stubs)
- Location model + Kenton data (migrate 17 locations)
- Text navigation (exits, travel time)
- **Narrative renderer** (typewriter animation, speed control, styling, skip)
- Basic layout UI (status bar, narrative log, action menu shell)
- Save/load to localStorage
- Web Worker scaffold with Comlink (NPC sim stub)
- Vitest harness

**Acceptance:** Player starts at Mom's house, navigates Kenton via text, sees animated descriptions that change by time of day, time passes on movement, status bar shows state, can save/load. It FEELS like a game even without actions.

### Phase 2: Actions & Economy
**Goal:** The player can DO things.

- Action system (data-driven, dice-resolved)
- Basic actions for all 17 locations
- Money system
- Stat effects from actions
- Status effect consequences
- Inventory system
- Leveling (stats improve through use)

### Phase 3: NPCs & Events
**Goal:** Portland comes alive.

- NPC model + schedule system
- Web Worker NPC simulation (full loop)
- NPC placement via simulation results
- Dialogue system
- Relationship tracking
- Random + triggered events
- 10-20 seed events
- NPC leveling in background

### Phase 4: Identity & Progression
**Goal:** You become someone.

- Psyche system (trauma, obsessions, insanities)
- Ambiguous abilities
- Archetype tracking
- Identity recognition by NPCs/narration
- Meta-progression store
- Unlock trigger system
- 3-5 locked archetypes
- Unlock gallery
- Soft endings + game over logic

### Phase 5: Content & Polish
**Goal:** Enough content to be genuinely fun.

- Deep Kenton content (more actions, events, NPCs, dialogue, secrets)
- Multiple endings
- Expanded event chains
- Narrative renderer effects (glitch, flicker, altered-state visuals)
- Audio hooks (optional)
- Balancing pass

---

## Parallel Crew Deployment

### Scotty — Build, UI, Clock, Worker Infrastructure
**Owns:** `src/main.js`, `src/App.vue`, `src/router/`, `src/stores/`, `src/engine/clock.js`, `src/workers/`, `src/components/`, `src/composables/useNarrative.js`, `src/composables/useSave.js`, `src/scss/`, build config, Comlink integration.

### Spock — Models, Data Layer, Test Harness
**Owns:** `src/models/`, `src/data/`, test suite. Pure classes/functions with zero Vue dependency. Built and tested in isolation.

### Bones — Engine Systems (Dice, Actions, Events, Stats, Unlocks)
**Owns:** `src/engine/` (except `clock.js`), `src/utils/`, `src/composables/useNarrative.js` (text generation logic, not animation). Pure logic, no Vue, independently testable.

### Kirk — Specs, Data Contracts, Content
**Owns:** Specs, content drafts, data contracts, `comms/docs/`. Does NOT write code.

**Integration order:** Kirk defines data contracts → Spock builds models to contract → Bones builds engines that consume models → Scotty wires models + engines into UI.

---

## Dependencies to Add

```json
{
  "dependencies": {
    "vue": "^3.x",
    "vue-router": "^4.x",
    "pinia": "^2.x",
    "comlink": "^4.x"
  },
  "devDependencies": {
    "vite": "^5.x",
    "@vitejs/plugin-vue": "^5.x",
    "vitest": "^1.x",
    "sass": "^1.x",
    "eslint": "latest",
    "prettier": "latest"
  }
}
```

---

## Risk Assessment

1. **Content volume** — Engine is easy, making Portland feel alive is a writing problem. **Mitigation:** Kenton only, prove the loop.
2. **Scope creep** — Infinitely expandable concept. **Mitigation:** Small phases, ship each before starting next.
3. **Narrative renderer complexity** — Text animation sounds simple but edge cases pile up (skip mid-animation, overlapping events, resize). **Mitigation:** Keep it dead simple in Phase 1. Enhance later.
4. **Worker simulation performance** — Simulating all NPCs every tick could get heavy as NPC count grows. **Mitigation:** Start with ~20 NPCs in Kenton. Profile early. Bones handles optimization.
