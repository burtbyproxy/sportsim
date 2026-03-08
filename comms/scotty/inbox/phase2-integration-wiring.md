# Phase 2: Integration Wiring — The Playable Loop

**From:** Kirk
**Priority:** high
**Type:** task

---

## Summary

Wire the engines to the UI. When this is done, the Admiral can walk around Kenton, do things, watch time pass, see stats change, and save/load. This is where the game becomes a game.

You already did a lot of the wiring in Phase 1 — LocationView calls `generateLocationNarrative`, the store has `moveTo`, locations register on new game. Good work. Now finish it.

## Prerequisites

- Spock's models are in `src/models/` — use them. Kill the inline `createDefaultPlayer()` in TitleScreen.
- Bones' engines are in `src/engine/` — use them. They're pure functions that return change objects. You apply the changes to the store.
- Read `comms/docs/git-conventions.md` — you commit everything. Spock and Bones report to you.

## Deliverables

### 1. Replace Inline Player Creation

`TitleScreen.vue` has a `createDefaultPlayer()` function hardcoded inline. Replace it:

- Import `createPlayer` from `src/models/player.js`
- Call `createPlayer('You')` instead
- Delete the inline function entirely

### 2. Wire the Action Pipeline

This is the big one. Right now `game.setAvailableActions([])` is called with nothing.

**Create action data** (`src/data/actions/kenton.js`):

- Write 2-4 actions per location — keep it minimal for Phase 2. Examples:
  - Mom's House: "Raid the fridge" (restores hunger, costs time), "Stare at ceiling" (restores energy slightly, existential dread)
  - Blue Parrot: "Order a beer" (sobriety -15, money -3, mood +10), "Talk to bartender" (charm check, relationship)
  - Columbia Park: "Sit on bench" (energy +5, mood varies), "Look for change in the fountain" (luck check, money)
  - Plaid Pantry: "Buy tallboy" (money -2, get item), "Shoplift" (wits check, risk)
- Follow the `Action` contract from data-contracts.md exactly
- Every action needs `success` and `failure` outcomes with `NarrativeText` (use `toNarrativeText()` for now — polish text later)
- Export as object keyed by action ID

**Wire actions to LocationView:**

- On location enter, call `getAvailableActions(player, location, gameTime, actionRegistry)` from `engine/actions.js`
- Pass results to `game.setAvailableActions()`
- Re-evaluate when time changes (some actions are time-gated)

**Wire ActionMenu to resolve actions:**

- When player clicks an action, call `resolveAction(player, action, npcs)` from `engine/actions.js`
- Apply the returned changes to the store: `applyStatusChanges()`, `applyStatChanges()`, `adjustMoney()`, etc.
- Feed the outcome's `NarrativeText` to the narrative renderer via `narrative.enqueue()`
- Advance time by action's `timeCost`
- Re-evaluate available actions after resolution

### 3. Wire Stat Decay

Every time the clock advances, natural decay should happen:

- Call `getStatDecayEffects(player, ticksElapsed)` from `engine/stats.js`
- Apply the returned status changes to the store
- This makes hunger drop, energy drop, sobriety slowly return to baseline over time

Add this to the `advanceTime` action in `game.js`, or create a `tick()` action that wraps time advancement + decay + modifier expiration.

### 4. Wire Modifier Expiration

Every tick, call `tickModifiers(player)` from `models/player.js` to expire temporary modifiers. Add this to the same tick cycle as stat decay.

### 5. Save/Load with Full State

Verify save/load works with:

- Real player object (from `createPlayer`)
- All registered locations with visit counts
- Current game time
- Player inventory, stats, status, psyche

Test: start game, walk somewhere, do an action, save, reload page, load save, verify state is correct.

### 6. Game Loop Composable (`composables/useGameLoop.js`)

Create a central game loop composable that orchestrates what happens each tick:

```
function tick(ticks = 1):
  1. Advance clock
  2. Apply stat decay
  3. Expire modifiers
  4. Re-evaluate available actions at current location
  5. (Future: run simulation worker for NPC movement, check events)
```

LocationView's `travel()` should call `gameLoop.tick(travelTicks)` instead of `game.moveTo()` directly. ActionMenu's `executeAction()` should call `gameLoop.resolveAction(action)` which handles resolution + tick.

This centralizes the "what happens when time passes" logic instead of scattering it.

## What This Does NOT Include (Phase 3+)

- NPC data and simulation (no NPCs walking around yet)
- Random/triggered events
- Inventory UI
- Character sheet
- Archetype tracking feedback
- Unlock evaluation
- Simulation worker doing real work

## Acceptance Criteria

1. New Game creates a player via `createPlayer()` from models — no inline creation
2. Player arrives at Mom's House with animated narrative description
3. Actions appear in the action menu based on current location
4. Clicking an action resolves it through the dice engine and shows narrative result
5. Time-gated and stat-gated actions show as disabled with reason
6. Stats decay naturally as time advances (hunger drops, energy drops)
7. Status bars in header update reactively as stats change
8. Save and load preserve full game state including stats, location, time
9. Player can walk around Kenton, do actions at locations, watch stats change, and save/load

## Notes

- Keep action text placeholder-quality for now. Kirk will do a content pass later with proper narrative voice. Just make it functional and mildly amusing.
- Bones' `resolveAction` returns changes — it does NOT mutate the player. You apply the changes. That separation is intentional.
- The game loop composable is important architecture. Don't skip it. Everything flows through the tick.
