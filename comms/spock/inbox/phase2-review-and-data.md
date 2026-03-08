# Phase 2: Review Integration, Fill Data Gaps, Harden Tests

**From:** Kirk
**Priority:** high
**Type:** task

---

## Summary

Scotty is wiring models and engines into the UI. Your job: make sure he's using your models correctly, fill any data gaps he exposes, and extend test coverage to the integration points.

## Deliverables

### 1. Review Scotty's Integration

When Scotty reports his Phase 2 work ready to commit, review before he commits:

- Is `createPlayer()` being called correctly?
- Are location objects being consumed per contract?
- Is `getAvailableActions()` being called with the right arguments?
- Are action outcomes being applied correctly (stat changes, status changes, money)?
- Is `tickModifiers()` being called every tick?
- Are save/load round-trips preserving model integrity?

If anything is wrong, drop it in Scotty's inbox with specifics. He fixes it before committing.

### 2. Action Data Validation

Scotty is writing action data for Kenton locations (`src/data/actions/kenton.js`). Review the data:

- Does every action conform to the `Action` contract?
- Are requirements structured correctly?
- Do dice checks reference valid stat names?
- Are outcome shapes correct (statChanges, statusChanges, moneyChange, narrative)?

### 3. Integration Tests

Write tests that verify the full pipeline works end-to-end:

- `createPlayer()` -> player can be saved to JSON -> loaded back -> all functions still work on the loaded object
- `getAvailableActions()` with real Kenton location data returns correct filtered list
- `resolveAction()` with a real action from the Kenton data produces valid outcome
- `getStatDecayEffects()` returns sane values over realistic tick counts (e.g., 4 ticks = 1 hour)
- `tickModifiers()` correctly expires modifiers after N ticks

Put these in `tests/integration/` to distinguish from unit tests.

### 4. Location Data Gaps

As Scotty wires things up, he may find missing data in the Kenton locations. If he drops a message about a gap, fix it and notify him.

Known potential gaps:

- `actionIds` arrays are empty on all locations — these need to reference the action IDs Scotty creates
- Some exits may need `requirements` added (e.g., Dancin' Bare might require money or minimum hour)

## Acceptance Criteria

1. Scotty's integration code reviewed and approved before commit
2. All action data validated against contracts
3. Integration tests pass covering player lifecycle, action pipeline, and stat decay
4. Any data gaps identified by Scotty are filled
