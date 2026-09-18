/**
 * Action Engine — resolves player actions through the dice engine.
 * Pure functions. Does NOT mutate player state. Returns changes for the store to apply.
 */

import { rollCheck, rollContested } from './dice.js'

/**
 * Checks whether a player meets the requirements for an action.
 * @param {Object} player - Player per data contract
 * @param {Object} action - Action per data contract
 * @param {Object} gameTime - GameTime per data contract
 * @returns {{ meets: boolean, reason: string|null }}
 */
export function meetsRequirements(player, action, gameTime) {
  const req = action.requirements
  if (!req) return { meets: true, reason: null }

  // Stat requirements
  if (req.minStats) {
    for (const [stat, minVal] of Object.entries(req.minStats)) {
      const base = player.stats?.[stat]?.base ?? 0
      if (base < minVal) {
        return { meets: false, reason: `Requires ${stat} ${minVal} (you have ${base})` }
      }
    }
  }

  // Item requirements
  if (req.requiredItems) {
    for (const itemId of req.requiredItems) {
      const hasItem = player.inventory?.some((i) => i.id === itemId && i.quantity > 0)
      if (!hasItem) {
        return { meets: false, reason: `Requires item: ${itemId}` }
      }
    }
  }

  // Sobriety requirements
  const sobriety = player.status?.sobriety ?? 100
  if (req.minSobriety !== null && req.minSobriety !== undefined && sobriety < req.minSobriety) {
    return { meets: false, reason: `Requires sobriety at least ${req.minSobriety}` }
  }
  if (req.maxSobriety !== null && req.maxSobriety !== undefined && sobriety > req.maxSobriety) {
    return { meets: false, reason: `Requires sobriety no more than ${req.maxSobriety}` }
  }

  // Time of day requirements
  if (req.minHour !== null && req.minHour !== undefined && gameTime.hour < req.minHour) {
    return { meets: false, reason: `Not available before ${req.minHour}:00` }
  }
  if (req.maxHour !== null && req.maxHour !== undefined && gameTime.hour >= req.maxHour) {
    return { meets: false, reason: `Not available after ${req.maxHour}:00` }
  }

  // Visit count requirements
  if (req.minVisits !== null && req.minVisits !== undefined) {
    const locationData = player._locationData // visit counts injected by store if needed
    const visits = locationData?.visitCount ?? 0
    if (visits < req.minVisits) {
      return { meets: false, reason: `Come back more often first` }
    }
  }

  // Trauma requirements
  if (req.requiredTraumas) {
    const playerTraumaIds = player.psyche?.traumas?.map((t) => t.id) ?? []
    for (const traumaId of req.requiredTraumas) {
      if (!playerTraumaIds.includes(traumaId)) {
        return { meets: false, reason: `Requires trauma: ${traumaId}` }
      }
    }
  }

  // Ability requirements
  if (req.requiredAbilities) {
    const playerAbilityIds = player.psyche?.abilities?.map((a) => a.id) ?? []
    for (const abilityId of req.requiredAbilities) {
      if (!playerAbilityIds.includes(abilityId)) {
        return { meets: false, reason: `Requires ability: ${abilityId}` }
      }
    }
  }

  return { meets: true, reason: null }
}

/**
 * Returns the list of available actions at the current location,
 * filtered by requirements and sorted by effective weight.
 * Obsessions boost weight of related actions.
 *
 * @param {Object} player
 * @param {Object} location
 * @param {Object} gameTime
 * @param {Object[]} actionRegistry - all action definitions
 * @returns {Object[]} - sorted array of available actions
 */
export function getAvailableActions(player, location, gameTime, actionRegistry) {
  // Collect action IDs available at this location
  const locationActionIds = new Set(location.actionIds || [])

  // Also include "any" location actions
  const eligible = actionRegistry.filter(
    (a) => locationActionIds.has(a.id) || a.locationId === 'any'
  )

  // Filter by requirements
  const available = eligible.filter((action) => {
    const { meets } = meetsRequirements(player, action, gameTime)
    return meets
  })

  // Build obsession lookup: obsessionId -> strength
  const obsessionStrengths = {}
  if (player.psyche?.obsessions) {
    for (const obs of player.psyche.obsessions) {
      obsessionStrengths[obs.id] = obs.strength
    }
  }

  // Sort by effective weight (descending)
  return available.sort((a, b) => {
    const weightA = _effectiveWeight(a, obsessionStrengths)
    const weightB = _effectiveWeight(b, obsessionStrengths)
    return weightB - weightA
  })
}

/**
 * Calculates the effective display weight of an action, boosted by obsessions.
 * @param {Object} action
 * @param {Object<string, number>} obsessionStrengths
 * @returns {number}
 */
function _effectiveWeight(action, obsessionStrengths) {
  let weight = action.weight || 0
  if (action.obsessionIds) {
    for (const obsId of action.obsessionIds) {
      const strength = obsessionStrengths[obsId] ?? 0
      // Obsession strength (0-100) can add up to 50% of original weight
      weight += (strength / 100) * (action.weight || 0) * 0.5
    }
  }
  return weight
}

/**
 * Selects the appropriate outcome based on dice result.
 * @param {Object} action
 * @param {Object} diceResult
 * @returns {Object} - ActionOutcome
 */
function _selectOutcome(action, diceResult) {
  if (diceResult.criticalSuccess && action.criticalSuccess) {
    return action.criticalSuccess
  }
  if (diceResult.criticalFailure && action.criticalFailure) {
    return action.criticalFailure
  }
  return diceResult.success ? action.success : action.failure
}

/**
 * Resolves a player action. Does NOT mutate player state.
 * Returns the outcome and any changes to be applied by the store.
 *
 * @param {Object} player
 * @param {Object} action - Action per data contract
 * @param {Object} gameTime
 * @param {Object[]} npcs - NPCs present at the location
 * @param {(() => number)} [rng=Math.random]
 * @returns {{ success: boolean, outcome: Object, diceResult: Object|null, requirementFailure: string|null }}
 */
export function resolveAction(player, action, gameTime, npcs = [], rng = Math.random) {
  // Check requirements first
  const { meets, reason } = meetsRequirements(player, action, gameTime)
  if (!meets) {
    return {
      success: false,
      outcome: null,
      diceResult: null,
      requirementFailure: reason,
    }
  }

  // Auto-success — no check required
  if (!action.check) {
    return {
      success: true,
      outcome: action.success,
      diceResult: null,
      requirementFailure: null,
    }
  }

  const check = action.check

  // Contested roll
  if (check.opposedStat && check.opposedNpcId) {
    const npc = npcs.find((n) => n.id === check.opposedNpcId)
    if (!npc) {
      // NPC not present — treat as auto-success (can't contest an absent opponent)
      return {
        success: true,
        outcome: action.success,
        diceResult: null,
        requirementFailure: null,
      }
    }

    const { winner, result1 } = rollContested(
      player,
      [],
      check.stat,
      npc,
      [],
      check.opposedStat,
      rng
    )

    const playerWon = winner === 1
    const diceResult = { ...result1, success: playerWon }
    const outcome = _selectOutcome(action, diceResult)

    return {
      success: playerWon,
      outcome,
      diceResult,
      requirementFailure: null,
    }
  }

  // Standard check
  const diceResult = rollCheck(player, check.stat, [], check.dc, rng)
  const outcome = _selectOutcome(action, diceResult)

  return {
    success: diceResult.success,
    outcome,
    diceResult,
    requirementFailure: null,
  }
}
