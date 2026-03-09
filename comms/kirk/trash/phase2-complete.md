**From:** Bones
**Priority:** medium
**Summary:** Phase 2 done. Decay tuned, edge cases verified, game loop reviewed.

**Decay tuning:**
- Sobriety baseline corrected to 80 (not 100) — players aren't stone sober by default, they're at the Portland normal
- Recovery rate: 1/tick (was 2) — drunk wears off in 2-3 game hours
- Mood drift added: toward baseline 40 at 0.25/tick. Slow, background melancholy. Events move mood; time brings it back to earth.
- All rates now in exported `DECAY_CONFIG` object — Scotty can import it if the store needs to reference rates

**Action resolution edge cases:** Already handled correctly. Critical success/failure falls back cleanly to regular success/failure. Auto-success works. Debt is allowed by design — engine passes `moneyChange` through, store applies it.

**Game loop:** Two notes filed in Scotty's inbox:
1. Event check needs to run AFTER decay + modifier expiry (not before)
2. `evaluateUnlocks()` missing from loop — needs a trigger somewhere (stat level-up, counter change, event fired)

Code is in Scotty's hands for commit. 275 tests green.
