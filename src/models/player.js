/**
 * Player model — plain JS, no Vue. playerCreate builds a new player; the
 * other functions change the player they are given, in place, and say so.
 * A player is plain data, safe to serialize for saves.
 */

import { v4 as uuidv4 } from 'uuid'
import { blendSober, sobrietyDerive } from '../engine/blend.js'
import { STAT_IDS_DEFAULT } from './defaults.js'
import { numberClamp } from '../utils/number.js'
import { randomInt } from '../utils/random.js'
import { statCreate } from '../engine/stats.js'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * What a new player starts with when nobody says otherwise. The game itself
 * says otherwise: content/game.json `start` is what a real new game uses.
 */
export const PLAYER_START_DEFAULTS = Object.freeze({
  statIds: STAT_IDS_DEFAULT,
  locationId: 'moms_house',
  money: 2,
  statRoll: Object.freeze({ min: 10, max: 20 }),
  status: Object.freeze({ hunger: 50, energy: 70, mood: 40, health: 100 }),
})

/** A couple of bucks — what you have when you wake up in the basement. */
export const START_MONEY = PLAYER_START_DEFAULTS.money

/**
 * Create a new Player with default starting values.
 * Stats are randomized slightly around starting ranges.
 *
 * @param {{ name: string, start?: { statIds?: string[], locationId?: string, money?: number, statRoll?: { min: number, max: number }, status?: Object<string, number> }, rng?: (() => number) }} input
 *   where, and with what, the player begins (content/game.json `start`)
 * @returns {import('./types').Player}
 */
export function playerCreate({ name, start = PLAYER_START_DEFAULTS, rng = Math.random }) {
  const begin = { ...PLAYER_START_DEFAULTS, ...start }
  const roll = () =>
    statCreate({ base: randomInt({ min: begin.statRoll.min, max: begin.statRoll.max, rng }) })
  return {
    id: uuidv4(),
    name,
    stats: Object.fromEntries(begin.statIds.map((statId) => [statId, roll()])),
    status: {
      hunger: begin.status.hunger,
      sobriety: sobrietyDerive({ intoxications: {} }),
      energy: begin.status.energy,
      mood: begin.status.mood,
      health: begin.status.health,
      money: begin.money,
    },
    /** Per-substance levels, 0–100, keyed by substance id. The source of truth for sobriety. */
    intoxications: {},
    /** Per-substance habituation, 0–100. Past a substance's threshold, its absence is a condition. */
    habituations: {},
    /** Engine-written snapshot of every persona acting on the player. See engine/blend.js. */
    blend: blendSober(),
    /** The skill grid: skills[mediumId][personaId] = { base, modifiers, xp }. See engine/skills.js. */
    skills: {},
    /** Every inspiration that ever struck, at most one active. See engine/inspiration.js. */
    inspirations: [],
    /** Every piece of work ever started, at most one in progress. See engine/making.js. */
    makings: [],
    /** What came of the work: one experience per finished making. */
    experiences: [],
    /** The pieces the player can carry. Pieces left on walls live on the location. */
    portfolio: [],
    psyche: {
      traumas: [],
      obsessions: [],
      insanities: [],
      abilities: [],
    },
    inventory: [],
    currentLocationId: begin.locationId,
    archetypeScores: {},
    counters: {},
  }
}

/**
 * Decrement all modifier durations, remove expired ones.
 * Mutates player in place. Called every game tick.
 *
 * @param {{ player: import('./types').Player }} input
 * @returns {void}
 */
export function modifiersTick({ player }) {
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
 * @param {{ player: import('./types').Player, statName: string, modifier: import('./types').Modifier }} input
 * @returns {void}
 */
export function modifierAdd({ player, statName, modifier }) {
  const stat = player.stats[statName]
  if (!stat) return
  stat.modifiers.push({ ...modifier })
}

/**
 * Add an item to the player's inventory.
 * Handles stacking for stackable items.
 * Mutates player in place.
 *
 * @param {{ player: import('./types').Player, item: import('./types').Item }} input
 * @returns {void}
 */
export function inventoryAdd({ player, item }) {
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
 * @param {{ player: import('./types').Player, itemId: string }} input
 * @returns {void}
 */
export function inventoryRemove({ player, itemId }) {
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
 * Adjust the player's money by delta.
 * Can go negative (debt). No clamping.
 * Mutates player in place.
 *
 * @param {{ player: import('./types').Player, delta: number }} input
 * @returns {void}
 */
export function moneyAdjust({ player, delta }) {
  player.status.money += delta
}

/**
 * Feed an obsession — increase its strength, clamp to 0-100.
 * If the obsession doesn't exist in psyche, this is a no-op.
 * Mutates player in place.
 *
 * @param {{ player: import('./types').Player, obsessionId: string, amount: number }} input
 * @returns {void}
 */
export function obsessionFeed({ player, obsessionId, amount }) {
  const obs = player.psyche.obsessions.find((o) => o.id === obsessionId)
  if (!obs) return
  obs.strength = numberClamp({ value: obs.strength + amount, min: 0, max: 100 })
}

/**
 * Update an archetype score by delta.
 * Creates the entry if it doesn't exist.
 * Mutates player in place.
 *
 * @param {{ player: import('./types').Player, archetypeId: string, delta: number }} input
 * @returns {void}
 */
export function archetypeScoreAdd({ player, archetypeId, delta }) {
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
 * @param {{ player: import('./types').Player, counterName: string, delta?: number }} input
 * @returns {void}
 */
export function counterAdd({ player, counterName, delta = 1 }) {
  if (!(counterName in player.counters)) {
    player.counters[counterName] = 0
  }
  player.counters[counterName] += delta
}
