/**
 * Skills Engine — the grid of medium × persona.
 *
 * There is no "painting" skill. There is painting-sober, painting-stoned,
 * painting-as-the-priest, each its own cell with its own base and its own
 * experience. Practice trains the cells the current blend touches, in
 * proportion to their weight; a check reads the same cells the same way.
 * Carve wood swords drunk all winter and you are still no painter.
 *
 * Mediums are content (content/mediums). Persona ids come from the blend.
 * Pure functions. No side effects. No Vue. No DOM. Single input struct in,
 * result struct out.
 */

import { SOBER_PERSONA_ID, blendSober } from './blend.js'
import {
  checkModifier,
  diceD20,
  statModifierItems,
  diceCriticalSuccess,
  diceCriticalFailure,
} from './dice.js'
import { statCreate, statXpApply } from './stats.js'
import { resultOk, resultFail } from './result.js'
import { numberClamp, numberRound, numberSum } from '../utils/number.js'

/** Enumerated error codes for every skills result. The code is the contract. */
export const SKILL_ERROR_CODES = Object.freeze({
  playerMissing: 'PLAYER_MISSING',
  mediumUnknown: 'MEDIUM_UNKNOWN',
  amountInvalid: 'AMOUNT_INVALID',
  dcInvalid: 'DC_INVALID',
})

/** Where a check's modifier item came from. */
export const CHECK_ITEM_SOURCES = Object.freeze({
  skill: 'skill',
  situational: 'situational',
})

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Every persona with weight in the blend, sober included. Weights sum to one.
 * @param {{ player: Object }} input
 * @returns {{ personaId: string, weight: number }[]}
 */
function personaWeights({ player }) {
  const blend = player.blend ?? blendSober()
  const weights = blend.weights
    .filter((w) => w.weight > 0)
    .map((w) => ({ personaId: w.personaId, weight: w.weight }))
  if (blend.soberWeight > 0) {
    weights.push({ personaId: SOBER_PERSONA_ID, weight: blend.soberWeight })
  }
  return weights
}

function cellValueCompute(cell) {
  return cell.base + numberSum({ values: (cell.modifiers ?? []).map((mod) => mod.value) })
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * A cell nobody has trained: the shape of every cell in the grid.
 * @returns {{ base: number, modifiers: Object[], xp: number }}
 */
export function skillCellCreate() {
  return statCreate({ base: 0 })
}

/**
 * The cell for one medium under one persona. A copy; untrained cells are
 * returned fresh rather than written.
 * @param {{ player: Object, mediumId: string, personaId: string }} input
 * @returns {{ base: number, modifiers: Object[], xp: number }}
 */
export function skillCellGet({ player, mediumId, personaId }) {
  const cell = player?.skills?.[mediumId]?.[personaId]
  if (!cell) return skillCellCreate()
  return { base: cell.base, modifiers: (cell.modifiers ?? []).map((m) => ({ ...m })), xp: cell.xp }
}

/**
 * How good the player is at a medium right now: the blend-weighted average
 * of the cells the blend touches. Forty whiskey, forty weed, twenty you
 * reads forty percent of the priest's painting, forty of the telepath's,
 * twenty of your own.
 *
 * @param {{ player: Object, mediumId: string, mediums: Object<string, Object> }} input
 * @returns {{ ok: boolean, data: { value: number, contributions: { personaId: string, weight: number, cellValue: number }[] }|null, error: Object|null }}
 */
export function skillEffective({ player, mediumId, mediums = {} }) {
  if (!player || typeof player !== 'object') {
    return resultFail({
      code: SKILL_ERROR_CODES.playerMissing,
      message: 'skillEffective needs a player',
    })
  }
  if (!mediums[mediumId]) {
    return resultFail({
      code: SKILL_ERROR_CODES.mediumUnknown,
      message: `Unknown medium '${mediumId}'`,
    })
  }
  const contributions = personaWeights({ player }).map(({ personaId, weight }) => ({
    personaId,
    weight,
    cellValue: cellValueCompute(skillCellGet({ player, mediumId, personaId })),
  }))
  const value = numberRound({
    value: numberSum({ values: contributions.map((c) => c.weight * c.cellValue) }),
    places: 2,
  })
  return resultOk({ value, contributions })
}

/**
 * Practice. Experience lands on the cells the blend touches, split by
 * weight, and each cell levels on its own threshold. Returns the medium's
 * new row of cells; does not mutate.
 *
 * @param {{ player: Object, mediumId: string, mediums: Object<string, Object>, amount: number }} input
 * @returns {{ ok: boolean, data: { cells: Object<string, Object>, allocations: { personaId: string, xp: number }[], personaIdsLeveled: string[] }|null, error: Object|null }}
 */
export function skillGain({ player, mediumId, mediums = {}, amount, tuning }) {
  if (!player || typeof player !== 'object') {
    return resultFail({
      code: SKILL_ERROR_CODES.playerMissing,
      message: 'skillGain needs a player',
    })
  }
  if (!mediums[mediumId]) {
    return resultFail({
      code: SKILL_ERROR_CODES.mediumUnknown,
      message: `Unknown medium '${mediumId}'`,
    })
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return resultFail({
      code: SKILL_ERROR_CODES.amountInvalid,
      message: `amount must be > 0, got ${amount}`,
    })
  }

  const cells = {}
  for (const [personaId] of Object.entries(player.skills?.[mediumId] ?? {})) {
    cells[personaId] = skillCellGet({ player, mediumId, personaId })
  }
  const allocations = []
  const personaIdsLeveled = []

  for (const { personaId, weight } of personaWeights({ player })) {
    const xp = numberRound({ value: amount * weight, places: 2 })
    if (xp <= 0) continue
    const before = cells[personaId] ?? skillCellGet({ player, mediumId, personaId })
    const { stat, leveledUp } = statXpApply({ tuning, stat: before, amount: xp })
    cells[personaId] = stat
    allocations.push({ personaId, xp })
    if (leveledUp) personaIdsLeveled.push(personaId)
  }

  return resultOk({ cells, allocations, personaIdsLeveled })
}

/**
 * A check in a medium. The die takes the skill's modifier, the medium's
 * stat's modifier, and any situational modifiers. Every contribution is
 * returned itemized so the story can say what helped and what hurt.
 *
 * @param {{
 *   player: Object,
 *   mediumId: string,
 *   mediums: Object<string, Object>,
 *   dc: number,
 *   modifiers?: { sourceId: string, value: number }[],
 *   rng?: () => number,
 * }} input
 * @returns {{ ok: boolean, data: Object|null, error: Object|null }}
 */
export function skillCheckRoll({
  player,
  mediumId,
  mediums = {},
  dc,
  modifiers = [],
  rng = Math.random,
  tuning,
}) {
  if (!player || typeof player !== 'object') {
    return resultFail({
      code: SKILL_ERROR_CODES.playerMissing,
      message: 'skillCheckRoll needs a player',
    })
  }
  const medium = mediums[mediumId]
  if (!medium) {
    return resultFail({
      code: SKILL_ERROR_CODES.mediumUnknown,
      message: `Unknown medium '${mediumId}'`,
    })
  }
  if (!Number.isFinite(dc)) {
    return resultFail({
      code: SKILL_ERROR_CODES.dcInvalid,
      message: `dc must be a number, got ${dc}`,
    })
  }

  const skill = skillEffective({ player, mediumId, mediums }).data
  const skillModifier = Math.floor(
    numberClamp({ value: skill.value, min: 0, max: 100 }) / tuning.skills.pointsPerModifier
  )
  const statModifier = checkModifier({ player, statName: medium.stat, tuning })
  const situational = numberSum({ values: modifiers.map((m) => m.value) })
  const natural = diceD20({ rng })
  const modifier = skillModifier + statModifier + situational
  const total = natural + modifier

  const modifierItems = [
    ...skill.contributions.map((c) => ({
      source: CHECK_ITEM_SOURCES.skill,
      sourceId: c.personaId,
      value: numberRound({ value: c.weight * c.cellValue, places: 2 }),
    })),
    ...statModifierItems({ player, statName: medium.stat }),
    ...modifiers.map((m) => ({
      source: CHECK_ITEM_SOURCES.situational,
      sourceId: m.sourceId,
      value: m.value,
    })),
  ]

  return resultOk({
    natural,
    modifier,
    total,
    dc,
    success: total >= dc,
    criticalSuccess: diceCriticalSuccess({ natural }),
    criticalFailure: diceCriticalFailure({ natural }),
    mediumId,
    stat: medium.stat,
    skillValue: skill.value,
    skillModifier,
    statModifier,
    modifierItems,
  })
}
