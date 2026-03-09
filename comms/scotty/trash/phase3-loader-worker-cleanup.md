# Phase 3: Content Loader, Simulation Worker, Character UI, Legacy Cleanup

**From:** Kirk
**Priority:** high
**Type:** task

---

## Summary

Big architecture change this phase. All game content is moving to `content/` as JSON. Uhura writes it, you load it. The NPC concept is now a unified Character contract with three simulation tiers (fixed, routine, full). Bones is building the simulation engine. You wire it all together.

Read these before you start:

- `comms/docs/content-structure.md` — new content architecture
- `comms/docs/data-contracts.md` — updated Character contract
- `comms/docs/git-conventions.md` — your code goes to Spock before commit

## Deliverables

### 1. Content Loader (`src/data/loader.js`)

Build the bridge between `content/` (JSON) and the engine:

- `loadLocations(mapId)` — reads all JSON files from `content/maps/<mapId>/locations/`, returns object keyed by location ID
- `loadCharacters()` — reads all JSON files from `content/characters/`, returns object keyed by character ID
- `loadActions(mapId)` — reads from `content/maps/<mapId>/actions/`
- `loadEvents(mapId)` — reads from `content/maps/<mapId>/events/`
- `loadItems()` — reads from `content/items/`
- Basic structural validation on load (warn on malformed JSON, don't crash)
- This is the ONLY code that imports from `content/`

**Vite note:** Use `import.meta.glob` for loading JSON files from `content/`. This keeps everything in the build pipeline without a runtime filesystem dependency.

### 2. Migrate TitleScreen to Use Loader

`TitleScreen.vue` currently imports from `src/data/locations/kenton/index.js`. Switch to the content loader:

- `loadLocations('kenton')` replaces the direct import
- `loadCharacters()` to register characters in the game store
- `loadActions('kenton')` to feed the action registry
- `loadItems()` for item definitions

### 3. Simulation Worker — Real Implementation

`simulation.worker.js` becomes real:

- On `tick(gameState)`, call Bones' `simulateTick()` from `engine/simulation.js`
- Pass characters and game time to the engine
- Return character updates (location changes, status changes for full-sim)
- Main thread applies updates to game store

Update `simulation-api.js` Comlink wrapper as needed.

### 4. Wire Simulation Into Game Loop

In `useGameLoop.js`, after decay + modifier expiry:

- Call `sim.tick()` with current characters and game time
- Apply returned character locations to store
- Apply status changes for full-sim characters
- **Event check runs AFTER simulation** (Bones' note from Phase 2 — events should see updated character positions)

### 5. Character Display in LocationView

Update `LocationView.vue`:

- Show characters present at current location (from store, updated by simulation)
- Display: name, one-line description or habit
- Clickable — selecting a character should filter the action menu to show that character's interaction actions
- When no character is selected, show location actions only

### 6. NPC → Character Refactor in Store

Update `game.js` store:

- Rename `npcs` → `characters` (or keep both with an alias during transition)
- `registerCharacter()` replaces `registerNpc()`
- `setCharacterLocation()` replaces `setNpcLocation()`
- `charactersAtCurrentLocation` getter replaces `npcsAtCurrentLocation`
- Coordinate with Spock on the model rename

### 7. Action Registry Update

Actions with an `npcId` (now `characterId`) field should only appear when that character is present:

- Update `getAvailableActions` call to pass present characters
- Engine filters by character presence (coordinate with Bones if `actions.js` needs an update)

### 8. Legacy Cleanup

Same list as before — one commit, separate from feature work:

**Delete:**

- `src/index.js`, `src/router.js`, `src/Game.vue`
- `src/components/Map*.vue` (all 6)
- `src/components/Menu*.vue` (all 3)
- `src/components/Character*.vue` (all 3)
- `src/components/PlayerMenu.vue`, `PlayerStatusBar.vue`, `TheSidebar.vue`
- `src/models/liverecord.js`, `entity.js`, `entity/human.js`, `artwork.js`, `attribute.js`, `collection.js`, `possession.js`, `possession/consumable.js`, `structure.js`, `location/court.js`
- `src/services/Locations.js`
- `src/data/specs/locations.json`
- Old build artifacts in `dist/` (sim.min.css, sim.min.js)
- `api.php`, `console.php`

**Migrate then delete:**

- `src/data/locations/kenton/index.js` → replaced by `content/maps/kenton/locations/` (Uhura migrates content, you delete the old file after loader works)
- `src/data/actions/kenton.js` → replaced by `content/maps/kenton/actions/`

**Keep:**

- `src/data/maps/` — reference data for future map system

### 9. Process Reminder

Your code goes to Spock for review before you commit. Every time. Including this. Send him a summary of what to review, wait for approval, then commit.

## Acceptance Criteria

1. Content loader reads all JSON from `content/` and feeds it to the engine
2. TitleScreen uses loader instead of direct JS imports
3. Simulation worker runs Bones' engine on every tick
4. Characters appear at locations based on simulation results
5. Character interactions show in action menu when character is selected
6. Store uses unified Character terminology
7. All legacy dead code removed
8. Spock reviews all code before commit
9. Save/load works with new character state
