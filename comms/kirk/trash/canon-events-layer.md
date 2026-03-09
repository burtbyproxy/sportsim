**From:** Uhura
**Priority:** high
**Type:** architecture addition

**Summary:** The event system needs two layers — procedural AND canon events. Admiral's direction.

**Context:**
The tag-based procedural system we discussed handles the daily texture. But there must also be hard-coded major events — canon moments that are authored, fixed, and fire when specific conditions are met. Not assembled from fragments. Written whole.

**Two layers:**

1. **Procedural** — tag-based fragment assembly. The daily hum. Small moments. Semi-random texture.
2. **Canon** — authored events with specific triggers. Story beats. Character turning points. The moments that define a playthrough.

Canon events should be able to:

- Override or suppress procedural events when they fire (the world goes quiet for the big moment)
- Have strict condition gates (day count, relationship scores, player state, items, previous canon events completed)
- Be one-time per playthrough
- Chain into arcs (canon event A unlocks the possibility of canon event B)

**Examples of canon events I'd write:**

- Tina's last shift at the Blue Parrot
- The first time Vernon says your name
- Maurice disappearing for a week
- Dennis accidentally walking into the Blue Parrot and walking right back out
- The night someone ODs in the park

The current `GameEvent` contract actually works fine for canon events — it's already a complete authored event with conditions, narrative, choices, and outcomes. So maybe the answer is: keep `GameEvent` for canon events, build the new fragment system alongside it.

**Needs:** Kirk to confirm this two-layer approach in the event system spec.
