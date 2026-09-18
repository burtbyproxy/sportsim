/**
 * Character model — unified contract for all people in the game.
 * Replaces the former NPC model.
 *
 * All people — bartenders, regulars, passers-by, rivals — use the same
 * contract. The `simulation` field controls engine effort:
 *   "fixed"   — at their post during scheduled hours, no status tracking
 *   "routine" — follows a multi-stop schedule, visible in transit
 *   "full"    — wants, status tracking, decision-making, crosses neighborhoods
 *
 * Pure JS. No Vue dependencies. Serializable to JSON.
 */

import { v4 as uuidv4 } from 'uuid'
import { blendSober, sobrietyDerive } from '../engine/blend.js'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Clamp a number between min and max (inclusive).
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

/**
 * Create a blank Stat object.
 * @param {number} base
 * @returns {Object}
 */
function createStat(base) {
  return { base, modifiers: [], xp: 0 }
}

/**
 * Default stats for a character — all 8 stats at base 10.
 * @returns {Object}
 */
function defaultStats() {
  return {
    stamina: createStat(10),
    toughness: createStat(10),
    wits: createStat(10),
    creativity: createStat(10),
    charm: createStat(10),
    reputation: createStat(10),
    luck: createStat(10),
    karma: createStat(10),
  }
}

/**
 * Default status for a routine/full character.
 * Fixed-tier characters have null status.
 * @returns {Object}
 */
function defaultStatus() {
  return {
    hunger: 50,
    sobriety: sobrietyDerive({ intoxications: {} }),
    energy: 70,
    mood: 50,
    health: 100,
  }
}

// ---------------------------------------------------------------------------
// Valid simulation tiers
// ---------------------------------------------------------------------------

const VALID_SIMULATION_TIERS = ['fixed', 'routine', 'full']

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a Character from raw data (loaded from JSON or constructed in code).
 *
 * @param {Object} data - raw character data
 * @returns {Object} Character per data contract
 */
export function createCharacter(data) {
  const simulation = VALID_SIMULATION_TIERS.includes(data.simulation) ? data.simulation : 'fixed'

  // Status: null for fixed-tier characters unless explicitly provided
  const intoxications = { ...(data.intoxications ?? {}) }
  const habituations = { ...(data.habituations ?? {}) }
  const rawStatus =
    simulation === 'fixed' ? (data.status ?? null) : (data.status ?? defaultStatus())
  // Sobriety is derived from intoxications, never declared.
  const status = rawStatus ? { ...rawStatus, sobriety: sobrietyDerive({ intoxications }) } : null

  // decisionWeights: only meaningful for full-tier characters
  const decisionWeights = simulation === 'full' ? (data.decisionWeights ?? null) : null

  return {
    id: data.id ?? uuidv4(),
    name: data.name,
    description: data.description ?? '',
    descriptionVariants: data.descriptionVariants ? { ...data.descriptionVariants } : {},
    habit: data.habit ?? '',
    voice: data.voice ?? '',
    simulation,
    stats: data.stats ?? defaultStats(),
    status,
    intoxications,
    habituations,
    blend: data.blend ?? blendSober(),
    skills: data.skills ? JSON.parse(JSON.stringify(data.skills)) : {},
    psyche: data.psyche ?? {
      traumas: [],
      obsessions: [],
      insanities: [],
      abilities: [],
    },
    schedule: {
      entries: Array.isArray(data.schedule?.entries)
        ? data.schedule.entries.map((e) => ({ ...e }))
        : [],
    },
    relationshipScore: data.relationshipScore ?? 0,
    currentLocationId: data.currentLocationId ?? null,
    dialogueTreeIds: Array.isArray(data.dialogueTreeIds) ? [...data.dialogueTreeIds] : [],
    want: data.want ?? '',
    fear: data.fear ?? '',
    level: data.level ?? 1,
    decisionWeights,
  }
}

/**
 * Return the locationId where this character should be at a given hour and day.
 * Evaluates schedule entries in order and returns the first matching candidate.
 * Does NOT roll dice — the simulation Worker handles probability checks.
 * Pure — does not mutate character.
 *
 * @param {Object} character - Character per contract
 * @param {number} hour - 0 to 23
 * @param {string} dayOfWeek - e.g. "monday"
 * @returns {{ locationId: string, probability: number } | null}
 */
export function getScheduledLocation(character, hour, dayOfWeek) {
  const entries = character.schedule?.entries ?? []
  for (const entry of entries) {
    const daysMatch = entry.days.includes('all') || entry.days.includes(dayOfWeek)
    const hourInRange = _hourInScheduleRange(hour, entry.startHour, entry.endHour)
    if (daysMatch && hourInRange) {
      return { locationId: entry.locationId, probability: entry.probability }
    }
  }
  return null
}

/**
 * Check whether `hour` falls within [startHour, endHour).
 * Handles overnight windows where endHour < startHour (e.g. 16:00–02:00).
 * startHour is inclusive, endHour is exclusive.
 *
 * @param {number} hour - 0 to 23
 * @param {number} startHour
 * @param {number} endHour
 * @returns {boolean}
 */
function _hourInScheduleRange(hour, startHour, endHour) {
  if (startHour <= endHour) {
    // Normal range: e.g. 11–23
    return hour >= startHour && hour < endHour
  }
  // Overnight range: e.g. 16–2 (crosses midnight)
  return hour >= startHour || hour < endHour
}

/**
 * Return the appropriate description string for the given context.
 * Falls back to the plain `description` field if no context-specific variant exists.
 * Pure — does not mutate character.
 *
 * Context keys checked in priority order:
 *   player status-based: "drunk", "exhausted", "starving"
 *   time-based: timeOfDay string (e.g. "night", "morning")
 *   visit-based: "repeat" (visitCount > 1)
 *   fallback: character.description
 *
 * @param {Object} character - Character per contract
 * @param {Object} [context={}]
 * @param {string} [context.timeOfDay]
 * @param {Object} [context.playerStatus]
 * @param {number} [context.visitCount]
 * @returns {string}
 */
export function getCharacterDescription(character, context = {}) {
  const variants = character.descriptionVariants ?? {}
  const { timeOfDay, playerStatus, visitCount } = context

  // Status-based variants — highest priority
  if (playerStatus) {
    if (playerStatus.sobriety !== undefined && playerStatus.sobriety < 30) {
      if (variants.drunk) return variants.drunk
    }
    if (playerStatus.energy !== undefined && playerStatus.energy < 20) {
      if (variants.exhausted) return variants.exhausted
    }
    if (playerStatus.hunger !== undefined && playerStatus.hunger < 20) {
      if (variants.starving) return variants.starving
    }
  }

  // Time-based variants
  if (timeOfDay && variants[timeOfDay]) {
    return variants[timeOfDay]
  }

  // Repeat visit
  if (visitCount !== undefined && visitCount > 1 && variants.repeat) {
    return variants.repeat
  }

  // Fallback to plain description
  return character.description ?? ''
}

/**
 * Adjust the character's relationship score with the player.
 * Clamped to -100 to 100.
 * Mutates character in place.
 *
 * @param {Object} character - Character per contract
 * @param {number} delta
 * @returns {void}
 */
export function adjustRelationship(character, delta) {
  character.relationshipScore = clamp((character.relationshipScore ?? 0) + delta, -100, 100)
}
