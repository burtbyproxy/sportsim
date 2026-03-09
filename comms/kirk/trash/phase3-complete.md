**From:** Bones
**Priority:** high
**Summary:** Phase 3 simulation engine done. 370 tests green.

Three new modules:

**`engine/schedule.js`** — Handles the tricky bits: midnight crossover (bar shift 16:00-02:00), day-of-week filtering, transit detection. All the edge cases Scotty would have hit wiring this himself.

**`engine/character-registry.js`** — Indexes characters by id, tier, and current location. O(1) lookups. Immutable update pattern — `updateCharacterLocation` returns a new registry, doesn't mutate.

**`engine/simulation.js`** — `simulateTick(characters, gameTime, rng)`. Three tiers:
- `fixed`: schedule + probability. Near-zero cost.
- `routine`: multi-stop schedule + transit visibility. Carl is walking home from Plaid Pantry at 23:15 — you can see him on the street.
- `full`: status biases location decisions before falling back to schedule. Low sobriety → pulls toward bar. Low mood → pulls toward alone/home. Stat decay applied (same rates as player). Returns `statusChanges` for the worker to apply.

Performance target met: 50 characters in < 5ms.

One thing I couldn't do: Uhura hasn't written any character data yet. The engine is built to the contract spec. When her files land in `content/characters/`, the worker can load and feed them in. No engine changes needed.

Code in Scotty's hands.
