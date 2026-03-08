# Phase 1: Dice Engine, Action Engine, Event Engine, Stats, Unlocks, Utils

**From:** Kirk
**Priority:** high
**Type:** task

---

## Summary

Build the simulation guts. You own `src/engine/` (except `clock.js` — that's Scotty's), `src/utils/`, and the text generation logic in `src/composables/useNarrative.js`. Everything you build is pure logic — no Vue, no DOM, no UI. Independently testable. This is the tabletop RPG under the hood.

## Prerequisites

- Read `comms/docs/data-contracts.md` — your engines consume Spock's models and produce results that Scotty's UI renders.
- Read `comms/docs/narrative-voice.md` — your text generation functions need to understand the narrative style.

## Deliverables

### 1. Dice Engine (`engine/dice.js`)

The core resolution mechanic. Every meaningful action goes through this.

- `rollD20()` — returns 1-20
- `rollCheck(stat, modifiers, dc)` — rolls d20 + stat + modifiers vs DC. Returns `DiceResult` per contract.
- `rollContested(stat1, modifiers1, stat2, modifiers2)` — two opposed rolls. Returns winner + both results.
- `isCriticalSuccess(natural)` — natural === 20
- `isCriticalFailure(natural)` — natural === 1
- `calculateModifier(player, statName)` — sum up all applicable modifiers for a stat check. Includes: base stat, active modifiers, status effects (drunk = penalty to Wits, bonus to Charm at certain thresholds), active abilities, trauma effects.

**Altered state modifiers (key design element):**
- Sobriety < 30: Wits -5, Charm +3 (you THINK you're charming)
- Sobriety < 15: Wits -10, Charm +0 (too far gone), Toughness +5 (can't feel pain)
- Energy < 20: all physical stats -3
- Hunger < 15: Wits -3, Mood -5
- Mood > 80: Charm +3, Luck +2
- Mood < 20: Charm -5, Creativity +3 (suffering feeds art)

These thresholds should be data-driven (configurable), not hardcoded. Define them in a config object.

### 2. Action Engine (`engine/actions.js`)

Resolves player actions through the dice engine.

- `getAvailableActions(player, location, gameTime, actionRegistry)` — filters all actions at current location by requirements. Returns sorted list (weight-adjusted, obsessions boost weight).
- `resolveAction(player, action, npcs)` — execute an action:
  1. Check requirements (return failure if not met)
  2. Roll dice check (if action has one)
  3. Select outcome (success/failure/critSuccess/critFailure)
  4. Return `ActionResult` containing: outcome data, dice result, narrative text
  - Does NOT mutate player state — returns the changes to be applied by the store.
- `meetsRequirements(player, action, gameTime)` — boolean + reason string if false.

### 3. Event Engine (`engine/events.js`)

Checks for and resolves random/triggered events.

- `checkRandomEvents(player, location, gameTime, eventRegistry)` — iterate registered events, check conditions and probability, return any that fire. Uses dice engine for probability rolls.
- `checkTriggeredEvents(player, location, gameTime, eventRegistry)` — check condition-based events (no probability, just conditions).
- `resolveEvent(event, player, choiceIndex?)` — if event has choices and player chose one, resolve that choice's outcome. If no choices, resolve automatic outcome. Returns same shape as action resolution.

### 4. Stats Engine (`engine/stats.js`)

Stat progression and threshold tracking.

- `gainStatXP(player, statName, amount)` — add XP to a stat. When XP crosses threshold, increment stat base. Return whether a level-up occurred.
- `calculateLevel(player)` — aggregate all stats into a character level.
- `checkArchetypeThresholds(player, archetypeDefinitions)` — check if any archetype score has crossed a recognition threshold. Returns array of newly crossed archetypes.
- `getStatDecayEffects(player, ticksElapsed)` — calculate natural stat decay over time (hunger decreases, energy decreases, sobriety slowly returns to baseline). Returns status changes to apply.

### 5. Unlock Engine (`engine/unlocks.js`)

Evaluates unlock conditions against game state.

- `evaluateUnlocks(gameState, metaState, unlockDefinitions)` — check all locked unlocks against current state. Return array of newly unlocked IDs.
- `evaluateCondition(condition, gameState)` — evaluate a single `UnlockCondition`. Returns boolean.
- `evaluateTrigger(trigger, gameState)` — evaluate a trigger (AND/OR logic over conditions). Returns boolean.

### 6. Utilities

**`utils/random.js`:**
- `seededRandom(seed)` — returns a seeded RNG function. Reproducible rolls for testing.
- `roll(min, max, rng?)` — random int in range. Optional RNG function.
- `weightedPick(items, weightFn, rng?)` — pick from array with weight function.
- `chance(probability, rng?)` — returns boolean with given probability (0-1).
- `shuffle(array, rng?)` — Fisher-Yates shuffle.

**`utils/text.js`:**
- `template(str, vars)` — simple `{{var}}` template replacement.
- `pickVariant(variants, context)` — given a descriptions object and a context, pick the best matching variant (most specific match wins, fall back to "default").
- `toNarrativeText(str, style?)` — convert a plain string to a `NarrativeText` object with default tokens. Convenience for simple text.

### 7. Composable: Text Generation (`composables/useNarrative.js` — generation side)

Note: Scotty builds the animation/rendering side. You build the generation side. Same file or separate — coordinate with Scotty.

- `generateLocationNarrative(location, player, gameTime)` — picks the right description variant, applies any perception filters from player psyche, templates in variables, returns `NarrativeText`.
- `generateActionNarrative(actionResult)` — takes an action resolution result and produces the `NarrativeText` the player will see.
- `generateEventNarrative(event, player)` — produces event narrative with context-sensitive substitutions.

## Notes

- EVERYTHING is pure functions. No side effects, no Vue, no DOM. Input → Output.
- Write Vitest tests for all of it. The dice engine especially needs thorough testing — test modifier stacking, altered state thresholds, critical hits.
- Use the seeded RNG for testing so results are reproducible.
- If the data contracts are missing something you need, drop it in Kirk's inbox. Don't invent your own shapes.
- The altered state modifier thresholds are a CRITICAL game design element. The drunk guy who thinks he's charming — that's the game's soul. Get the modifier math right.

## Acceptance Criteria

1. Dice engine rolls correctly with modifiers, altered state effects, and critical detection
2. Action engine filters, resolves, and returns clean results without mutating input
3. Event engine checks conditions, rolls probability, and resolves outcomes
4. Stats engine handles XP gain, leveling, archetype tracking, and natural decay
5. Unlock engine evaluates arbitrary condition trees (AND/OR with nested conditions)
6. All utility functions work with optional seeded RNG
7. Text generation produces valid `NarrativeText` objects per contract
8. Full Vitest coverage on all engines and utilities
9. Zero Vue/DOM dependencies anywhere
