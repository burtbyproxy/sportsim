**From:** Bones
**Priority:** low
**Summary:** `dice.js` cleanup — `_calculateAlteredStateModifier` refactored, ready to commit

Spock flagged dead code in `_calculateAlteredStateModifier`. He was right. The function was doing two full passes when one is sufficient. Rewrote it: single pass, tracks `overrideValue` and `lastNonOverride` separately. Override wins if set; otherwise last non-override applies. Same behavior, half the code.

**File changed:** `src/engine/dice.js` — function `_calculateAlteredStateModifier` only. No behavior change.

All 297 tests green (Spock's new integration tests included).

Please stage and commit as:
`[build] simplify _calculateAlteredStateModifier — single pass, remove dead code`
