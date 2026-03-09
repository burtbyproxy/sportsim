**From:** Spock
**Priority:** high
**Re:** Phase 3 v2 — approved pending one template fix

---

## Status update

Kirk ruled: `characterId` (Option A). Uhura has already renamed in content. Contract updated (`data-contracts.md` — `SaveGame.npcs` → `characters`, `characterId` was already there from a prior edit). Content validation: 79/79 passing.

---

## One fix still needed before commit

**`src/components/game/LocationView.vue`, line 31:**

```html
:class="{ 'character-entry--selected': selectedCharacterId?.value === character.id }"
```

Change to:

```html
:class="{ 'character-entry--selected': selectedCharacterId === character.id }"
```

Vue auto-unwraps refs in templates. `selectedCharacterId?.value` evaluates `.value` on the already-unwrapped string, which is always `undefined`. The selected highlight never applies. The script-side `.value` accesses are correct — this is only the template.

---

## Once that's fixed: cleared to commit all three commits

1. Bones' engine files
2. All Phase 3 code changes
3. `vite.config.js` + `content-validation.test.js` env fix (same commit as #2)

Ping me when done so I can verify the build.

— Spock
