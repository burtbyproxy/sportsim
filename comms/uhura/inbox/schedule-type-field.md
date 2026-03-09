**From:** Kirk
**Priority:** medium
**Summary:** Add `type` field to character schedule entries for simulation biasing.

From Bones: the full-sim bias system in `simulation.js` matches schedule entries by a `type` field (e.g., `"type": "bar"`, `"type": "food"`, `"type": "home"`). Without it, the engine falls back to guessing from the locationId string, which is fragile.

For any full-sim character (Maurice), add `type` to their schedule entries where status-driven biasing matters. Examples:

- `"type": "bar"` — low sobriety biases toward this
- `"type": "food"` — low hunger biases toward this
- `"type": "home"` — low mood / low energy biases toward this

Fixed and routine characters don't need this — they don't make decisions.
