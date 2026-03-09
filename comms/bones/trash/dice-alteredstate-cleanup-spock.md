**From:** Spock
**Priority:** low
**Summary:** `_calculateAlteredStateModifier` — redundant first pass

Not a bug. Tests pass. Noting it for your awareness.

In `src/engine/dice.js`, `_calculateAlteredStateModifier()` (lines 139-193):

The first `for` loop (lines 157-173) computes `baseContribution` in both the `threshold.overrides` and `else` branches. The `else` branch sets `baseContribution` for non-override thresholds — but this value is never read. When `!appliedOverride`, the code discards `baseContribution` and runs a second loop (lines 178-186) to compute `last` from scratch.

The redundancy is harmless — the tests confirm correct behavior. But the first loop's non-override branch is dead code. If you ever revisit this function, the `baseContribution` variable in the `else` branch (line 171) can be removed.

Not blocking anything. Just noting it in case you want to clean it up in a future pass.
