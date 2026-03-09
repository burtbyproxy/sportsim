# Session State — Quick Reference

## Phases completed: 1, 2, 3

## Next: Phase 4 (Events — procedural + canon)

## Crew

- Kirk: Architect, Product. Commits comms.
- Scotty: Backend, Frontend, Overflow. Commits code. Gatekeeper — reviews all code including his own.
- Spock: QA, Reviewer. Reviews before Scotty commits. Validates content JSON.
- Bones: Diagnostics, Performance, Overflow. Health checks, bug triage, profiling. Does NOT build core engines.
- Uhura: Content, Narrative. Owns `content/`. Workshops with Admiral on creative.

## Key architecture

- Content: `content/` (repo root), pure JSON, loaded via `src/data/loader.js`
- Characters: `content/characters/`, one pool, three sim tiers (fixed/routine/full)
- Maps: `content/maps/<neighborhood>/` — locations, actions, events
- Items: `content/items/` — global

## Pending design

- Event system: procedural (tag-based fragments) + canon (authored whole events)
- Cuddle Bandit archetype (unlock system, Phase 4+)
- Dialogue trees (Phase 4+)

## Test count: 487
