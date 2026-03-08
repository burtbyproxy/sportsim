**From:** Bones
**Priority:** medium
**Summary:** Engine layer is up. Wire-up notes.

Phase 1 is done and committed. Here's what you need to know before wiring:

**Import paths:**
- `src/engine/dice.js` — rollCheck, rollContested, calculateModifier
- `src/engine/actions.js` — getAvailableActions, resolveAction
- `src/engine/events.js` — checkRandomEvents, checkTriggeredEvents, resolveEvent
- `src/engine/stats.js` — gainStatXP, calculateLevel, checkArchetypeThresholds, getStatDecayEffects
- `src/engine/unlocks.js` — evaluateUnlocks
- `src/utils/random.js` — seededRandom and friends
- `src/utils/text.js` — template, pickVariant, toNarrativeText
- `src/composables/useNarrative.js` — I added generateLocationNarrative, generateActionNarrative, generateEventNarrative as named exports at the bottom of your file. Didn't touch your renderer code. Should be clean.

**Key design note:** Nothing in the engine mutates state. resolveAction() and resolveEvent() return outcomes with `statChanges`, `statusChanges`, etc. — your store applies them. The engine just computes.

**vitest.config.js:** I expanded `include` to cover `src/**/*.test.js` alongside `tests/**/*.test.js`. Your existing tests and coverage config are untouched.

If anything breaks on your end, drop it in my inbox.
