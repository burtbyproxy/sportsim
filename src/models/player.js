/**
 * Player model — pure JS, no Vue dependencies.
 * All functions are either pure (returning new state) or explicitly mutative.
 * Safe for JSON serialization (localStorage saves).
 */

import { v4 as uuidv4 } from 'uuid'
import { blendSober, sobrietyDerive } from '../engine/blend.js'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Clamp a number between min and max (inclusive).
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

/**
 * Return a random integer between min and max (inclusive).
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Create a blank Stat object.
 * @param {number} base
 * @returns {import('./types').Stat}
 */
function createStat(base) {
  return { base, modifiers: [], xp: 0 }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** A couple of bucks — what you have when you wake up in the basement. */
export const START_MONEY = 2

/**
 * Create a new Player with default starting values.
 * Stats are randomized slightly around starting ranges.
 *
 * @param {string} name
 * @returns {import('./types').Player}
 */
export function createPlayer(name) {
  return {
    id: uuidv4(),
    name,
    stats: {
      stamina: createStat(randInt(10, 20)),
      toughness: createStat(randInt(10, 20)),
      wits: createStat(randInt(10, 20)),
      creativity: createStat(randInt(10, 20)),
      charm: createStat(randInt(10, 20)),
      reputation: createStat(randInt(10, 20)),
      luck: createStat(randInt(10, 20)),
      karma: createStat(randInt(10, 20)),
    },
    status: {
      hunger: 50,
      sobriety: sobrietyDerive({ intoxications: {} }),
      energy: 70,
      mood: 40,
      health: 100,
      money: START_MONEY,
    },
    /** Per-substance levels, 0–100, keyed by substance id. The source of truth for sobriety. */
    intoxications: {},
    /** Per-substance habituation, 0–100. Past a substance's threshold, its absence is a condition. */
    habituations: {},
    /** Engine-written snapshot of every persona acting on the player. See engine/blend.js. */
    blend: blendSober(),
    psyche: {
      traumas: [],
      obsessions: [],
      insanities: [],
      abilities: [],
    },
    inventory: [],
    currentLocationId: 'moms_house',
    archetypeScores: {},
    counters: {},
    level: 1,
    xp: 0,
  }
}

/**
 * Return the effective value of a stat (base + sum of modifier values).
 * Pure — does not mutate player.
 *
 * @param {import('./types').Player} player
 * @param {string} statName
 * @returns {number}
 */
export function getEffectiveStat(player, statName) {
  const stat = player.stats[statName]
  if (!stat) return 0
  const total = stat.modifiers.reduce((sum, mod) => sum + mod.value, stat.base)
  return clamp(total, 0, 100)
}

/**
 * Decrement all modifier durations, remove expired ones.
 * Mutates player in place. Called every game tick.
 *
 * @param {import('./types').Player} player
 * @returns {void}
 */
export function tickModifiers(player) {
  for (const statName of Object.keys(player.stats)) {
    const stat = player.stats[statName]
    stat.modifiers = stat.modifiers
      .map((mod) => {
        if (mod.duration === null) return mod // permanent
        return { ...mod, duration: mod.duration - 1 }
      })
      .filter((mod) => mod.duration === null || mod.duration > 0)
  }
}

/**
 * Add a temporary (or permanent) modifier to a stat.
 * Mutates player in place.
 *
 * @param {import('./types').Player} player
 * @param {string} statName
 * @param {import('./types').Modifier} modifier
 * @returns {void}
 */
export function addModifier(player, statName, modifier) {
  const stat = player.stats[statName]
  if (!stat) return
  stat.modifiers.push({ ...modifier })
}

/**
 * Add an item to the player's inventory.
 * Handles stacking for stackable items.
 * Mutates player in place.
 *
 * @param {import('./types').Player} player
 * @param {import('./types').Item} item
 * @returns {void}
 */
export function addItem(player, item) {
  if (item.stackable) {
    const existing = player.inventory.find((i) => i.id === item.id)
    if (existing) {
      existing.quantity += item.quantity
      return
    }
  }
  player.inventory.push({ ...item })
}

/**
 * Remove an item from the player's inventory by ID.
 * Mutates player in place.
 *
 * @param {import('./types').Player} player
 * @param {string} itemId
 * @returns {void}
 */
export function removeItem(player, itemId) {
  const idx = player.inventory.findIndex((i) => i.id === itemId)
  if (idx === -1) return
  const item = player.inventory[idx]
  if (item.stackable && item.quantity > 1) {
    item.quantity -= 1
  } else {
    player.inventory.splice(idx, 1)
  }
}

/**
 * Check whether the player has an item in inventory.
 * Pure — does not mutate player.
 *
 * @param {import('./types').Player} player
 * @param {string} itemId
 * @returns {boolean}
 */
export function hasItem(player, itemId) {
  return player.inventory.some((i) => i.id === itemId)
}

/**
 * Adjust a status value by delta, clamping to valid range.
 * money is NOT clamped — use adjustMoney for that.
 * sobriety is derived from intoxications and cannot be adjusted here — dose
 * the player through the blend engine instead. Mutates player in place.
 *
 * Status ranges: hunger/energy/mood/health all 0-100.
 *
 * @param {import('./types').Player} player
 * @param {string} statusName
 * @param {number} delta
 * @returns {void}
 */
export function adjustStatus(player, statusName, delta) {
  if (statusName === 'money') {
    adjustMoney(player, delta)
    return
  }
  if (statusName === 'sobriety') return
  if (!(statusName in player.status)) return
  player.status[statusName] = clamp(player.status[statusName] + delta, 0, 100)
}

/**
 * Adjust the player's money by delta.
 * Can go negative (debt). No clamping.
 * Mutates player in place.
 *
 * @param {import('./types').Player} player
 * @param {number} delta
 * @returns {void}
 */
export function adjustMoney(player, delta) {
  player.status.money += delta
}

/**
 * Add a trauma to the player's psyche.
 * Mutates player in place.
 *
 * @param {import('./types').Player} player
 * @param {import('./types').Trauma} trauma
 * @returns {void}
 */
export function addTrauma(player, trauma) {
  player.psyche.traumas.push({ ...trauma })
}

/**
 * Feed an obsession — increase its strength, clamp to 0-100.
 * If the obsession doesn't exist in psyche, this is a no-op.
 * Mutates player in place.
 *
 * @param {import('./types').Player} player
 * @param {string} obsessionId
 * @param {number} amount
 * @returns {void}
 */
export function feedObsession(player, obsessionId, amount) {
  const obs = player.psyche.obsessions.find((o) => o.id === obsessionId)
  if (!obs) return
  obs.strength = clamp(obs.strength + amount, 0, 100)
}

/**
 * Update an archetype score by delta.
 * Creates the entry if it doesn't exist.
 * Mutates player in place.
 *
 * @param {import('./types').Player} player
 * @param {string} archetypeId
 * @param {number} delta
 * @returns {void}
 */
export function updateArchetypeScore(player, archetypeId, delta) {
  if (!(archetypeId in player.archetypeScores)) {
    player.archetypeScores[archetypeId] = 0
  }
  player.archetypeScores[archetypeId] += delta
}

/**
 * Increment a named counter by delta (default 1).
 * Creates the counter if it doesn't exist.
 * Mutates player in place.
 *
 * @param {import('./types').Player} player
 * @param {string} counterName
 * @param {number} [delta=1]
 * @returns {void}
 */
export function incrementCounter(player, counterName, delta = 1) {
  if (!(counterName in player.counters)) {
    player.counters[counterName] = 0
  }
  player.counters[counterName] += delta
}
