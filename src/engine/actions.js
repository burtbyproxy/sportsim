/**
 * Action Engine — resolves player actions through the dice engine.
 * Pure functions. Does NOT mutate player state. Returns changes for the store to apply.
 */

import { rollCheck, rollContested } from './dice.js'
import { inspirationActive } from './inspiration.js'

/**
 * Why an action cannot be taken. Each is a voice code: the sentence the
 * player reads lives in content/voices, in the voice of whoever is in charge.
 */
export const REQUIREMENT_CODES = Object.freeze({
  STAT: 'requirement.stat',
  ITEM: 'requirement.item',
  MONEY: 'requirement.money',
  SOBRIETY_MIN: 'requirement.sobriety.min',
  SOBRIETY_MAX: 'requirement.sobriety.max',
  HOUR_EARLY: 'requirement.hour.early',
  HOUR_LATE: 'requirement.hour.late',
  VISITS: 'requirement.visits',
  TRAUMA: 'requirement.trauma',
  ABILITY: 'requirement.ability',
  INSPIRATION: 'requirement.inspiration',
  TIME: 'requirement.time',
  BUSY: 'requirement.busy',
  CLOSED: 'requirement.closed',
})

const _MET = Object.freeze({ meets: true, reasonCode: null, reasonParams: {} })

function _refuse(reasonCode, reasonParams = {}) {
  return { meets: false, reasonCode, reasonParams }
}

/**
 * Checks whether a player meets the requirements for an action.
 * @param {Object} player - Player per data contract
 * @param {Object} action - Action per data contract
 * @param {Object} gameTime - GameTime per data contract
 * @returns {{ meets: boolean, reasonCode: string|null, reasonParams: Object<string, string> }}
 *   reasonCode — a voice code (content/voices) for why not; the words are content, never this module's.
 */
export function meetsRequirements(player, action, gameTime) {
  const req = action.requirements
  if (!req) return _MET

  // Stat requirements
  if (req.minStats) {
    for (const [stat, minVal] of Object.entries(req.minStats)) {
      const base = player.stats?.[stat]?.base ?? 0
      if (base < minVal) {
        return _refuse(REQUIREMENT_CODES.STAT, { stat })
      }
    }
  }

  // Item requirements
  if (req.requiredItems) {
    for (const itemId of req.requiredItems) {
      const hasItem = player.inventory?.some((i) => i.id === itemId && i.quantity > 0)
      if (!hasItem) {
        return _refuse(REQUIREMENT_CODES.ITEM, { itemId })
      }
    }
  }

  // Money floor — anything that costs money declares what it costs
  if (req.minMoney !== null && req.minMoney !== undefined) {
    const money = player.status?.money ?? 0
    if (money < req.minMoney) {
      return _refuse(REQUIREMENT_CODES.MONEY, {
        cost: `$${req.minMoney.toFixed(2)}`,
        money: `$${money.toFixed(2)}`,
      })
    }
  }

  // Sobriety requirements
  const sobriety = player.status?.sobriety ?? 100
  if (req.minSobriety !== null && req.minSobriety !== undefined && sobriety < req.minSobriety) {
    return _refuse(REQUIREMENT_CODES.SOBRIETY_MIN)
  }
  if (req.maxSobriety !== null && req.maxSobriety !== undefined && sobriety > req.maxSobriety) {
    return _refuse(REQUIREMENT_CODES.SOBRIETY_MAX)
  }

  // Time of day requirements
  if (req.minHour !== null && req.minHour !== undefined && gameTime.hour < req.minHour) {
    return _refuse(REQUIREMENT_CODES.HOUR_EARLY)
  }
  if (req.maxHour !== null && req.maxHour !== undefined && gameTime.hour >= req.maxHour) {
    return _refuse(REQUIREMENT_CODES.HOUR_LATE)
  }

  // Visit count requirements
  if (req.minVisits !== null && req.minVisits !== undefined) {
    const locationData = player._locationData // visit counts injected by store if needed
    const visits = locationData?.visitCount ?? 0
    if (visits < req.minVisits) {
      return _refuse(REQUIREMENT_CODES.VISITS)
    }
  }

  // Trauma requirements
  if (req.requiredTraumas) {
    const playerTraumaIds = player.psyche?.traumas?.map((t) => t.id) ?? []
    for (const traumaId of req.requiredTraumas) {
      if (!playerTraumaIds.includes(traumaId)) {
        return _refuse(REQUIREMENT_CODES.TRAUMA, { traumaId })
      }
    }
  }

  // Inspiration — some things cannot be done cold
  if (req.requiresInspiration && !inspirationActive({ player })) {
    return _refuse(REQUIREMENT_CODES.INSPIRATION)
  }

  // Ability requirements
  if (req.requiredAbilities) {
    const playerAbilityIds = player.psyche?.abilities?.map((a) => a.id) ?? []
    for (const abilityId of req.requiredAbilities) {
      if (!playerAbilityIds.includes(abilityId)) {
        return _refuse(REQUIREMENT_CODES.ABILITY, { abilityId })
      }
    }
  }

  return _MET
}

/**
 * Whether an action belongs on a location's menu at all, before any
 * requirement is checked: it is listed there or it goes anywhere, and an
 * action of a kind the place cannot support is left off.
 *
 * @param {{ action: Object, location: Object }} input
 * @returns {boolean}
 */
export function actionApplies({ action, location }) {
  const listed = (location.actionIds || []).includes(action.id) || action.locationId === 'any'
  if (!listed) return false
  if (action.kind === 'scavenge' && !location.scavengeTableId) return false
  return true
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
  // Actions listed here, plus "any" location actions the place can support
  const eligible = actionRegistry.filter((action) => actionApplies({ action, location }))

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
 * @returns {{ success: boolean, outcome: Object, diceResult: Object|null, requirementFailure: { code: string, params: Object }|null }}
 */
export function resolveAction(player, action, gameTime, npcs = [], rng = Math.random) {
  // Check requirements first
  const { meets, reasonCode, reasonParams } = meetsRequirements(player, action, gameTime)
  if (!meets) {
    return {
      success: false,
      outcome: null,
      diceResult: null,
      requirementFailure: { code: reasonCode, params: reasonParams },
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
