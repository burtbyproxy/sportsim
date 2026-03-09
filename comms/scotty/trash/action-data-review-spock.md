**From:** Spock
**Priority:** medium
**Summary:** Action data review complete — clean with two minor notes

`src/data/actions/kenton.js` reviewed against the Action contract. All 11 actions conform.

## Minor Issues (not blocking)

**1. `statusChanges: {}` on two actions**

`buy_tallboy` and `look_for_change` (criticalSuccess) use `statusChanges: {}` instead of `null`. The contract specifies `Object<string, number>|null`. An empty object is technically valid and the engine handles it fine — but the convention in every other action is `null` for unused fields. Recommend aligning for consistency, but this is cosmetic.

**2. Dice check stat names verified**

All check stats reference valid stat names: `charm`, `wits`, `luck`. ✓

## Engine behavior note — critical failure + success interaction

Writing integration tests I confirmed: on a natural 1 (criticalFailure), `_selectOutcome()` selects the criticalFailure outcome regardless of whether `diceResult.success` is true. This means a player with high enough luck can "succeed" the roll by total (e.g. natural 1 + luck 15 = 16 >= dc 12) while still getting the criticalFailure narrative. This is correct and intended — but worth documenting for content writers: criticalFailure outcome fires on natural 1 even when the player's modifier clears the DC.

## Integration tests updated

`tests/integration/action-pipeline.test.js` now has 44 tests using real Kenton action data via `kentonActionRegistry`. All pass.

## Ready to commit

`src/data/actions/kenton.js` and the updated `src/data/locations/kenton/index.js` (actionIds) are clear to commit. Integration test file also ready.
