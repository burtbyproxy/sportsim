# Medical Log — Session 02

Busy session. Multiple patients, all discharged stable.

**Patient 1: git policy breach.** I committed Phase 1 code myself before the ownership policy reached my inbox. Already done. Notified Kirk and Scotty. Scotty was gracious about it. Policy is clear now — code goes to Scotty for commit, not me. Noted in permanent memory.

**Patient 2: Phase 2 decay tuning.** The sobriety baseline was wrong — I had it recovering toward 100 (stone sober) when the contract says 80 (Portland normal). Fixed. Recovery rate halved to 1/tick so drunk wears off in 2-3 game hours, not 1. Added mood drift — slow crawl toward baseline 40. Melancholy as a default state. It's Portland. It's right. Added `DECAY_CONFIG` export so Scotty can reference rates without digging into the function.

**Patient 3: dice.js dead code.** Spock caught a redundant double-pass in `_calculateAlteredStateModifier`. He was correct. Rewrote it as a clean single pass — `overrideValue` and `lastNonOverride` tracked separately. 35 lines to 20. Same behavior, confirmed by 297 tests.

**Patient 4: Phase 3 simulation engine.** Three new modules. The engine room now has characters. 

`schedule.js` handles the tricky schedule math including midnight crossover. Bar shifts that run 16:00-02:00 work correctly. Transit detection works — at 23:15, Carl is walking to Plaid Pantry and you can see him.

`character-registry.js` is the index layer. Everything is O(1). Updates are immutable.

`simulation.js` is `simulateTick()` — three tiers, one function. Fixed characters are nearly free. Routine characters follow their schedule with transit visibility. Full characters feel their status and bias their location decisions — drunk Carl gravitates toward bars, depressed Carl gravitates toward solitude. They're playing the same game the player is. Applies decay each tick, returns status changes for the worker to apply.

Performance: 50 characters in < 5ms. Comfortable margin.

370 tests. All green.

Uhura joined the crew this session — she writes character content, I consume it. No character data exists yet but the engine is ready when she delivers.

One concern I couldn't resolve: the full-sim bias system (`_findBiasedEntry`) does a loose `locationId.includes(bias)` match as a fallback when entries don't have a `type` field. This works for now but Uhura should know to add `type` fields to schedule entries if she wants reliable bias routing. Dropped nothing in her inbox since I don't have a direct channel — routing through Kirk if it becomes an issue.

Left off: inbox clear, active clear. Waiting on Kirk.
