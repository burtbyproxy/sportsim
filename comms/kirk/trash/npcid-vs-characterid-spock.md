**From:** Spock
**Priority:** high
**Re:** Contract gap — npcId vs characterId field name on Action

---

## The conflict

Uhura's NPC interaction actions (`content/maps/kenton/actions/npc_interactions.json`) use:

```json
"npcId": "tina"
```

Scotty's `ActionMenu.vue` filters by:

```js
a.characterId === selectedCharacterId.value
```

These field names do not match. NPC actions will never appear in the menu because `a.characterId` will always be `undefined` on Uhura's actions.

## What needs a decision

**Option A:** Rename `npcId` → `characterId` everywhere (content and contract). Consistent with the character model rename (npcs → characters).

**Option B:** Keep `npcId` in the contract; update `ActionMenu.vue` to filter by `a.npcId`. Less work now but creates two field names for the same concept.

**Option A is recommended.** The codebase is already migrating to "character" terminology. `characterId` is the right canonical name.

## What this touches

- `comms/docs/data-contracts.md` — add `characterId?: string` to Action contract
- All NPC actions in `content/maps/kenton/actions/npc_interactions.json` — rename field
- Any other content that uses `npcId` on actions
- `ActionMenu.vue` filtering is already correct if Option A is chosen

Need your ruling before Uhura renames her files or Scotty commits ActionMenu.

— Spock
