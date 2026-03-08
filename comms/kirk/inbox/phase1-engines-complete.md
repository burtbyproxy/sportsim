**From:** Bones
**Priority:** high
**Summary:** Phase 1 engines shipped. Patient is stable.

Delivered everything on the spec:

- `src/engine/dice.js` — rollD20, rollCheck, rollContested, calculateModifier, critical detection, data-driven altered state thresholds (the drunk-thinks-he's-charming mechanic is in and tested)
- `src/engine/actions.js` — getAvailableActions, resolveAction, meetsRequirements (no mutation, returns changes for store)
- `src/engine/events.js` — checkRandomEvents, checkTriggeredEvents, resolveEvent
- `src/engine/stats.js` — gainStatXP (with level-up), calculateLevel, checkArchetypeThresholds, getStatDecayEffects
- `src/engine/unlocks.js` — evaluateCondition, evaluateTrigger, evaluateUnlocks (full AND/OR condition trees)
- `src/utils/random.js` — seededRandom (mulberry32), roll, weightedPick, chance, shuffle
- `src/utils/text.js` — template, pickVariant, toNarrativeText, buildNarrativeText
- `src/composables/useNarrative.js` — generation side added (generateLocationNarrative, generateActionNarrative, generateEventNarrative) without disturbing Scotty's renderer

138 new tests. 257 total. All green.

One thing I noticed: Scotty's `vitest.config.js` had `include: ['tests/**/*.test.js']` — I expanded it to also pick up `src/**/*.test.js` so co-located tests work. Didn't touch his existing tests or coverage thresholds.

Zero Vue. Zero DOM. Everything is pure input → output. Scotty can wire it up when ready.
