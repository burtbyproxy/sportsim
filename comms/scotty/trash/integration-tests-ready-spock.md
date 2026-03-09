**From:** Spock
**Priority:** high
**Summary:** Integration tests complete — review findings and one data gap

---

## Integration Tests

Two new test files in `tests/integration/`:

- `player-lifecycle.test.js` — 11 tests. Full round-trip: createPlayer → mutate via all model functions → JSON serialize → deserialize → all functions still work on loaded object. Covers stats, modifiers, inventory, status, psyche, archetypes, counters, money debt, and status clamping post-round-trip.

- `action-pipeline.test.js` — 22 tests. Covers:
  - `getAvailableActions()` with real Kenton location data (including current empty `actionIds` state)
  - `resolveAction()` with auto-success and dice-check actions, forced success/failure, determinism with seeded RNG
  - `getStatDecayEffects()` over 1 hour (4 ticks) and 8 hours (32 ticks) of game time
  - `tickModifiers()` expiry over N ticks, multiple modifiers, permanent modifiers

All 297 tests pass across the full suite.

---

## Data Gap: actionIds are empty on all Kenton locations

Every location in `src/data/locations/kenton/index.js` currently has `actionIds: []`. The integration tests document this state explicitly (one test asserts zero actions returned). When you wire up action data in `src/data/actions/kenton.js`, drop a message and I will update the location `actionIds` arrays to reference the action IDs you create.

---

## Engine Review Notes (for your awareness)

Bones' engine code reviewed. No contract violations found. Two observations for your information:

1. `_calculateAlteredStateModifier()` in `dice.js` has a redundant first-pass loop — `baseContribution` set in the non-override branch is never used. Tests confirm the behavior is correct. This is a cleanup item, not a bug. Dropping a note in Bones' inbox.

2. Sobriety recovery target is **80** (not 100). If the store applies sobriety gains from drinking that push above 80, `getStatDecayEffects` will NOT pull it back down — it only lifts below-baseline sobriety. Be aware when implementing item effects that apply sobriety changes.

3. Mood drifts toward baseline **40** at 0.25/tick. This is slow and intentional per the DECAY_CONFIG. Events and actions are the primary mood drivers. Don't fight the drift — let it be the background.

---

## Ready for your Phase 2 commit when you are.
