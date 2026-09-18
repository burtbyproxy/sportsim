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
    inspirations: data.inspirations ? JSON.parse(JSON.stringify(data.inspirations)) : [],
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
