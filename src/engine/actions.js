/**
 * Action Engine — resolves player actions through the dice engine.
 * Pure functions. Does NOT mutate player state. Returns changes for the store to apply.
 */

import { checkRoll, checkContestedRoll, CONTEST_WINNERS } from './dice.js'
import { inspirationActive } from './inspiration.js'
import { inventoryHas } from './items.js'
import { moneyFormat } from '../utils/money.js'
import { listSortBy } from '../utils/list.js'

/**
 * Why an action cannot be taken. Each is a voice code: the sentence the
 * player reads lives in content/voices, in the voice of whoever is in charge.
 */
export const REQUIREMENT_CODES = Object.freeze({
  stat: 'requirement.stat',
  item: 'requirement.item',
  money: 'requirement.money',
  sobrietyMin: 'requirement.sobriety.min',
  sobrietyMax: 'requirement.sobriety.max',
  hourEarly: 'requirement.hour.early',
  hourLate: 'requirement.hour.late',
  visits: 'requirement.visits',
  trauma: 'requirement.trauma',
  ability: 'requirement.ability',
  inspiration: 'requirement.inspiration',
  time: 'requirement.time',
  busy: 'requirement.busy',
  closed: 'requirement.closed',
})

const MET = Object.freeze({ meets: true, reasonCode: null, reasonParams: {} })

function refuse({ reasonCode, reasonParams = {} }) {
  return { meets: false, reasonCode, reasonParams }
}

/**
 * Checks whether a player meets the requirements for an action.
 * @param {{ player: Object, action: Object, gameTime: Object, location?: Object|null }} input
 *   location — where the player is; its visitCount is what minVisits reads.
 * @returns {{ meets: boolean, reasonCode: string|null, reasonParams: Object<string, string> }}
 *   reasonCode — a voice code (content/voices) for why not; the words are content, never this module's.
 */
export function requirementsMeet({ player, action, gameTime, location = null }) {
  const req = action.requirements
  if (!req) return MET

  // Stat requirements
  if (req.minStats) {
    for (const [stat, minVal] of Object.entries(req.minStats)) {
      const base = player.stats?.[stat]?.base ?? 0
      if (base < minVal) {
        return refuse({ reasonCode: REQUIREMENT_CODES.stat, reasonParams: { stat } })
      }
    }
  }

  // Item requirements
  if (req.requiredItems) {
    for (const itemId of req.requiredItems) {
      if (!inventoryHas({ inventory: player.inventory, itemId })) {
        return refuse({ reasonCode: REQUIREMENT_CODES.item, reasonParams: { itemId } })
      }
    }
  }

  // Money floor — anything that costs money declares what it costs
  if (req.minMoney !== null && req.minMoney !== undefined) {
    const money = player.status?.money ?? 0
    if (money < req.minMoney) {
      return refuse({
        reasonCode: REQUIREMENT_CODES.money,
        reasonParams: {
          cost: moneyFormat({ amount: req.minMoney }),
          money: moneyFormat({ amount: money }),
        },
      })
    }
  }

  // Sobriety requirements
  const sobriety = player.status?.sobriety ?? 100
  if (req.minSobriety !== null && req.minSobriety !== undefined && sobriety < req.minSobriety) {
    return refuse({ reasonCode: REQUIREMENT_CODES.sobrietyMin })
  }
  if (req.maxSobriety !== null && req.maxSobriety !== undefined && sobriety > req.maxSobriety) {
    return refuse({ reasonCode: REQUIREMENT_CODES.sobrietyMax })
  }

  // Time of day requirements
  if (req.minHour !== null && req.minHour !== undefined && gameTime.hour < req.minHour) {
    return refuse({ reasonCode: REQUIREMENT_CODES.hourEarly })
  }
  if (req.maxHour !== null && req.maxHour !== undefined && gameTime.hour >= req.maxHour) {
    return refuse({ reasonCode: REQUIREMENT_CODES.hourLate })
  }

  // Visit count requirements
  if (req.minVisits !== null && req.minVisits !== undefined) {
    // How often the player has been HERE. The same count the event engine reads.
    const visits = location?.visitCount ?? 0
    if (visits < req.minVisits) {
      return refuse({ reasonCode: REQUIREMENT_CODES.visits })
    }
  }

  // Trauma requirements
  if (req.requiredTraumas) {
    const playerTraumaIds = player.psyche?.traumas?.map((t) => t.id) ?? []
    for (const traumaId of req.requiredTraumas) {
      if (!playerTraumaIds.includes(traumaId)) {
        return refuse({ reasonCode: REQUIREMENT_CODES.trauma, reasonParams: { traumaId } })
      }
    }
  }

  // Inspiration — some things cannot be done cold
  if (req.requiresInspiration && !inspirationActive({ player })) {
    return refuse({ reasonCode: REQUIREMENT_CODES.inspiration })
  }

  // Ability requirements
  if (req.requiredAbilities) {
    const playerAbilityIds = player.psyche?.abilities?.map((a) => a.id) ?? []
    for (const abilityId of req.requiredAbilities) {
      if (!playerAbilityIds.includes(abilityId)) {
        return refuse({ reasonCode: REQUIREMENT_CODES.ability, reasonParams: { abilityId } })
      }
    }
  }

  return MET
}

/** Action kinds the engine gives a meaning to. Content picks one with `kind`. */
export const ACTION_KINDS = Object.freeze({
  scavenge: 'scavenge',
  make: 'make',
  look: 'look',
  investigate: 'investigate',
})

/**
 * Whether an action belongs on a location's menu at all, before any
 * requirement is checked. The action says where it lives: one place, or
 * anywhere. A place the player does not know keeps its own business to
 * itself: only what can be done anywhere is offered, and finding out what
 * the place is. An action of a kind the place cannot support is left off,
 * and an action with someone is left off when they are not here.
 *
 * @param {{ action: Object, location: Object, known: boolean, characters: Object[] }} input
 *   known — whether the player knows the place; characters — those present at the location.
 * @returns {boolean}
 */
export function actionApplies({ action, location, known, characters }) {
  if (action.locationId !== 'any' && action.locationId !== location.id) return false
  if (!known && action.locationId !== 'any') return false
  if (action.kind === ACTION_KINDS.investigate && known) return false
  if (action.kind === ACTION_KINDS.scavenge && !location.scavengeTableId) return false
  if (action.characterId && !characters.some((c) => c.id === action.characterId)) return false
  return true
}

/**
 * Returns the list of available actions at the current location,
 * filtered by requirements and sorted by effective weight.
 * Obsessions boost weight of related actions.
 *
 * @param {{ player: Object, location: Object, known: boolean, characters: Object[], gameTime: Object, actionRegistry: Object[] }} input
 *   known — whether the player knows the place; characters — those present at
 *   the location; actionRegistry — all action definitions
 * @returns {Object[]} - sorted array of available actions
 */
export function actionsAvailable({
  player,
  location,
  known,
  characters,
  gameTime,
  actionRegistry,
}) {
  // Actions that live here or anywhere, that the place and the company support
  const eligible = actionRegistry.filter((action) =>
    actionApplies({ action, location, known, characters })
  )

  // Filter by requirements
  const available = eligible.filter((action) => {
    const { meets } = requirementsMeet({ player, action, gameTime, location })
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
  return listSortBy({
    items: available,
    keyOf: (action) => weightEffective({ action, obsessionStrengths }),
    descending: true,
  })
}

/**
 * Calculates the effective display weight of an action, boosted by obsessions.
 * @param {Object} action
 * @param {Object<string, number>} obsessionStrengths
 * @returns {number}
 */
function weightEffective({ action, obsessionStrengths }) {
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
function outcomeSelect({ action, diceResult }) {
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
 * @param {{ player: Object, action: Object, gameTime: Object, location?: Object|null, characters?: Object[], rng?: (() => number) }} input
 *   characters — those present at the location; rng defaults to Math.random.
 * @returns {{ success: boolean, outcome: Object, diceResult: Object|null, requirementFailure: { code: string, params: Object }|null }}
 */
export function actionResolve({
  player,
  action,
  gameTime,
  location = null,
  characters = [],
  rng = Math.random,
  tuning,
}) {
  // Check requirements first
  const { meets, reasonCode, reasonParams } = requirementsMeet({
    player,
    action,
    gameTime,
    location,
  })
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
    const npc = characters.find((c) => c.id === check.opposedNpcId)
    if (!npc) {
      // NPC not present — treat as auto-success (can't contest an absent opponent)
      return {
        success: true,
        outcome: action.success,
        diceResult: null,
        requirementFailure: null,
      }
    }

    const contest = checkContestedRoll({
      tuning,
      first: { player, statName: check.stat },
      second: { player: npc, statName: check.opposedStat },
      rng,
    })

    const playerWon = contest.winner === CONTEST_WINNERS.first
    const diceResult = { ...contest.first, success: playerWon }
    const outcome = outcomeSelect({ action, diceResult })

    return {
      success: playerWon,
      outcome,
      diceResult,
      requirementFailure: null,
    }
  }

  // Standard check
  const diceResult = checkRoll({
    tuning,
    player,
    statName: check.stat,
    modifiers: [],
    dc: check.dc,
    rng,
  })
  const outcome = outcomeSelect({ action, diceResult })

  return {
    success: diceResult.success,
    outcome,
    diceResult,
    requirementFailure: null,
  }
}
