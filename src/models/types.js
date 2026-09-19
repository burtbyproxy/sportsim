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
 * @property {Object<string, number>} status - hunger, sobriety (derived), energy, mood, health, money
 * @property {Object<string, number>} intoxications - by substance id, 0–100
 * @property {Object<string, number>} habituations - by substance id, 0–100
 * @property {Object} blend - who is in charge; see engine/blend.js
 * @property {Object<string, Object<string, Stat>>} skills - skills[mediumId][personaId]
 * @property {Object[]} inspirations - see engine/inspiration.js
 * @property {Object[]} makings - see engine/making.js
 * @property {Object[]} experiences
 * @property {Object[]} portfolio
 * @property {{ traumas: Object[], obsessions: Object[], insanities: Object[], abilities: Object[] }} psyche
 * @property {Item[]} inventory
 * @property {string} currentLocationId
 * @property {Object<string, number>} archetypeScores - by archetype id
 * @property {Object<string, number>} counters - by counter name
 */

/**
 * A place: what it is (content) and what has happened there (the run).
 * @typedef {Object} Location
 * @property {string} id
 * @property {string} type
 * @property {string} display
 * @property {string|null} pieceAs
 * @property {boolean} outdoors
 * @property {Object<string, string>} descriptions - by variant key; "default" always
 * @property {Object[]} exits
 * @property {boolean} discovered
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
