# Phase 3: NPC UI, Simulation Worker, Legacy Cleanup

**From:** Kirk
**Priority:** high
**Type:** task

---

## Summary

Bring people to Kenton. Wire the simulation worker to move NPCs around on schedules, show them in the UI, and let the player interact with them. Also: kill the legacy code. Clean ship.

## Prerequisites

- Bones is building the simulation engine (`engine/simulation.js`) — your worker calls it.
- Spock is writing the NPC data and extending models — your UI renders what he defines.
- Remember: your code goes to Spock for review before you commit. No exceptions.

## Deliverables

### 1. Simulation Worker — Make It Real

`workers/simulation.worker.js` is a stub. Make it work:

- On `tick(gameState)`, call Bones' simulation engine to:
  - Resolve NPC locations based on schedules + probability
  - Return `{ npcs: NpcUpdate[], events: [] }` (events still empty for Phase 3)
- `NpcUpdate` shape: `{ id, locationId }` — which NPCs are where after this tick
- Worker receives minimal game state (time, NPC data) — doesn't need the full player object
- Main thread applies NPC location updates to the game store

Update `workers/simulation-api.js` to pass real data through Comlink.

### 2. Wire Simulation Into Game Loop

In `useGameLoop.js`, after decay + modifier expiry:

- Call `sim.tick()` with current game time and NPC data
- Apply returned NPC locations to store via `setNpcLocation()`
- NPCs should move every tick, so every time the player does anything that advances time, the world moves too

### 3. NPC Display in LocationView

`LocationView.vue` already has an NPC list section. Make it real:

- Show NPCs present at current location (from `game.npcsAtCurrentLocation`)
- Each NPC shows: name, one-line description or habit
- Clickable — clicking an NPC should show their available interactions in the action menu (or a separate interaction panel)

### 4. NPC Interaction Actions

When an NPC is present, generate interaction actions:

- "Talk to [name]" — basic interaction, charm check, relationship change
- Location-specific NPC actions (e.g., "Order a drink" from a bartender is different from "Talk to Carl" at the bar)

These should flow through the existing action pipeline — `getAvailableActions` should include NPC-contextual actions when NPCs are present. Coordinate with Bones on how NPC actions get registered.

### 5. NPC State in Save/Load

Verify that `game.npcs` state saves and loads correctly:

- NPC relationship scores persist
- NPC current locations persist
- On load, simulation picks up from saved NPC state

### 6. Legacy Cleanup

Kill the dead code. One commit, separate from everything else:

**Delete:**

- `src/index.js` (old Vue 2 entry)
- `src/router.js` (old Vue 2 router)
- `src/Game.vue` (old Vue 2 shell)
- `src/components/MapWorld.vue`, `MapRegion.vue`, `MapNeighborhood.vue`, `MapLocation.vue`, `MapInterior.vue`, `MapTile.vue`
- `src/components/MenuGame.vue`, `MenuGameLoad.vue`, `MenuGameSettings.vue`
- `src/components/CharacterHealth.vue`, `CharacterInventory.vue`, `CharacterProfile.vue`
- `src/components/PlayerMenu.vue`, `PlayerStatusBar.vue`, `TheSidebar.vue`
- `src/models/liverecord.js`, `entity.js`, `entity/human.js`, `artwork.js`, `attribute.js`, `collection.js`, `possession.js`, `possession/consumable.js`, `structure.js`, `location/court.js`
- `src/services/Locations.js`
- `src/data/specs/locations.json`
- `dist/sim.min.css`, `dist/sim.min.js` (old build artifacts — new build goes to `dist/assets/`)
- `api.php`, `console.php` (old PHP backend — we're client-only now)

**Keep:**

- `src/data/maps/` — reference data, may be useful later for the map system revival
- `src/scss/sim.scss` — check if anything references it; if not, kill it too

Commit message: `[meta] remove legacy Vue 2, PHP, and dead code`

## Acceptance Criteria

1. NPCs appear at locations based on their schedules and time of day
2. Walking into a bar at night shows different NPCs than walking in at morning
3. Player can interact with present NPCs through the action menu
4. NPC relationship scores change based on interactions
5. Simulation worker runs on every tick without blocking the UI
6. Save/load preserves NPC state
7. All legacy dead code removed in a clean commit
8. Spock reviews all code before commit
