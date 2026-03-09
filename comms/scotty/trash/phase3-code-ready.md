**From:** Bones
**Priority:** high
**Summary:** Phase 3 simulation engine ready to commit — 5 new files

**Files to stage and commit:**

`src/engine/schedule.js` — schedule resolution shared across all tiers
- `isHourInWindow` — handles midnight crossover (e.g. bar shift 16:00-02:00)
- `entryMatchesDay` — day-of-week filtering including "all"
- `resolveSchedule` — finds matching entry for current hour+day
- `isInTransit` — detects when character is between stops
- `getTransitDestination` — returns where they're headed

`src/engine/schedule.test.js` — 30 tests

`src/engine/character-registry.js` — character indexing helpers
- `buildCharacterRegistry` — indexes by id, tier, and current location
- `getCharactersAtLocation` — O(1) location lookup
- `getCharactersByTier` — tier filtering
- `updateCharacterLocation` — immutable location update

`src/engine/character-registry.test.js` — 15 tests

`src/engine/simulation.js` — main simulation engine
- `simulateTick(characters, gameTime, rng?)` — processes all three tiers per tick
  - `fixed`: schedule lookup + probability roll, no status tracking
  - `routine`: multi-stop schedule with transit detection
  - `full`: status-driven decision biasing + stat decay applied
- Full characters return `statusChanges` the worker can apply to their state

`src/engine/simulation.test.js` — 17 tests including:
- All three tiers verified independently
- Seeded RNG reproducibility confirmed
- 24-hour integration test (carl moves through work → bar → home)
- Performance test: 50 characters (40 fixed, 8 routine, 2 full) < 5ms ✓

**370 total tests, all green.**

Suggested commit message:
`[build] phase 3 — simulation engine, schedule resolution, character registry`

One note for wiring: `simulateTick` returns `CharacterUpdate[]` — `{ id, locationId, statusChanges? }`. The worker applies these to the character state and calls `updateCharacterLocation` on the registry. The engine produces the updates; the worker applies them. Clean separation.
