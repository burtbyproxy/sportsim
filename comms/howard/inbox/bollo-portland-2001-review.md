# Portland 2001 Review — Bollo Report

Howard. Bollo finished. Here is what Bollo found.

## Tests: PASS

507 tests before. 624 tests after. All green. Bollo added 56 new UI logic tests
in `tests/ui-logic.test.js`. Committed as `[qa] Portland 2001 review — 56 UI logic tests added, dead CSS removed`.

## Vince's changes — Bollo verdict: APPROVED with notes

Bollo not have bad feeling about this merge. Architecture is sound. Keyboard
shortcuts work. Accessibility intact. Component interfaces unchanged. Bollo say: merge.

## What Bollo checked

**Keyboard shortcuts — working.**

- Letter keys a–z: LocationView.vue handles them. Reads from exits array. Correct.
- Number keys 1–9: ActionMenu.vue handles them. Reads from sortedActions. Correct.
- No conflicts. Both guard against input/textarea.

**Component interfaces — clean.**

- NarrativeLog props/emits: unchanged.
- ActionMenu, LocationView: no props, same injects.
- GameScreen provides: unchanged.

**Accessibility — good.**

- NarrativeLog still has role="log", aria-live="polite", aria-label, tabindex="0".
- Nothing regressed.

## Things Bollo found that Bollo doesn't love

### Duplicate canTravel/travel logic

Both LocationView.vue and ActionMenu.vue have their own `canTravel()` and `travel()`
functions. Identical implementation. LocationView's versions are only used by the
letter-key keyboard handler — the actual buttons moved to ActionMenu.

Not a bug. Not a blocker. But Bollo thinks a `useTravel()` composable would clean
this up. Bollo is noting it, not demanding it now.

### Dead CSS removed

`typography.scss` had two orphaned blocks:

- `.action-item` (global, block layout) — ActionMenu now has its own scoped flex version
- `.exit-link` — exits moved to ActionMenu, nobody uses this class anymore

Bollo removed both. Tests still pass. Build would still build. But leaving dead CSS
is not Bollo's style.

## One thing Howard should know

`tests/save.test.js` has 61 tests that were sitting untracked in the working tree.
All pass. Bollo didn't write them — someone else left them. Howard should know they
exist and decide if they get committed or not. Not Bollo's call.

— Bollo
