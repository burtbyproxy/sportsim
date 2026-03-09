# Data Contracts — Interface Agreements

**Maintained by:** Kirk
**Status:** Living document — all crew must review before writing code

These are the shapes that connect Spock's models, Bones' engines, and Scotty's UI. If you build to these contracts, nothing collides.

---

## Player

```js
/** @typedef {Object} Player
 * @property {string} id
 * @property {string} name
 * @property {PlayerStats} stats
 * @property {PlayerStatus} status
 * @property {PlayerPsyche} psyche
 * @property {Item[]} inventory
 * @property {string} currentLocationId
 * @property {Object<string, number>} archetypeScores - invisible identity tracking
 * @property {Object<string, number>} counters - general purpose counters for unlock triggers
 * @property {number} level
 * @property {number} xp
 */

/** @typedef {Object} PlayerStats
 * @property {Stat} stamina
 * @property {Stat} toughness
 * @property {Stat} wits
 * @property {Stat} creativity
 * @property {Stat} charm
 * @property {Stat} reputation
 * @property {Stat} luck
 * @property {Stat} karma
 */

/** @typedef {Object} Stat
 * @property {number} base - 1-100
 * @property {Modifier[]} modifiers - temporary bonuses/penalties
 * @property {number} xp - progress toward next point
 */

/** @typedef {Object} Modifier
 * @property {string} source - what caused this modifier
 * @property {number} value - positive or negative
 * @property {number|null} duration - game ticks remaining, null = permanent
 */

/** @typedef {Object} PlayerStatus
 * @property {number} hunger - 0-100 (0=starving, 100=stuffed)
 * @property {number} sobriety - 0-100 (0=blackout, 100=stone sober)
 * @property {number} energy - 0-100 (0=collapsed, 100=wired)
 * @property {number} mood - 0-100 (0=despair, 100=euphoric)
 * @property {number} health - 0-100 (0=dead, 100=peak)
 * @property {number} money - dollars, can be negative (debt)
 */

/** @typedef {Object} PlayerPsyche
 * @property {Trauma[]} traumas
 * @property {Obsession[]} obsessions
 * @property {Insanity[]} insanities
 * @property {Ability[]} abilities
 */

/** @typedef {Object} Trauma
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} source - event that caused it
 * @property {Object} effects - stat modifiers, action filters, perception changes
 */

/** @typedef {Object} Obsession
 * @property {string} id
 * @property {string} name
 * @property {number} strength - 0-100, grows with repeated behavior
 * @property {string[]} relatedActions - action IDs that feed this obsession
 * @property {Object} effects - action weight modifiers
 */

/** @typedef {Object} Insanity
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {Object} perceptionFilter - how this alters what the player sees
 */

/** @typedef {Object} Ability
 * @property {string} id
 * @property {string} name
 * @property {string} description - always ambiguous
 * @property {string[]} requiredStates - altered states that activate this
 * @property {Object} effects - dice modifiers, info reveals, etc.
 * @property {boolean} active - currently usable given player state
 */
```

---

## Location

```js
/** @typedef {Object} Location
 * @property {string} id - e.g. "blue_parrot"
 * @property {string} type - e.g. "bar", "home", "park", "market"
 * @property {string} variant - e.g. "tavern", "exotic", "convenience"
 * @property {string} display - e.g. "The Blue Parrot"
 * @property {Object<string, string>} descriptions - keyed by context
 *   - "default" - first/typical visit
 *   - "night" - nighttime variant
 *   - "drunk" - altered state variant
 *   - "repeat" - subsequent visits
 *   - "exhausted", "starving", etc.
 * @property {Exit[]} exits
 * @property {string[]} npcSlots - NPC IDs that CAN be here (simulation decides who IS here)
 * @property {string[]} actionIds - action IDs available at this location
 * @property {boolean} discovered - whether player knows about this location
 * @property {AvailabilityWindow} availability - when this location is accessible
 * @property {number} visitCount - how many times player has been here
 */

/** @typedef {Object} Exit
 * @property {string} locationId - destination
 * @property {string} label - e.g. "Head north to Denver Ave"
 * @property {number} travelTime - in game ticks (1 tick = 15 min)
 * @property {Object|null} requirements - stat/item/state requirements to use this exit
 */

/** @typedef {Object} AvailabilityWindow
 * @property {number} openHour - 0-23
 * @property {number} closeHour - 0-23
 * @property {string|null} closedMessage - what to show when closed
 */
```

---

## Character

All people in the game — NPCs and simulated PCs — use the same contract. The `simulation` field controls how much work the engine does for this character.

```js
/** @typedef {Object} Character
 * @property {string} id
 * @property {string} name
 * @property {string} description - physical description
 * @property {string} habit - one tic or repeated behavior
 * @property {string} voice - how they talk (short sentences, big words, etc.)
 * @property {string} simulation - "fixed", "routine", or "full" (see content-structure.md)
 * @property {CharacterStats} stats - same structure as player, simulated in Worker
 * @property {CharacterStatus|null} status - hunger, sobriety, energy, mood, health (null for fixed)
 * @property {CharacterPsyche} psyche - traumas, obsessions, insanities, abilities
 * @property {CharacterSchedule} schedule
 * @property {number} relationshipScore - -100 to 100 with player
 * @property {string} currentLocationId - set by simulation
 * @property {string[]} dialogueTreeIds - available conversation trees
 * @property {string} want - what they want (internal, may never be revealed)
 * @property {string} fear - what they fear (internal)
 * @property {number} level
 * @property {DecisionWeights|null} decisionWeights - only for "full" simulation characters
 */

/** @typedef {Object} CharacterSchedule
 * @property {ScheduleEntry[]} entries - ordered by priority
 */

/** @typedef {Object} ScheduleEntry
 * @property {string} locationId - where
 * @property {number} startHour - when (0-23)
 * @property {number} endHour
 * @property {number} probability - 0-1, chance they're actually there (simulation rolls this)
 * @property {string[]} days - days of week, or ["all"]
 */

/** @typedef {Object} DecisionWeights
 * @property {Object|null} low_sobriety - { bias: string, weight: number }
 * @property {Object|null} low_hunger - { bias: string, weight: number }
 * @property {Object|null} low_mood - { bias: string, weight: number }
 * @property {Object|null} low_energy - { bias: string, weight: number }
 */
```

---

## Item

```js
/** @typedef {Object} Item
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} type - "consumable", "tool", "junk", "key", "weapon"
 * @property {number} value - dollar value
 * @property {boolean} stackable
 * @property {number} quantity
 * @property {ItemEffect[]} effects - what happens when used
 */

/** @typedef {Object} ItemEffect
 * @property {string} target - "hunger", "sobriety", "energy", "mood", "health", stat name
 * @property {number} value - positive or negative
 * @property {number|null} duration - ticks, null = instant
 */
```

---

## Action

```js
/** @typedef {Object} Action
 * @property {string} id
 * @property {string} label - what the player sees in the menu
 * @property {string} locationId - where this action is available (or "any")
 * @property {string|null} characterId - if set, action only available when this character is present
 * @property {number} timeCost - in game ticks
 * @property {ActionRequirements} requirements
 * @property {DiceCheck|null} check - null = auto-success
 * @property {ActionOutcome} success
 * @property {ActionOutcome} failure
 * @property {ActionOutcome|null} criticalSuccess
 * @property {ActionOutcome|null} criticalFailure
 * @property {number} weight - for ordering in action menu (higher = more prominent)
 * @property {string[]} obsessionIds - obsessions that boost this action's weight
 */

/** @typedef {Object} ActionRequirements
 * @property {Object<string, number>|null} minStats - e.g. { charm: 15 }
 * @property {string[]|null} requiredItems - item IDs
 * @property {number|null} minSobriety
 * @property {number|null} maxSobriety
 * @property {number|null} minHour - time of day
 * @property {number|null} maxHour
 * @property {number|null} minVisits - minimum visits to this location
 * @property {string[]|null} requiredTraumas - trauma IDs
 * @property {string[]|null} requiredAbilities - ability IDs
 */

/** @typedef {Object} DiceCheck
 * @property {string} stat - which stat to roll against
 * @property {number} dc - difficulty class
 * @property {string|null} opposedStat - if contested roll, NPC's stat
 * @property {string|null} opposedNpcId - which NPC to roll against
 */

/** @typedef {Object} ActionOutcome
 * @property {NarrativeText} narrative - what the player reads
 * @property {Object<string, number>|null} statChanges - e.g. { charm: 2, stamina: -1 }
 * @property {Object<string, number>|null} statusChanges - e.g. { mood: 10, sobriety: -15 }
 * @property {number|null} moneyChange
 * @property {string[]|null} itemsGained - item IDs
 * @property {string[]|null} itemsLost - item IDs
 * @property {string|null} eventTriggered - event ID
 * @property {string|null} locationDiscovered - location ID
 * @property {Object<string, number>|null} archetypeChanges - e.g. { cult_leader: 5 }
 * @property {Object<string, number>|null} counterChanges - e.g. { fights_won: 1 }
 * @property {string|null} traumaGained - trauma ID
 * @property {string|null} obsessionFed - obsession ID (increases strength)
 */
```

---

## Narrative Text

```js
/** @typedef {Object} NarrativeText
 * @property {NarrativeToken[]} tokens
 */

/** @typedef {Object} NarrativeToken
 * @property {string} text - the actual text content
 * @property {string} style - "normal", "bold", "italic", "highlight", "whisper", "shout"
 * @property {string|null} color - CSS color or null for default
 * @property {string} speed - "instant", "slow", "normal", "fast", "crawl"
 * @property {number} pauseAfter - ms to pause after this token renders
 * @property {string} effect - "none", "flicker", "glitch", "fade"
 */
```

This allows the narrative renderer to do things like:

```js
{
  tokens: [
    { text: 'The bartender looks at you. ', speed: 'normal', pauseAfter: 500 },
    { text: 'Really', style: 'italic', speed: 'slow', pauseAfter: 200 },
    { text: ' looks at you.', speed: 'normal', pauseAfter: 800 },
    { text: ' "Get out."', style: 'bold', speed: 'crawl', pauseAfter: 0 },
  ]
}
```

---

## Event

```js
/** @typedef {Object} GameEvent
 * @property {string} id
 * @property {string} type - "random", "triggered", "chain", "npc_generated"
 * @property {EventConditions} conditions - when this event can fire
 * @property {number} probability - 0-1 for random events
 * @property {boolean} oneTime - can only fire once per playthrough
 * @property {boolean} fired - has it fired this run
 * @property {NarrativeText} narrative
 * @property {EventChoice[]|null} choices - null = no choice, just narration
 * @property {ActionOutcome} outcome - if no choices, this is the automatic outcome
 * @property {string|null} nextEventId - for chain events
 */

/** @typedef {Object} EventConditions
 * @property {string|null} locationId - must be at this location (null = any)
 * @property {number|null} minHour
 * @property {number|null} maxHour
 * @property {Object<string, number>|null} minStats
 * @property {Object<string, number>|null} maxStats
 * @property {Object<string, number>|null} minStatus
 * @property {Object<string, number>|null} maxStatus
 * @property {string[]|null} requiredItems
 * @property {string[]|null} requiredTraumas
 * @property {number|null} minVisits - to current location
 */

/** @typedef {Object} EventChoice
 * @property {string} label - what the player sees
 * @property {DiceCheck|null} check
 * @property {ActionOutcome} outcome
 */
```

---

## Unlock

```js
/** @typedef {Object} Unlock
 * @property {string} id
 * @property {string} category - "archetype", "starting_location", "starting_perk", "modifier", "lore"
 * @property {string} name
 * @property {string} description
 * @property {boolean} unlocked - in meta-save
 * @property {UnlockTrigger} trigger
 * @property {UnlockReward|null} reward - what you get when starting with this unlock
 */

/** @typedef {Object} UnlockTrigger
 * @property {string} type - "all" (AND), "any" (OR)
 * @property {UnlockCondition[]} conditions
 */

/** @typedef {Object} UnlockCondition
 * @property {string} type - "stat", "counter", "event_completed", "location_discovered", "death_by", "run_completed"
 * @property {string} key - stat name, counter name, event ID, etc.
 * @property {string} op - ">=", "<=", "==", "!="
 * @property {*} value
 */

/** @typedef {Object} UnlockReward
 * @property {Object<string, number>|null} startingStats - stat overrides
 * @property {string|null} startingLocation - location ID
 * @property {string[]|null} startingItems - item IDs
 * @property {Object<string, number>|null} startingStatus - status overrides
 * @property {string|null} introNarrative - custom intro text
 */
```

---

## Dice Roll Result

```js
/** @typedef {Object} DiceResult
 * @property {number} natural - the raw d20 roll
 * @property {number} modifier - total modifier from stats + effects
 * @property {number} total - natural + modifier
 * @property {number} dc - difficulty class
 * @property {boolean} success - total >= dc
 * @property {boolean} criticalSuccess - natural === 20
 * @property {boolean} criticalFailure - natural === 1
 * @property {string} stat - which stat was checked
 */
```

---

## Game Time

```js
/** @typedef {Object} GameTime
 * @property {number} tick - total ticks since game start
 * @property {number} day - current day number (1-indexed)
 * @property {number} hour - 0-23
 * @property {number} minute - 0 or 15 or 30 or 45
 * @property {string} period - "morning", "afternoon", "evening", "night", "late_night"
 * @property {string} dayOfWeek - "monday" through "sunday"
 */
```

---

## Save Game

```js
/** @typedef {Object} SaveGame
 * @property {string} id - unique save ID
 * @property {string} name - display name
 * @property {number} timestamp - real-world save time
 * @property {Player} player
 * @property {GameTime} time
 * @property {Object<string, Location>} locations - keyed by ID, with visit counts and discovery state
 * @property {Object<string, Character>} characters - keyed by ID, with relationship scores and current state
 * @property {string[]} firedEventIds - one-time events that have fired
 * @property {Object<string, number>} counters - global game counters
 */
```

## Meta Save (persists across playthroughs)

```js
/** @typedef {Object} MetaSave
 * @property {string[]} unlockedIds - IDs of unlocked items
 * @property {RunRecord[]} completedRuns
 * @property {Object<string, number>} globalCounters - across all runs
 */

/** @typedef {Object} RunRecord
 * @property {string} endType - "death", "arrest", "fame", "left_town", "enlightenment", etc.
 * @property {number} daysPlayed
 * @property {string} dominantArchetype - highest archetype score at end
 * @property {number} timestamp
 */
```
