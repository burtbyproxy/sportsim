/**
 * Simulation Engine — three-tier character simulation.
 * Runs in a Web Worker. Keep it fast.
 *
 * Tiers:
 *   fixed   — schedule lookup + probability roll. Nearly free.
 *   routine — multi-stop schedule with transit detection.
 *   full    — status-driven decision making + stat decay.
 *
 * Pure functions. No side effects. No Vue. No DOM.
 */

import {
  scheduleEntryResolve,
  scheduleTransitActive,
  scheduleTransitDestination,
} from './schedule.js'
import { statusDecayChanges } from './stats.js'
import { randomChance } from '../utils/random.js'
import { listSortBy } from '../utils/list.js'

// ---------------------------------------------------------------------------
// Tier: fixed
// ---------------------------------------------------------------------------

/**
 * Simulates a fixed-tier character for one tick.
 * They're either at their scheduled post or off-map. No status tracking.
 *
 * @param {Object} character
 * @param {Object} gameTime
 * @param {() => number} rng
 * @returns {Object} CharacterUpdate { id, locationId }
 */
function simulateFixed({ character, gameTime, rng }) {
  const entry = scheduleEntryResolve({
    schedule: character.schedule,
    hour: gameTime.hour,
    dayOfWeek: gameTime.dayOfWeek,
  })

  if (!entry) {
    return { id: character.id, locationId: null }
  }

  const present = randomChance({ probability: entry.probability, rng })
  return { id: character.id, locationId: present ? entry.locationId : null }
}

// ---------------------------------------------------------------------------
// Tier: routine
// ---------------------------------------------------------------------------

/**
 * Simulates a routine-tier character for one tick.
 * Multi-stop schedule. Characters are visible in transit between stops.
 *
 * @param {Object} character
 * @param {Object} gameTime
 * @param {() => number} rng
 * @returns {Object} CharacterUpdate { id, locationId }
 */
function simulateRoutine({ character, gameTime, rng }) {
  const { hour, minute } = gameTime

  // Check if in transit between schedule stops
  if (scheduleTransitActive({ schedule: character.schedule, hour, minute })) {
    const destination = scheduleTransitDestination({ schedule: character.schedule, hour, minute })
    // In transit — show at destination (they're en route, close enough)
    return { id: character.id, locationId: destination }
  }

  const entry = scheduleEntryResolve({
    schedule: character.schedule,
    hour,
    dayOfWeek: gameTime.dayOfWeek,
  })
  if (!entry) {
    return { id: character.id, locationId: null }
  }

  const present = randomChance({ probability: entry.probability, rng })
  return { id: character.id, locationId: present ? entry.locationId : null }
}

// ---------------------------------------------------------------------------
// Tier: full
// ---------------------------------------------------------------------------

/**
 * Determines the location bias for a full-sim character based on their status.
 * Returns the bias string ("bar", "food", "alone", "home") or null.
 *
 * @param {Object} character
 * @returns {string|null}
 */
function getStatusBias(character) {
  const status = character.status
  if (!status) return null
  const weights = character.decisionWeights
  if (!weights) return null

  const candidates = []

  if (weights.low_sobriety && status.sobriety < 30) {
    candidates.push({ bias: weights.low_sobriety.bias, weight: weights.low_sobriety.weight })
  }
  if (weights.low_hunger && status.hunger < 20) {
    candidates.push({ bias: weights.low_hunger.bias, weight: weights.low_hunger.weight })
  }
  if (weights.low_mood && status.mood < 25) {
    candidates.push({ bias: weights.low_mood.bias, weight: weights.low_mood.weight })
  }
  if (weights.low_energy && status.energy < 20) {
    candidates.push({ bias: weights.low_energy.bias, weight: weights.low_energy.weight })
  }

  if (candidates.length === 0) return null

  // Pick the highest-weight bias (deterministic — no RNG needed for bias selection)
  return listSortBy({ items: candidates, keyOf: (c) => c.weight, descending: true })[0].bias
}

/**
 * Finds a schedule entry that matches the given bias type.
 * Returns null if no match found (fall back to normal schedule).
 *
 * The bias match is loose — entry locationId contains the bias word, or
 * the entry has a `type` field matching the bias. This is intentionally
 * simple — full content data can refine this later.
 *
 * @param {Object} schedule
 * @param {string} bias
 * @param {string} dayOfWeek
 * @returns {Object|null}
 */
function biasedEntryFind({ schedule, bias, dayOfWeek }) {
  if (!schedule || !schedule.entries) return null

  for (const entry of schedule.entries) {
    // Not today: a Saturday-only stop is no answer to a Tuesday's hunger.
    if (entry.days && !entry.days.includes('all') && !entry.days.includes(dayOfWeek)) continue
    // Check entry type field (preferred)
    if (entry.type && entry.type === bias) return entry
    // Fall back to loose locationId match
    if (entry.locationId && entry.locationId.includes(bias)) return entry
  }
  return null
}

/**
 * Simulates a full-tier character for one tick.
 * Status affects location decisions. Stat decay is applied.
 *
 * @param {Object} character
 * @param {Object} gameTime
 * @param {() => number} rng
 * @returns {Object} CharacterUpdate { id, locationId, statusChanges? }
 */
function simulateFull({ character, gameTime, rng }) {
  const { hour, minute } = gameTime

  // Apply stat decay (same rates as player — they're playing the same game)
  const statusChanges = character.status
    ? statusDecayChanges({ status: character.status, ticksElapsed: 1 }) // one tick
    : undefined

  // Check status bias first
  const bias = getStatusBias(character)
  if (bias) {
    const biasedEntry = biasedEntryFind({
      schedule: character.schedule,
      bias,
      dayOfWeek: gameTime.dayOfWeek,
    })
    if (biasedEntry) {
      const present = randomChance({ probability: biasedEntry.probability, rng })
      return {
        id: character.id,
        locationId: present ? biasedEntry.locationId : null,
        statusChanges,
      }
    }
    // No matching biased location — fall through to schedule
  }

  // Transit check (same as routine)
  if (scheduleTransitActive({ schedule: character.schedule, hour, minute })) {
    const destination = scheduleTransitDestination({ schedule: character.schedule, hour, minute })
    return { id: character.id, locationId: destination, statusChanges }
  }

  // Normal schedule resolution
  const entry = scheduleEntryResolve({
    schedule: character.schedule,
    hour,
    dayOfWeek: gameTime.dayOfWeek,
  })
  if (!entry) {
    return { id: character.id, locationId: null, statusChanges }
  }

  const present = randomChance({ probability: entry.probability, rng })
  return {
    id: character.id,
    locationId: present ? entry.locationId : null,
    statusChanges,
  }
}

// ---------------------------------------------------------------------------
// Main tick function
// ---------------------------------------------------------------------------

/**
 * Simulates all characters for one game tick.
 * Returns an array of CharacterUpdate objects — one per character.
 *
 * CharacterUpdate: { id: string, locationId: string|null, statusChanges?: Object }
 *
 * @param {{ characters: Object[], gameTime: Object, rng?: () => number }} input
 *   characters — array of Character objects
 *   gameTime — GameTime per data contract
 * @returns {Array<{ id: string, locationId: string|null, statusChanges?: Object }>}
 */
export function simulationTick({ characters, gameTime, rng = Math.random }) {
  const updates = []

  for (const character of characters) {
    let update

    switch (character.simulation) {
      case 'routine':
        update = simulateRoutine({ character, gameTime, rng })
        break
      case 'full':
        update = simulateFull({ character, gameTime, rng })
        break
      case 'fixed':
      default:
        update = simulateFixed({ character, gameTime, rng })
        break
    }

    updates.push(update)
  }

  return updates
}
