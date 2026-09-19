/**
 * Event Engine — checks for and resolves random/triggered events.
 * Pure functions. No side effects. No Vue. No DOM.
 */

import { randomChance } from '../utils/random.js'
import { checkRoll } from './dice.js'
import { inventoryHas } from './items.js'
import { resultOk, resultFail } from './result.js'

/** Enumerated error codes for event resolution. The code is the contract. */
export const EVENT_ERROR_CODES = Object.freeze({
  CHOICE_INVALID: 'CHOICE_INVALID',
})

/**
 * Checks whether the current game state satisfies event conditions.
 * @param {Object} event - GameEvent per data contract
 * @param {Object} player
 * @param {Object} location
 * @param {Object} gameTime
 * @param {string[]} firedEventIds - one-time events that have already fired
 * @returns {boolean}
 */
function _eventConditionsMeet({ event, player, location, gameTime, firedEventIds }) {
  // One-time events that already fired
  if (event.oneTime && firedEventIds.includes(event.id)) return false

  const cond = event.conditions
  if (!cond) return true

  // Location checks — a specific place, or any place of a type (bar, park, market...)
  if (cond.locationId && cond.locationId !== location.id) return false
  if (cond.locationType && cond.locationType !== location.type) return false
  // The street happens on the street: a cruiser does not ease up to the curb in a basement.
  if (cond.outdoors !== null && cond.outdoors !== undefined) {
    if (Boolean(location.outdoors) !== cond.outdoors) return false
  }

  // Time checks
  if (cond.minHour !== null && cond.minHour !== undefined && gameTime.hour < cond.minHour)
    return false
  if (cond.maxHour !== null && cond.maxHour !== undefined && gameTime.hour >= cond.maxHour)
    return false

  // Stat checks
  if (cond.minStats) {
    for (const [stat, minVal] of Object.entries(cond.minStats)) {
      const base = player.stats?.[stat]?.base ?? 0
      if (base < minVal) return false
    }
  }
  if (cond.maxStats) {
    for (const [stat, maxVal] of Object.entries(cond.maxStats)) {
      const base = player.stats?.[stat]?.base ?? 0
      if (base > maxVal) return false
    }
  }

  // Status checks
  if (cond.minStatus) {
    for (const [key, minVal] of Object.entries(cond.minStatus)) {
      const val = player.status?.[key] ?? 0
      if (val < minVal) return false
    }
  }
  if (cond.maxStatus) {
    for (const [key, maxVal] of Object.entries(cond.maxStatus)) {
      const val = player.status?.[key] ?? 0
      if (val > maxVal) return false
    }
  }

  // Item requirements
  if (cond.requiredItems) {
    for (const itemId of cond.requiredItems) {
      if (!inventoryHas({ inventory: player.inventory, itemId })) return false
    }
  }

  // Trauma requirements
  if (cond.requiredTraumas) {
    const playerTraumaIds = player.psyche?.traumas?.map((t) => t.id) ?? []
    for (const traumaId of cond.requiredTraumas) {
      if (!playerTraumaIds.includes(traumaId)) return false
    }
  }

  // Visit count requirement (for current location)
  if (cond.minVisits !== null && cond.minVisits !== undefined) {
    const visits = location.visitCount ?? 0
    if (visits < cond.minVisits) return false
  }

  return true
}

/**
 * Checks all registered random events and returns those that fire this tick.
 * Uses probability rolls (randomChance()) to determine which events trigger.
 *
 * @param {{ player: Object, location: Object, gameTime: Object, events: Object[], firedEventIds?: string[], rng?: (() => number) }} input
 *   events — all event definitions
 * @returns {Object[]} - events that fire this tick
 */
export function eventsRandomCheck({
  player,
  location,
  gameTime,
  events,
  firedEventIds = [],
  rng = Math.random,
}) {
  return events.filter((event) => {
    if (event.type !== 'random') return false
    if (!_eventConditionsMeet({ event, player, location, gameTime, firedEventIds })) return false
    return randomChance({ probability: event.probability ?? 0, rng })
  })
}

/**
 * Checks all registered condition-based (triggered) events.
 * No probability roll — conditions either pass or don't.
 *
 * @param {{ player: Object, location: Object, gameTime: Object, events: Object[], firedEventIds?: string[] }} input
 * @returns {Object[]} - events that should trigger
 */
export function eventsTriggeredCheck({ player, location, gameTime, events, firedEventIds = [] }) {
  return events.filter((event) => {
    if (event.type !== 'triggered') return false
    return _eventConditionsMeet({ event, player, location, gameTime, firedEventIds })
  })
}

/**
 * Resolves an event — either a player choice or the automatic outcome.
 * Does NOT mutate state. Returns outcome for the store to apply.
 *
 * @param {{ event: Object, player: Object, choiceIndex?: number|null, rng?: (() => number) }} input
 *   event — GameEvent per data contract
 *   choiceIndex — which choice the player made (null = no choices)
 * @returns {{ ok: boolean, data: { outcome: Object|null, diceResult: Object|null }|null, error: Object|null }}
 *   fails with CHOICE_INVALID when the choice asked for is not one the event offers.
 */
export function eventResolve({ event, player, choiceIndex = null, rng = Math.random }) {
  // Choice-based event
  if (event.choices && event.choices.length > 0 && choiceIndex !== null) {
    const choice = event.choices[choiceIndex]
    if (!choice) {
      return resultFail({
        code: EVENT_ERROR_CODES.CHOICE_INVALID,
        message: `Event '${event.id}' has no choice ${choiceIndex}`,
        params: { eventId: event.id, choiceIndex },
      })
    }
    if (choice.check) {
      const diceResult = checkRoll({
        player,
        statName: choice.check.stat,
        modifiers: [],
        dc: choice.check.dc,
        rng,
      })
      const outcome = diceResult.success
        ? choice.outcome
        : (choice.failureOutcome ?? choice.outcome)
      return resultOk({ outcome, diceResult })
    } else {
      // No check on this choice — auto-resolve
      return resultOk({ outcome: choice.outcome, diceResult: null })
    }
  }

  // Automatic outcome
  return resultOk({ outcome: event.outcome, diceResult: null })
}
