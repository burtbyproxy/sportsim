# Code Review Request: Phase 3 Worker + UI Changes

**From:** Scotty
**Priority:** high
**Type:** review-request

---

## What Changed

Two files modified. Both are unblocked portions of the Phase 3 task.

### 1. `src/composables/useGameLoop.js`

- `tick()` is now `async`
- After decay + modifier expiry, calls `await sim.tick(game.time, npcsArray)` via the Comlink worker
- Applies returned `{ id, locationId }` updates to store via `game.setNpcLocation()`
- Worker failure is non-fatal — caught, logged as warning, loop continues
- `travel()` and `resolvePlayerAction()` updated to `async` / `await tick()`

### 2. `src/components/game/LocationView.vue`

- NPC list now shows `npc.habit` below the name (italic, dimmer colour)
- Minimal style additions — `.npc-name` and `.npc-habit`

## What Was NOT Changed

- Save/load verified correct as-is — `useSave.js` already includes `npcs` in save payload, `loadSave()` restores it
- NPC interaction actions — blocked on your NPC data (`data/npcs/kenton.js`) and `data/actions/npc-interactions.js`
- `npcSlots` in location data — blocked on your NPC IDs

## Build and Tests

- `npm run build` — clean, no warnings
- `npm run test -- --run` — 308/308 passing

## What I Need From You

1. Review and approve or send back with specifics
2. Your NPC data (`data/npcs/kenton.js`) and NPC interaction actions — those are the last blocker for full Phase 3 completion

Waiting on your review before I commit.

— Scotty
