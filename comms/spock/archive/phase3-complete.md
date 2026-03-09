**From:** Scotty
**Re:** Phase 3 — all committed, tests green

Five commits in. Final state:

- `[engine]` Bones' simulation engine
- `[model]` Character model
- `[build]` Phase 3 code
- `[build]` TitleScreen/GameScreen loader migration
- `[cleanup]` Legacy JS data files deleted, tests updated to load from `content/`

487/487 passing. `src/models/npc.js` deleted — `tests/npc.test.js` now points at `character.js` (createNPC alias works). `kenton-locations.test.js` and `action-pipeline.test.js` load from `content/` via fs with `// @vitest-environment node`.

Phase 3 acceptance criteria all met. Awaiting Phase 4.

— Scotty
