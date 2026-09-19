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
 * Where a full-sim character's needs pull them: the bias ("bar", "food",
 * "alone", "home") of the heaviest need that is below its threshold, or null.
 * Which needs count, and how low is low, is content (tuning.json `simulation`).
 *
 * @param {{ character: Object, tuning: Object }} input
 * @returns {string|null}
 */
function statusBias({ character, tuning }) {
  const status = character.status
  if (!status) return null
  const weights = character.decisionWeights
  if (!weights) return null

  const candidates = []
  for (const need of tuning.simulation.needs) {
    const weight = weights[need.weightKey]
    if (weight && status[need.status] < need.below) {
      candidates.push({ bias: weight.bias, weight: weight.weight })
    }
  }

  if (candidates.length === 0) return null

  return listSortBy({ items: candidates, keyOf: (c) => c.weight, descending: true })[0].bias
}

/**
 * The first schedule entry for today whose type is the bias, or null (the
 * character falls back to their normal schedule). Matched by the entry's
 * declared type, never by reading its location's id.
 *
 * @param {{ schedule: Object, bias: string, dayOfWeek: string }} input
 * @returns {Object|null}
 */
function biasedEntryFind({ schedule, bias, dayOfWeek }) {
  if (!schedule || !schedule.entries) return null

  for (const entry of schedule.entries) {
    // Not today: a Saturday-only stop is no answer to a Tuesday's hunger.
    if (entry.days && !entry.days.includes('all') && !entry.days.includes(dayOfWeek)) continue
    if (entry.type === bias) return entry
  }
  return null
}

/**
 * Simulates a full-tier character for one tick.
 * Status affects location decisions. Stat decay is applied.
 *
 * @param {{ character: Object, gameTime: Object, rng: () => number, tuning: Object }} input
 * @returns {Object} CharacterUpdate { id, locationId, statusChanges? }
 */
function simulateFull({ character, gameTime, rng, tuning }) {
  const { hour, minute } = gameTime

  // Apply stat decay (same rates as player — they're playing the same game)
  const statusChanges = character.status
    ? statusDecayChanges({ tuning, status: character.status, ticksElapsed: 1 }) // one tick
    : undefined

  // Check status bias first
  const bias = statusBias({ character, tuning })
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
 * @param {{ characters: Object[], gameTime: Object, rng?: () => number, tuning: Object }} input
 *   characters — array of Character objects
 *   gameTime — GameTime per data contract
 * @returns {Array<{ id: string, locationId: string|null, statusChanges?: Object }>}
 */
export function simulationTick({ characters, gameTime, rng = Math.random, tuning }) {
  const updates = []

  for (const character of characters) {
    let update

    switch (character.simulation) {
      case 'routine':
        update = simulateRoutine({ character, gameTime, rng })
        break
      case 'full':
        update = simulateFull({ character, gameTime, rng, tuning })
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
