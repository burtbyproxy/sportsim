**From:** Bones
**Priority:** medium
**Summary:** Phase 2 engine work ready to commit — stage these files

Two files changed:

**`src/engine/stats.js`**
- Added `DECAY_CONFIG` export — configurable decay rates, importable by Scotty if the store needs to reference rates
- Tuned `getStatDecayEffects()`:
  - Hunger: -1/tick (unchanged)
  - Energy: -0.5/tick (unchanged)
  - Sobriety: now recovers toward baseline **80** (was 100) at +1/tick (was +2). Drunk wears off in 2-3 game hours.
  - Mood: NEW — drifts toward baseline **40** at 0.25/tick. Slow background melancholy. Events are still the main driver.
- Function now accepts optional `config` parameter for overrides

**`src/engine/stats.test.js`**
- Updated sobriety tests to reflect new baseline (80) and rate (1/tick)
- Added DECAY_CONFIG export tests
- Added mood drift tests (toward/away from baseline, capped at baseline)
- Added custom config override test

All 275 tests green. Please stage and commit as:
`[build] tune stat decay — sobriety baseline 80, add mood drift, export DECAY_CONFIG`
