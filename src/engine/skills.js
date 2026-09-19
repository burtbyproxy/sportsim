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
import { statXpApply } from './stats.js'
import { resultOk, resultFail } from './result.js'
import { numberClamp, numberRound } from '../utils/number.js'

/** Enumerated error codes for every skills result. The code is the contract. */
export const SKILL_ERROR_CODES = Object.freeze({
  PLAYER_MISSING: 'PLAYER_MISSING',
  MEDIUM_UNKNOWN: 'MEDIUM_UNKNOWN',
  AMOUNT_INVALID: 'AMOUNT_INVALID',
  DC_INVALID: 'DC_INVALID',
})

/** Where a check's modifier item came from. */
export const CHECK_ITEM_SOURCES = Object.freeze({
  SKILL: 'skill',
  SITUATIONAL: 'situational',
})

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Every persona with weight in the blend, sober included. Weights sum to one.
 * @param {{ player: Object }} input
 * @returns {{ personaId: string, weight: number }[]}
 */
function _personaWeights({ player }) {
  const blend = player.blend ?? blendSober()
  const weights = blend.weights
    .filter((w) => w.weight > 0)
    .map((w) => ({ personaId: w.personaId, weight: w.weight }))
  if (blend.soberWeight > 0) {
    weights.push({ personaId: SOBER_PERSONA_ID, weight: blend.soberWeight })
  }
  return weights
}

function _cellValue(cell) {
  return (cell.modifiers ?? []).reduce((sum, mod) => sum + mod.value, cell.base)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * A cell nobody has trained: the shape of every cell in the grid.
 * @returns {{ base: number, modifiers: Object[], xp: number }}
 */
export function skillCellCreate() {
  return { base: 0, modifiers: [], xp: 0 }
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
      code: SKILL_ERROR_CODES.PLAYER_MISSING,
      message: 'skillEffective needs a player',
    })
  }
  if (!mediums[mediumId]) {
    return resultFail({
      code: SKILL_ERROR_CODES.MEDIUM_UNKNOWN,
      message: `Unknown medium '${mediumId}'`,
    })
  }
  const contributions = _personaWeights({ player }).map(({ personaId, weight }) => ({
    personaId,
    weight,
    cellValue: _cellValue(skillCellGet({ player, mediumId, personaId })),
  }))
  const value = numberRound({
    value: contributions.reduce((sum, c) => sum + c.weight * c.cellValue, 0),
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
export function skillGain({ player, mediumId, mediums = {}, amount }) {
  if (!player || typeof player !== 'object') {
    return resultFail({
      code: SKILL_ERROR_CODES.PLAYER_MISSING,
      message: 'skillGain needs a player',
    })
  }
  if (!mediums[mediumId]) {
    return resultFail({
      code: SKILL_ERROR_CODES.MEDIUM_UNKNOWN,
      message: `Unknown medium '${mediumId}'`,
    })
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return resultFail({
      code: SKILL_ERROR_CODES.AMOUNT_INVALID,
      message: `amount must be > 0, got ${amount}`,
    })
  }

  const cells = {}
  for (const [personaId] of Object.entries(player.skills?.[mediumId] ?? {})) {
    cells[personaId] = skillCellGet({ player, mediumId, personaId })
  }
  const allocations = []
  const personaIdsLeveled = []

  for (const { personaId, weight } of _personaWeights({ player })) {
    const xp = numberRound({ value: amount * weight, places: 2 })
    if (xp <= 0) continue
    const before = cells[personaId] ?? skillCellGet({ player, mediumId, personaId })
    const { stat, leveledUp } = statXpApply({ stat: before, amount: xp })
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
}) {
  if (!player || typeof player !== 'object') {
    return resultFail({
      code: SKILL_ERROR_CODES.PLAYER_MISSING,
      message: 'skillCheckRoll needs a player',
    })
  }
  const medium = mediums[mediumId]
  if (!medium) {
    return resultFail({
      code: SKILL_ERROR_CODES.MEDIUM_UNKNOWN,
      message: `Unknown medium '${mediumId}'`,
    })
  }
  if (!Number.isFinite(dc)) {
    return resultFail({
      code: SKILL_ERROR_CODES.DC_INVALID,
      message: `dc must be a number, got ${dc}`,
    })
  }

  const skill = skillEffective({ player, mediumId, mediums }).data
  const skillModifier = Math.floor(numberClamp({ value: skill.value, min: 0, max: 100 }) / 10)
  const statModifier = checkModifier({ player, statName: medium.stat })
  const situational = modifiers.reduce((sum, m) => sum + m.value, 0)
  const natural = diceD20({ rng })
  const modifier = skillModifier + statModifier + situational
  const total = natural + modifier

  const modifierItems = [
    ...skill.contributions.map((c) => ({
      source: CHECK_ITEM_SOURCES.SKILL,
      sourceId: c.personaId,
      value: numberRound({ value: c.weight * c.cellValue, places: 2 }),
    })),
    ...statModifierItems({ player, statName: medium.stat }),
    ...modifiers.map((m) => ({
      source: CHECK_ITEM_SOURCES.SITUATIONAL,
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
