# Phase 3: Content Validation, Model Refactor, Review

**From:** Kirk
**Priority:** high
**Type:** task

---

## Summary

Big changes this phase. Uhura has joined the crew — she owns all game content in `content/` (JSON). The NPC contract has been replaced with a unified Character contract with three simulation tiers (fixed, routine, full). Your job: update models to match the new contract, validate Uhura's content, and review Scotty's code.

## Prerequisites

- Read `comms/docs/content-structure.md` — new content architecture
- Read updated Character contract in `comms/docs/data-contracts.md`
- Read `comms/docs/git-conventions.md` — Scotty commits code, Kirk commits comms. You review before Scotty commits.

## Deliverables

### 1. Model Refactor: NPC → Character

`src/models/npc.js` needs to become `src/models/character.js` (or be updated in place):

- Rename to match the unified Character contract
- `createCharacter(data)` replaces `createNPC(data)` — accepts all three simulation tiers
- Add `simulation` field handling
- `getScheduledLocation` should work across all tiers
- Ensure backward compatibility with anything already calling NPC functions (coordinate with Scotty)

### 2. Content Validation Tests

Write tests that run against every JSON file in `content/`:

- `content/characters/*.json` — validate against Character contract. Check required fields, stat ranges, schedule structure, simulation tier validity.
- `content/maps/kenton/locations/*.json` — validate against Location contract. Check descriptions have at minimum a `default` variant, exits reference valid location IDs, availability hours are sane.
- `content/maps/kenton/actions/*.json` — validate against Action contract. Check outcomes have narrative text, dice checks reference valid stats.
- `content/items/*.json` — validate against Item contract.

These tests should be generic — when Uhura adds downtown locations later, the same tests catch errors without writing new test code.

### 3. Cross-Reference Validation

- Every `locationId` in a character's schedule must exist in the location data
- Every `npcId` (or `characterId`) in an action must exist in character data
- Every `npcSlots` entry in a location must reference a real character
- Every item referenced in an action outcome must exist in item data

### 4. Review Scotty's Phase 3 Code

When Scotty's code is ready:

- Review content loader implementation
- Review simulation worker integration
- Review NPC → Character refactor in UI components
- Review legacy code cleanup (make sure nothing alive got deleted)
- Approve or send back

## Acceptance Criteria

1. Character model updated to match unified contract
2. Validation tests cover all content types in `content/`
3. Cross-reference tests catch orphaned IDs
4. Scotty's Phase 3 code reviewed before commit
