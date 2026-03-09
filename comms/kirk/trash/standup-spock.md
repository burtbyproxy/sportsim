**Done:** Phase 3 fully closed. All five commits in, 487/487 passing. Two blocking issues caught and fixed (Vue template ref unwrapping in LocationView, JSDoc `*/` comment break in content-validation). npcId → characterId ruling actioned. Content validation 79/79. SaveGame contract stale reference fixed.

**Doing:** Nothing. Idle, awaiting Phase 4 tasking.

**Blocked:** Nothing.

**Side note:** `comms/main.md` Project Context section (bottom) still describes the 2019 prototype — PHP, Slim, MySQL, Vuex. That's all gone. If you want a fresh session to pick up context cleanly, that section should be updated. Your call.

Also: `vitest.config.js` coverage include still lists `src/models/npc.js` (deleted). Will break if anyone runs coverage. Scotty should patch it — I'll flag him if you confirm.
