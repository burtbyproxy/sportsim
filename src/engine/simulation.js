/**
 * Simulation Engine — three-tier character simulation.
 * Runs in a Web Worker. Keep it fast.
 *
 * Tiers:
 *   fixed   — a post, not a person: schedule lookup + probability roll. Nearly free.
 *   routine — a person on a multi-stop schedule, visible in transit, living
 *             the player's day: vitals wear down at the player's rates, and
 *             every stop does to them what it does (tuning `simulation.stops`).
 *   full    — the same, and their needs pull them off the schedule.
 *
 * The schedule stands in for the menu: what the player does by choosing, a
 * character does by standing somewhere. Off the map is the away stop
 * (`simulation.awayStopType`), which is where they sleep and eat.
 *
 * Pure functions. No side effects. No Vue. No DOM.
 */

import {
  scheduleEntryResolve,
  scheduleTransitActive,
  scheduleTransitDestination,
} from './schedule.js'
import { statusChangesApply, statusDecayChanges } from './stats.js'
import { clockAdvance } from './clock.js'
import { numberRound } from '../utils/number.js'
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
// Living: what a tick does to a person
// ---------------------------------------------------------------------------

/**
 * What one tick somewhere does to somebody with vitals: the day's wear
 * (the player's decay), plus what the stop gives, plus what it puts in
 * them. In transit there is no stop, only the wear. A stop tuning does not
 * know gives nothing.
 *
 * @param {{ character: Object, stopType: string|null, tuning: Object }} input
 *   stopType — the stop's type, or null in transit
 * @returns {{ statusChanges: Object<string, number>, doses: Array<{ substanceId: string, value: number }> }}
 */
function livingTick({ character, stopType, tuning }) {
  const statusChanges = statusDecayChanges({ tuning, status: character.status, ticksElapsed: 1 })
  const stop = stopType ? (tuning.simulation.stops[stopType] ?? null) : null
  if (!stop) return { statusChanges, doses: [] }
  for (const [key, delta] of Object.entries(stop.statusChangesPerTick)) {
    statusChanges[key] = (statusChanges[key] ?? 0) + delta
  }
  return { statusChanges, doses: stop.dosesPerTick.map((dose) => ({ ...dose })) }
}

/**
 * A character update for somebody with vitals: where they are, and what
 * this tick did to them there.
 * @param {{ character: Object, locationId: string|null, stopType: string|null, tuning: Object }} input
 * @returns {{ id: string, locationId: string|null, statusChanges?: Object, doses?: Object[] }}
 */
function livingUpdate({ character, locationId, stopType, tuning }) {
  if (!character.status) return { id: character.id, locationId }
  const { statusChanges, doses } = livingTick({ character, stopType, tuning })
  return {
    id: character.id,
    locationId,
    statusChanges,
    ...(doses.length > 0 ? { doses } : {}),
  }
}

/**
 * Where a schedule puts somebody this tick, and at what kind of stop: in
 * transit (at the destination, no stop), at the entry's stop, or, with no
 * entry or a roll that keeps them away, off the map at the away stop.
 * @param {{ entry: Object|null, schedule: Object, gameTime: Object, tuning: Object, rng: () => number }} input
 * @returns {{ locationId: string|null, stopType: string|null }}
 */
function whereabouts({ entry, schedule, gameTime, tuning, rng }) {
  const { hour, minute } = gameTime
  if (scheduleTransitActive({ schedule, hour, minute })) {
    return { locationId: scheduleTransitDestination({ schedule, hour, minute }), stopType: null }
  }
  const away = { locationId: null, stopType: tuning.simulation.awayStopType }
  if (!entry) return away
  const present = randomChance({ probability: entry.probability, rng })
  return present ? { locationId: entry.locationId, stopType: entry.type ?? null } : away
}

// ---------------------------------------------------------------------------
// Tier: routine
// ---------------------------------------------------------------------------

/**
 * Simulates a routine-tier character for one tick: the schedule says where,
 * and the stop says what it does to them.
 *
 * @param {{ character: Object, gameTime: Object, rng: () => number, tuning: Object }} input
 * @returns {Object} CharacterUpdate { id, locationId, statusChanges?, doses? }
 */
function simulateRoutine({ character, gameTime, rng, tuning }) {
  const entry = scheduleEntryResolve({
    schedule: character.schedule,
    hour: gameTime.hour,
    dayOfWeek: gameTime.dayOfWeek,
  })
  const { locationId, stopType } = whereabouts({
    entry,
    schedule: character.schedule,
    gameTime,
    tuning,
    rng,
  })
  return livingUpdate({ character, locationId, stopType, tuning })
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
 * Simulates a full-tier character for one tick: a need may pull them to a
 * stop of its kind ahead of the schedule; otherwise the schedule says
 * where. Either way the stop says what it does to them.
 *
 * @param {{ character: Object, gameTime: Object, rng: () => number, tuning: Object }} input
 * @returns {Object} CharacterUpdate { id, locationId, statusChanges?, doses? }
 */
function simulateFull({ character, gameTime, rng, tuning }) {
  const bias = statusBias({ character, tuning })
  const biasedEntry = bias
    ? biasedEntryFind({ schedule: character.schedule, bias, dayOfWeek: gameTime.dayOfWeek })
    : null
  if (biasedEntry) {
    // Where the need takes them, they are not in transit: the need does not wait.
    const present = randomChance({ probability: biasedEntry.probability, rng })
    return livingUpdate({
      character,
      locationId: present ? biasedEntry.locationId : null,
      stopType: present ? biasedEntry.type : tuning.simulation.awayStopType,
      tuning,
    })
  }
  return simulateRoutine({ character, gameTime, rng, tuning })
}

// ---------------------------------------------------------------------------
// Main tick function
// ---------------------------------------------------------------------------

/**
 * One character, one tick, by tier.
 * @param {{ character: Object, gameTime: Object, rng: () => number, tuning: Object }} input
 * @returns {{ id: string, locationId: string|null, statusChanges?: Object, doses?: Object[] }}
 */
function characterTick({ character, gameTime, rng, tuning }) {
  switch (character.simulation) {
    case 'routine':
      return simulateRoutine({ character, gameTime, rng, tuning })
    case 'full':
      return simulateFull({ character, gameTime, rng, tuning })
    case 'fixed':
    default:
      return simulateFixed({ character, gameTime, rng })
  }
}

/**
 * Simulates all characters over the ticks that just passed, ending at
 * gameTime: when the player spends two hours, everyone else lives two
 * hours, tick by tick, through every stop on the way. Returns an array of
 * CharacterUpdate objects — one per character: where they are now, and
 * what the whole span did to them.
 *
 * CharacterUpdate: { id: string, locationId: string|null, statusChanges?: Object, doses?: Object[] }
 *   statusChanges — for anyone with vitals: what the span came to, the wear
 *   and what every stop gave, held to the vitals' bounds along the way
 *   doses — everything the stops put in them, in order
 *
 * @param {{ characters: Object[], gameTime: Object, ticksElapsed?: number, rng?: () => number, tuning: Object }} input
 *   characters — array of Character objects
 *   gameTime — GameTime per data contract: the time now, at the end of the span
 *   ticksElapsed — how many ticks the span is; the walk ends at gameTime
 * @returns {Array<{ id: string, locationId: string|null, statusChanges?: Object, doses?: Object[] }>}
 */
export function simulationTick({
  characters,
  gameTime,
  ticksElapsed = 1,
  rng = Math.random,
  tuning,
}) {
  const span = Math.max(1, Math.floor(ticksElapsed))
  return characters.map((character) => {
    let status = character.status ? { ...character.status } : null
    const doses = []
    let locationId = null
    for (let back = span - 1; back >= 0; back--) {
      const at = back === 0 ? gameTime : clockAdvance({ gameTime, ticks: -back, tuning })
      const update = characterTick({
        character: { ...character, status },
        gameTime: at,
        rng,
        tuning,
      })
      locationId = update.locationId
      if (update.statusChanges && status) {
        status = statusChangesApply({ status, changes: update.statusChanges })
      }
      if (update.doses) doses.push(...update.doses)
    }
    if (!status) return { id: character.id, locationId }
    const statusChanges = {}
    for (const key of Object.keys(status)) {
      const delta = numberRound({ value: status[key] - character.status[key], places: 2 })
      if (delta !== 0) statusChanges[key] = delta
    }
    return {
      id: character.id,
      locationId,
      statusChanges,
      ...(doses.length > 0 ? { doses } : {}),
    }
  })
}
