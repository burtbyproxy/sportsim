/**
 * The shapes the models build — the data contract, in one place (BFD-1).
 * Types only: nothing here runs. The factories in this folder are what
 * produce these shapes, and the engines read them.
 */

/**
 * A number on a stat, and what is bending it.
 * @typedef {Object} Stat
 * @property {number} base - 1–100
 * @property {Modifier[]} modifiers
 * @property {number} xp - toward the next point
 */

/**
 * Something bending a stat for a while, or for good.
 * @typedef {Object} Modifier
 * @property {string} source - what put it there
 * @property {number} value - added to the stat
 * @property {number|null} duration - ticks left; null is permanent
 */

/**
 * The player: what they are, what is in them, what they carry and have made.
 * @typedef {Object} Player
 * @property {string} id
 * @property {string} name
 * @property {Object<string, Stat>} stats - by stat id (content/vocabulary.json)
 * @property {Object<string, number>} status - hunger, sobriety and confusion (derived), energy, mood, health, money
 * @property {Object<string, number>} intoxications - by substance id, 0–100
 * @property {Object<string, number>} habituations - by substance id, 0–100
 * @property {number} dazed - a knock to the head, 0–100, wearing off
 * @property {Object} blend - who is in charge; see engine/blend.js
 * @property {Object<string, Object<string, Stat>>} skills - skills[mediumId][personaId]
 * @property {Object[]} inspirations - see engine/inspiration.js
 * @property {Object[]} makings - see engine/making.js
 * @property {Object[]} experiences
 * @property {Object[]} portfolio
 * @property {{ marks: Mark[], abilities: Object[], grooves: Object<string, number> }} psyche
 * @property {Item[]} inventory
 * @property {string} currentLocationId
 * @property {string[]} knownLocationIds - the places the player knows for what they are
 * @property {Object<string, number>} archetypeScores - by archetype id
 * @property {Object<string, number>} counters - by counter name
 */

/**
 * Something that never wears off (engine/psyche.js): which mark
 * (content/marks), what it is about, what left it, and whether it is in a fit.
 * @typedef {Object} Mark
 * @property {string} id
 * @property {string} markId - a mark definition in content/marks
 * @property {{ kind: string, id: string }|null} target - what it is about
 * @property {{ kind: string, id: string }} source - what left it
 * @property {string} status - 'active'
 * @property {number} fitTicksRemaining - 0 when not in a fit
 * @property {number} acquiredAtTick
 * @property {number} updatedAtTick
 */

/**
 * A place: what it is (content) and what has happened there (the run).
 * @typedef {Object} Location
 * @property {string} id
 * @property {string} type
 * @property {string} display
 * @property {string} displayInline - the name inside a sentence
 * @property {{ display: string, displayInline: string, descriptions: Object<string, string> }|null} appearance
 *   - the place as it looks to someone who does not know what it is
 * @property {string|null} pieceAs
 * @property {boolean} outdoors
 * @property {Object<string, string>} descriptions - by variant key; "default" always
 * @property {Object[]} exits
 * @property {{ openHour: number, closeHour: number, closedMessage: string|null }} availability
 * @property {number} visitCount
 * @property {string|null} scavengeTableId
 * @property {{ depletion: number, updatedAtTick: number }} scavenge
 * @property {Object[]} surfaces
 * @property {Object[]} marks
 */

/**
 * A thing: carried, used, worked with, or found.
 * @typedef {Object} Item
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} type - an item type in content/vocabulary.json
 * @property {number} value
 * @property {boolean} stackable
 * @property {number} quantity
 * @property {ItemEffect[]} effects
 * @property {Array<{ substanceId: string, value: number }>} doses
 * @property {string[]} mediumIds
 * @property {string|null} foundAs
 * @property {string|null} pieceAs
 * @property {boolean} spentOnUse
 */

/**
 * What using an item does to a vital.
 * @typedef {Object} ItemEffect
 * @property {string} target - a writable vital
 * @property {number} value
 * @property {number|null} duration
 */

export {}
