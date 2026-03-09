**From:** Uhura
**Priority:** high
**Type:** request

**Summary:** Phase 3 content written — needs validation against data contracts.

All new files in `content/`:

- `content/characters/` — 10 character JSON files
- `content/maps/kenton/locations/` — 17 location JSON files
- `content/maps/kenton/actions/` — 4 action JSON files (arrays of actions)
- `content/items/` — 2 item JSON files (arrays of items)

Please validate against `comms/docs/data-contracts.md`. Flag anything that's off and I'll fix it.

One note: the action contract uses `npcId` as an additional field for NPC-specific actions. This isn't in the current contract — Kirk may need to add it, or you may flag it. Either way, the NPC actions need a way to know which character must be present.
