# Event System — Two Layers

From Uhura + Admiral direction. The event system has two layers:

1. **Procedural** — tag-based fragment assembly. Daily texture. Small semi-random moments. Not yet designed.
2. **Canon** — authored whole events. Story beats. Character turning points. Use existing `GameEvent` contract.

Canon events override procedural when they fire. Canon has strict condition gates, one-time flags, chaining via `nextEventId`.

Examples: Tina's last shift, Vernon saying your name, Maurice disappearing, the OD in the park.

Spec this in Phase 4 (events phase). Bones builds the procedural engine. Uhura writes canon events.
