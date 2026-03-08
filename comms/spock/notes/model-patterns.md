# Model Patterns — Spock's Notes

## Coverage Scoping

The legacy model files (liverecord.js, entity.js, artwork.js, collection.js,
possession.js, structure.js, entity/human.js, location/court.js,
possession/consumable.js) are 0% covered and must NOT be included in the
coverage config. They are out of scope for Phase 1 and beyond until Kirk
explicitly reassigns them.

vitest.config.js `coverage.include` must explicitly list only the files we own:
- src/models/player.js
- src/models/location.js
- src/models/npc.js
- src/models/item.js
- src/data/locations/**/*.js

## Vitest Version Constraint

Project uses vitest@1.6.1. The @vitest/coverage-v8 package MUST be pinned to
the same major.minor (1.6.x). The repo had 4.x installed from a prior run —
that caused a `parseAstAsync` export error. Fixed by installing 1.6.1 explicitly.

## npm Install Issues

node-sass (legacy devDependency from the original 2019 codebase) requires
native compilation. Use `--legacy-peer-deps` for all npm installs to avoid
peer dep conflicts. Do NOT use `--ignore-scripts` — it breaks uuid and other
packages that need post-install.

## Data Model Conventions

- All model factories return plain objects — no class instances. Serialization-safe.
- Mutative functions are documented as mutative. Pure functions are noted pure.
- clamp() is a private helper in player.js and npc.js — not exported, not shared.
  If a shared utility module appears, move it there. Until then, keep it local.
- adjustStatus() delegates money to adjustMoney() to centralize no-clamp logic.

## Kenton Location Data

- All 17 locations confirmed: exits only reference other Kenton location IDs
  (no cross-neighborhood exits in Phase 1 data).
- Travel times: 1 tick = adjacent/across street, 2-3 ticks = across neighborhood.
- Bars use overnight availability window (openHour > closeHour, e.g. 11, 2).
  isOpen() handles this correctly with the `openHour > closeHour` branch.
- chief_joseph is 0-23 (grounds accessible, building is not — but zone is walkable).
- moms_house and columbia_park are always open (0-23).

## Bones' Engine Files

As of this session, Bones has committed engine files to src/engine/ but they are
NOT committed yet (untracked). I will review the diffs when they are committed.
Relevant files:
- src/engine/dice.js + dice.test.js
- src/engine/actions.js + actions.test.js
- src/engine/events.js + events.test.js
- src/engine/stats.js + stats.test.js
- src/engine/unlocks.js
- src/utils/ (unknown contents)
