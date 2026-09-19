/**
 * Blend Engine — the one door through which every substance and every
 * condition reaches the rest of the game.
 *
 * A player carries per-substance intoxications and habituations. Substances
 * and conditions are content (content/substances, content/conditions), each
 * with a persona and a set of stat modifiers. The blend is the weighted mix
 * of every persona currently acting on the player, with "sober" taking
 * whatever weight is left over. Nothing outside this module knows what
 * whiskey is; everything asks for the blend.
 *
 * Pure functions. No side effects. No Vue. No DOM. Every public function
 * takes a single input struct and returns a result struct (ok/data/error).
 */

import { randomInt } from '../utils/random.js'
import { resultOk, resultFail } from './result.js'
import { numberClamp, numberRound, numberSum } from '../utils/number.js'
import { listSortBy } from '../utils/list.js'

/** Enumerated error codes for every blend result. The code is the contract. */
export const BLEND_ERROR_CODES = Object.freeze({
  playerMissing: 'PLAYER_MISSING',
  substanceUnknown: 'SUBSTANCE_UNKNOWN',
  doseInvalid: 'DOSE_INVALID',
  ticksInvalid: 'TICKS_INVALID',
})

/** Persona id of the player's own self — the weight nothing else has taken. */
export const SOBER_PERSONA_ID = 'sober'

/** Where a persona's weight came from. */
export const PERSONA_SOURCES = Object.freeze({
  substance: 'substance',
  withdrawal: 'withdrawal',
  condition: 'condition',
})

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * The first intoxication or habituation key that names no known substance.
 * @param {{ player: Object, substances: Object<string, Object> }} input
 * @returns {string|null}
 */
function unknownSubstanceId({ player, substances }) {
  const keys = [
    ...Object.keys(player.intoxications ?? {}),
    ...Object.keys(player.habituations ?? {}),
  ]
  return keys.find((id) => !substances[id]) ?? null
}

/**
 * The highest band the intoxication level has reached, or null below the
 * first band. Bands are declared with `atLeast` thresholds; the highest
 * matching band applies alone.
 * @param {{ substance: Object, intoxication: number }} input
 * @returns {Object|null}
 */
function bandActive({ substance, intoxication }) {
  let active = null
  for (const band of substance.bands ?? []) {
    if (intoxication >= band.atLeast && (active === null || band.atLeast > active.atLeast)) {
      active = band
    }
  }
  return active
}

/**
 * Whether a substance's withdrawal is acting on the player: habituated
 * enough, and low enough on the substance itself.
 * @param {{ substance: Object, intoxication: number, habituation: number }} input
 * @returns {boolean}
 */
function withdrawalActive({ substance, intoxication, habituation }) {
  const withdrawal = substance.withdrawal
  if (!withdrawal) return false
  return habituation >= withdrawal.habituationAtLeast && intoxication < withdrawal.intoxicationBelow
}

/**
 * Whether a status-driven condition is acting on the player.
 * @param {{ condition: Object, status: Object }} input
 * @returns {boolean}
 */
function conditionActive({ condition, status }) {
  const source = condition.source
  const value = status?.[source.status]
  if (value === undefined || value === null) return false
  if (source.below !== undefined && source.below !== null) return value < source.below
  if (source.above !== undefined && source.above !== null) return value > source.above
  return false
}

/**
 * Add a persona's modifiers to the running totals and the itemized list.
 * @param {{ totals: Object<string, number>, sources: Object[], modifiers: Object[], personaId: string, source: string, sourceId: string }} input
 */
function modifiersAdd({ totals, sources, modifiers, personaId, source, sourceId }) {
  for (const mod of modifiers ?? []) {
    totals[mod.stat] = (totals[mod.stat] ?? 0) + mod.value
    sources.push({ personaId, source, sourceId, stat: mod.stat, value: mod.value })
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * The blend of a player nothing is acting on. Also the shape of every blend.
 * @returns {{
 *   weights: { personaId: string, weight: number, source: string, sourceId: string }[],
 *   dominantPersonaId: string,
 *   soberWeight: number,
 *   modifiers: Object<string, number>,
 *   modifierSources: { personaId: string, source: string, sourceId: string, stat: string, value: number }[],
 *   families: Object<string, number>,
 * }}
 */
export function blendSober() {
  return {
    weights: [],
    dominantPersonaId: SOBER_PERSONA_ID,
    soberWeight: 1,
    modifiers: {},
    modifierSources: [],
    families: {},
  }
}

/**
 * Sobriety is derived: one hundred minus everything in the bloodstream.
 * @param {{ intoxications: Object<string, number> }} input
 * @returns {number} 0–100
 */
export function sobrietyDerive({ intoxications }) {
  const total = numberSum({ values: Object.values(intoxications ?? {}) })
  return numberRound({ value: numberClamp({ value: 100 - total, min: 0, max: 100 }), places: 2 })
}

/**
 * Compute the blend acting on a player right now.
 *
 * Each substance contributes its intoxication over one hundred as the
 * weight of its persona. A habituated player short of a substance carries
 * that substance's withdrawal persona at the habituation's weight. Each
 * active condition contributes its declared weight. Sober takes whatever
 * remains; when the total passes one, everything is normalised and sober is
 * zero. Modifiers are the sum of the highest active band per substance, the
 * active withdrawals, and the active conditions.
 *
 * @param {{
 *   player: Object,
 *   substances: Object<string, Object>,
 *   conditions: Object<string, Object>,
 * }} input
 * @returns {{ ok: boolean, data: ReturnType<typeof blendSober>|null, error: {code: string, message: string}|null }}
 */
export function blendCompute({ player, substances = {}, conditions = {} }) {
  if (!player || typeof player !== 'object') {
    return resultFail({
      code: BLEND_ERROR_CODES.playerMissing,
      message: 'blendCompute needs a player',
    })
  }
  const unknown = unknownSubstanceId({ player, substances })
  if (unknown !== null) {
    return resultFail({
      code: BLEND_ERROR_CODES.substanceUnknown,
      message: `Unknown substance '${unknown}'`,
    })
  }

  const intoxications = player.intoxications ?? {}
  const habituations = player.habituations ?? {}
  const modifiers = {}
  const modifierSources = []
  const raw = []

  for (const substance of Object.values(substances)) {
    const intoxication = intoxications[substance.id] ?? 0
    const habituation = habituations[substance.id] ?? 0

    if (intoxication > 0) {
      raw.push({
        personaId: substance.persona.id,
        weight: intoxication / 100,
        source: PERSONA_SOURCES.substance,
        sourceId: substance.id,
        family: substance.family,
      })
      const band = bandActive({ substance, intoxication })
      if (band) {
        modifiersAdd({
          totals: modifiers,
          sources: modifierSources,
          modifiers: band.modifiers,
          personaId: substance.persona.id,
          source: PERSONA_SOURCES.substance,
          sourceId: substance.id,
        })
      }
    }

    if (withdrawalActive({ substance, intoxication, habituation })) {
      raw.push({
        personaId: substance.withdrawal.persona.id,
        weight: habituation / 100,
        source: PERSONA_SOURCES.withdrawal,
        sourceId: substance.id,
        family: null,
      })
      modifiersAdd({
        totals: modifiers,
        sources: modifierSources,
        modifiers: substance.withdrawal.modifiers,
        personaId: substance.withdrawal.persona.id,
        source: PERSONA_SOURCES.withdrawal,
        sourceId: substance.id,
      })
    }
  }

  for (const condition of Object.values(conditions)) {
    if (!conditionActive({ condition, status: player.status })) continue
    raw.push({
      personaId: condition.persona.id,
      weight: condition.weight,
      source: PERSONA_SOURCES.condition,
      sourceId: condition.id,
      family: null,
    })
    modifiersAdd({
      totals: modifiers,
      sources: modifierSources,
      modifiers: condition.modifiers,
      personaId: condition.persona.id,
      source: PERSONA_SOURCES.condition,
      sourceId: condition.id,
    })
  }

  const total = numberSum({ values: raw.map((entry) => entry.weight) })
  const scale = total > 1 ? 1 / total : 1
  const soberWeight = numberRound({ value: Math.max(0, 1 - total), places: 2 })

  const families = {}
  const unsorted = raw.map((entry) => {
    const weight = numberRound({ value: entry.weight * scale, places: 2 })
    if (entry.family)
      families[entry.family] = numberRound({
        value: (families[entry.family] ?? 0) + weight,
        places: 2,
      })
    return {
      personaId: entry.personaId,
      weight,
      source: entry.source,
      sourceId: entry.sourceId,
    }
  })
  const weights = listSortBy({ items: unsorted, keyOf: (w) => w.weight, descending: true })

  const heaviest = weights[0]
  const dominantPersonaId =
    heaviest && heaviest.weight > soberWeight ? heaviest.personaId : SOBER_PERSONA_ID

  return resultOk({ weights, dominantPersonaId, soberWeight, modifiers, modifierSources, families })
}

/**
 * How much of each substance wears off, and how much habituation fades,
 * over a number of ticks. Returns deltas; does not mutate.
 *
 * @param {{ player: Object, substances: Object<string, Object>, ticksElapsed: number }} input
 * @returns {{ ok: boolean, data: { intoxicationChanges: Object<string, number>, habituationChanges: Object<string, number> }|null, error: Object|null }}
 */
export function blendDecay({ player, substances = {}, ticksElapsed }) {
  if (!player || typeof player !== 'object') {
    return resultFail({
      code: BLEND_ERROR_CODES.playerMissing,
      message: 'blendDecay needs a player',
    })
  }
  if (!Number.isFinite(ticksElapsed) || ticksElapsed < 0) {
    return resultFail({
      code: BLEND_ERROR_CODES.ticksInvalid,
      message: `ticksElapsed must be >= 0, got ${ticksElapsed}`,
    })
  }
  const unknown = unknownSubstanceId({ player, substances })
  if (unknown !== null) {
    return resultFail({
      code: BLEND_ERROR_CODES.substanceUnknown,
      message: `Unknown substance '${unknown}'`,
    })
  }

  const intoxicationChanges = {}
  const habituationChanges = {}

  for (const [id, level] of Object.entries(player.intoxications ?? {})) {
    const delta = -Math.min(level, substances[id].decayPerTick * ticksElapsed)
    if (delta !== 0) intoxicationChanges[id] = numberRound({ value: delta, places: 2 })
  }
  for (const [id, level] of Object.entries(player.habituations ?? {})) {
    const delta = -Math.min(level, substances[id].habituationDecayPerTick * ticksElapsed)
    if (delta !== 0) habituationChanges[id] = numberRound({ value: delta, places: 2 })
  }

  return resultOk({ intoxicationChanges, habituationChanges })
}

/**
 * Resolve a list of doses against a player. A dose names a substance, a
 * value, and a chance it is actually in there — the player is never told
 * which doses were hidden. Returns deltas; does not mutate.
 *
 * @param {{
 *   player: Object,
 *   substances: Object<string, Object>,
 *   doses: { substanceId: string, value: number, chance?: number }[],
 *   rng?: () => number,
 * }} input
 * @returns {{ ok: boolean, data: { intoxicationChanges: Object<string, number>, habituationChanges: Object<string, number>, substanceIdsTaken: string[] }|null, error: Object|null }}
 */
export function dosesApply({ player, substances = {}, doses = [], rng = Math.random }) {
  if (!player || typeof player !== 'object') {
    return resultFail({
      code: BLEND_ERROR_CODES.playerMissing,
      message: 'dosesApply needs a player',
    })
  }

  const intoxicationChanges = {}
  const habituationChanges = {}
  const substanceIdsTaken = []
  const intoxications = { ...(player.intoxications ?? {}) }
  const habituations = { ...(player.habituations ?? {}) }

  for (const dose of doses) {
    const substance = substances[dose?.substanceId]
    if (!substance) {
      return resultFail({
        code: BLEND_ERROR_CODES.substanceUnknown,
        message: `Unknown substance '${dose?.substanceId}'`,
      })
    }
    if (!Number.isFinite(dose.value) || dose.value <= 0) {
      return resultFail({
        code: BLEND_ERROR_CODES.doseInvalid,
        message: `Dose of '${substance.id}' must be > 0`,
      })
    }
    const chance = dose.chance ?? 1
    if (!Number.isFinite(chance) || chance < 0 || chance > 1) {
      return resultFail({
        code: BLEND_ERROR_CODES.doseInvalid,
        message: `Dose chance of '${substance.id}' must be 0–1`,
      })
    }
    if (chance < 1 && randomInt({ min: 1, max: 100, rng }) > chance * 100) continue

    const id = substance.id
    const intoxDelta = numberRound({
      value: Math.min(dose.value, 100 - (intoxications[id] ?? 0)),
      places: 2,
    })
    intoxications[id] = (intoxications[id] ?? 0) + intoxDelta
    if (intoxDelta !== 0)
      intoxicationChanges[id] = numberRound({
        value: (intoxicationChanges[id] ?? 0) + intoxDelta,
        places: 2,
      })

    const habitDelta = numberRound({
      value: Math.min(dose.value * substance.habituationRate, 100 - (habituations[id] ?? 0)),
      places: 2,
    })
    habituations[id] = (habituations[id] ?? 0) + habitDelta
    if (habitDelta !== 0)
      habituationChanges[id] = numberRound({
        value: (habituationChanges[id] ?? 0) + habitDelta,
        places: 2,
      })

    substanceIdsTaken.push(id)
  }

  return resultOk({ intoxicationChanges, habituationChanges, substanceIdsTaken })
}
