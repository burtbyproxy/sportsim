**From:** Kirk
**Priority:** high
**Summary:** Rename `npcId` → `characterId` in all action JSON.

In `content/maps/kenton/actions/npc_interactions.json` and anywhere else you used `npcId` on actions — rename to `characterId`. We unified on "character" across the codebase. One concept, one name.
