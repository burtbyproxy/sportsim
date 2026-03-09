# Phase 3: Simulation Engine — Three-Tier Character Simulation

**From:** Kirk
**Priority:** high
**Type:** task

---

## Summary

Build the simulation engine that brings characters to life. Three tiers of simulation depth — `fixed`, `routine`, `full` — all running in the Web Worker. The engine decides where every character in the game is at any given moment. Cheap for simple characters, expensive for complex ones.

Read `comms/docs/content-structure.md` for the full architecture. Read the updated Character contract in `comms/docs/data-contracts.md`.

## Prerequisites

- Character data comes from Uhura in `content/characters/` (JSON)
- Scotty's worker calls your engine from `simulation.worker.js`
- Your engine is pure functions — no Vue, no DOM

## Deliverables

### 1. Simulation Engine (`engine/simulation.js`)

The core function:

```
simulateTick(characters, gameTime, rng?) → CharacterUpdate[]
```

Where `CharacterUpdate` is `{ id, locationId, statusChanges? }`.

**For each character, based on `simulation` tier:**

#### `fixed`

- Look up schedule. Is there an entry for this hour + day?
- Roll probability. They're either there or nowhere (null locationId = off-map).
- Return location. Done. Cheapest possible path.

#### `routine`

- Look up schedule. Find the entry that matches this hour + day.
- Roll probability per entry.
- Characters transition between schedule stops — if it's 23:15 and their bar shift ended at 23:00 and their next stop is Plaid Pantry, they're walking to Plaid Pantry (or already there depending on travel time).
- Return location. No status tracking.

#### `full`

- Run schedule as baseline, but status affects decisions.
- If character's sobriety is low, bias toward bar locations (per `decisionWeights`).
- If hunger is low, bias toward food locations.
- If mood is low, bias toward solitude or home.
- Apply stat decay to full-sim characters (same rates as player — they're playing the same game).
- Return location + status changes.

### 2. Character Registry Helper (`engine/character-registry.js`)

- `buildCharacterRegistry(characterData[])` — takes raw character JSON array, indexes by ID, groups by simulation tier for efficient processing.
- `getCharactersAtLocation(registry, locationId)` — returns characters currently at a location.
- `getCharactersByTier(registry, tier)` — returns all characters of a given simulation tier.

### 3. Schedule Resolution (`engine/schedule.js`)

Extract schedule resolution into its own module (it's shared across all tiers):

- `resolveSchedule(schedule, hour, dayOfWeek)` — returns the matching ScheduleEntry or null.
- `isInTransit(schedule, hour, minute)` — returns true if character is between schedule stops (for routine/full).
- `getTransitDestination(schedule, hour, minute)` — returns where they're headed if in transit.

### 4. Tests

- Unit tests for all three simulation tiers
- Test schedule resolution edge cases: midnight crossover (endHour < startHour), probability rolls, day filtering
- Test full-sim decision weighting: verify that low sobriety biases toward bars
- Test that fixed-sim characters never get status changes
- Test with seeded RNG for reproducibility
- Integration: simulate 96 ticks (24 game hours) and verify characters move through their schedules correctly

## Notes

- The simulation runs in a Web Worker. Keep it fast. Fixed characters should be nearly free. Routine characters are cheap. Full characters are the only expensive ones — and there should be few of them.
- Don't over-engineer the full-sim decision system. Start simple: status thresholds override schedule entries with probability weights. We can get fancier later.
- Uhura is writing the character data. Your engine consumes it. If you need fields that aren't in the contract, drop it in Kirk's inbox.
- Remember: your code goes to Scotty for commit. He reviews, you don't touch git.

## Acceptance Criteria

1. `simulateTick` correctly handles all three tiers
2. Fixed characters appear/disappear based on schedule + probability
3. Routine characters transition between schedule stops
4. Full characters have status-driven decision making
5. Schedule resolution handles midnight crossover and day filtering
6. All tests pass with seeded RNG
7. Performance: simulating 50 characters (40 fixed, 8 routine, 2 full) completes in < 5ms
