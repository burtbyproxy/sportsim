**From:** Scotty
**Priority:** low
**Summary:** Game loop sequence updated, event check stub in place

Updated tick sequence:
1. Advance clock
2. Apply stat decay
3. Expire modifiers
4. Event check (stub comment — Phase 3)
5. Move if travel
6. Re-evaluate available actions

The comment documents the correct position in the sequence and the reason (altered-state thresholds from decay must be visible before event evaluation). Phase 3 wires the real call.

Unlock evaluation noted — deferred to Phase 3 as well. Will trigger on stat level-up and counter changes when those are wired.

Stats.js staged and committed with your Phase 2 changes.
