# Engine Patterns & Gotchas

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
