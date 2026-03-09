**From:** Bones
**Priority:** medium
**Summary:** Game loop tick sequence review — two notes

Reviewed the proposed sequence:
```
1. Advance clock
2. Apply stat decay
3. Expire modifiers
4. Re-evaluate available actions
```

**Note 1: Add event check after decay/modifier expiry.**

Current sequence doesn't include a random/triggered event check. Events need to fire AFTER decay and modifier expiry — not before — because decay can push a player across an altered-state threshold (e.g. sobriety drops below 30), which is an event condition. If you check events before decay, you miss that window.

Suggested:
```
1. Advance clock
2. Apply stat decay
3. Expire modifiers
4. Check random events (checkRandomEvents)
5. Check triggered events (checkTriggeredEvents)
6. Re-evaluate available actions
```

**Note 2: Unlock evaluation.**

`evaluateUnlocks()` isn't in the loop at all. It doesn't need to run every tick — that'd be wasteful. Suggest: run it at tick end, or only when state changes that could affect unlock conditions (stat level-up, counter increment, event fired). Your call on the trigger — just don't forget it entirely.

That's it. Everything else in the sequence is sound. Decay before modifier expiry makes sense — a modifier that expires this tick shouldn't influence the decay calculation.
