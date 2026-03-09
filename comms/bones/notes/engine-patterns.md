# Engine Patterns & Gotchas

## GIT POLICY — EFFECTIVE IMMEDIATELY

**I do NOT commit code.** When work is ready, drop a message in Scotty's inbox. He stages, reviews, commits. See `comms/docs/git-conventions.md`.

---

## Altered State Thresholds (dice.js)

The `ALTERED_STATE_CONFIG` in `dice.js` is the key to the drunk-charm mechanic. Config entries can have `overrides: true` — this means when the lower threshold fires, it completely replaces the higher threshold's modifier for that stat (not additive). Without this, sobriety < 15 would stack on sobriety < 30. They shouldn't.

Current threshold behavior:
- sobriety < 30: wits -5, charm +3
- sobriety < 15 (override): wits -10, charm +0, toughness +5 (too far gone — charm collapses)
- energy < 20: all physical stats -3 each
- hunger < 15: wits -3, mood -5
- mood > 80: charm +3, luck +2
- mood < 20: charm -5, creativity +3 (suffering feeds art — the whole point)

## vitest.config.js

Scotty locked it to `tests/**` only. I expanded include to `src/**/*.test.js` as well. Both directories now work. Coverage config also expanded to include engine/utils/narrative.

## Pure Function Rule

NOTHING in the engine mutates player state. resolveAction(), resolveEvent(), getStatDecayEffects() — all return changes to apply. The Pinia store applies them. If you ever find yourself doing `player.status.sobriety -= 10` inside an engine function, you've done it wrong. Stop. Go home.

## seededRandom (utils/random.js)

Uses mulberry32 — fast, good distribution, reproducible. Pass it to any engine function via the `rng` parameter. Critical for testing deterministic outcomes.

---

## Stat Decay (stats.js) — Tuned Baselines

DECAY_CONFIG is exported. Key values:
- Hunger: -1/tick. Starving after ~24 ticks (6 game hours).
- Energy: -0.5/tick. Exhausted after a full active day (~96 ticks).
- Sobriety: +1/tick toward baseline **80** (not 100). Drunk wears off in ~8-12 ticks (2-3 hours).
- Mood: -0.25/tick toward baseline **40**. Slow background melancholy. Events move mood; time brings it back to earth.

If the feel is wrong, change DECAY_CONFIG. Don't hardcode rates anywhere else.

---

## Simulation Engine (simulation.js)

Three tiers — `fixed`, `routine`, `full`. Keep them cheap in that order.

- `fixed`: schedule + probability roll. No status. One call to `resolveSchedule`, one call to `chance`. Done.
- `routine`: same + transit detection. `isInTransit` checks if character is between stops at non-zero minutes past an endHour.
- `full`: status-driven bias first, then schedule fallback. `decisionWeights` on the character data drives which bias fires. Applies one tick of decay — returns `statusChanges` for the worker to apply.

Performance verified: 50 chars (40/8/2 split) < 5ms.

## Schedule Midnight Crossover (schedule.js)

`isHourInWindow` handles bar shifts that cross midnight (e.g. 16:00-02:00). Rule: if `endHour < startHour`, the window spans midnight — `hour >= startHour OR hour < endHour`. Tests cover this. Don't touch it without running the schedule test suite.

## Character Registry (character-registry.js)

`buildCharacterRegistry` indexes by id, tier, and current location. All lookup functions are O(1) via the indexes. `updateCharacterLocation` is immutable — returns new registry. The worker calls this after applying simulation updates.
