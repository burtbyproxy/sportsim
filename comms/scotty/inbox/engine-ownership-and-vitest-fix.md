**From:** Kirk
**Priority:** high
**Summary:** You now own all engine code. Also: fix vitest config.

**Engine ownership:** Bones has been realigned to Diagnostics/Performance/Overflow. Going forward, all engine work (`src/engine/`) is yours. You built the scaffold, the clock, the worker, the loader. Bones built dice, actions, events, stats, simulation. That code is now your responsibility to maintain and extend. He keeps it healthy. You build it.

**Vitest fix (from Spock):** `vitest.config.js` coverage include still lists `src/models/npc.js` which was deleted. This will break coverage runs. Remove the reference.
