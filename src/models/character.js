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
import { STAT_IDS_DEFAULT, SIMULATION_TIERS_DEFAULT } from './defaults.js'
import { statCreate } from '../engine/stats.js'
import { MARK_STATUSES } from '../engine/psyche.js'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Default stats for a character — every stat at base 10.
 * @returns {Object}
 */
function defaultStats() {
  return Object.fromEntries(STAT_IDS_DEFAULT.map((statId) => [statId, statCreate({ base: 10 })]))
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
    confusion: 0,
    energy: 70,
    mood: 50,
    health: 100,
  }
}

// ---------------------------------------------------------------------------
// Valid simulation tiers
// ---------------------------------------------------------------------------

const VALID_SIMULATION_TIERS = SIMULATION_TIERS_DEFAULT

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a Character from raw data (loaded from JSON or constructed in code).
 *
 * @param {Object} data - raw character data
 * @returns {Object} Character per data contract
 */
export function characterCreate(data) {
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
    habit: data.habit ?? '',
    voice: data.voice ?? '',
    simulation,
    stats: data.stats ?? defaultStats(),
    status,
    intoxications,
    habituations,
    dazed: data.dazed ?? 0,
    blend: data.blend ?? blendSober(),
    skills: data.skills ? JSON.parse(JSON.stringify(data.skills)) : {},
    inspirations: data.inspirations ? JSON.parse(JSON.stringify(data.inspirations)) : [],
    // The same psyche as the player's. Content writes a mark as { markId,
    // target }: something that happened to them before the game began.
    psyche: {
      marks: (data.psyche?.marks ?? []).map((mark) => ({
        id: mark.id ?? `${data.id}:${mark.markId}:${mark.target?.id ?? 'none'}`,
        markId: mark.markId,
        target: mark.target ? { ...mark.target } : null,
        source: mark.source ? { ...mark.source } : { kind: 'character', id: data.id },
        status: mark.status ?? MARK_STATUSES.active,
        fitTicksRemaining: mark.fitTicksRemaining ?? 0,
        acquiredAtTick: mark.acquiredAtTick ?? 0,
        updatedAtTick: mark.updatedAtTick ?? 0,
      })),
      abilities: (data.psyche?.abilities ?? []).map((ability) => ({ ...ability })),
      grooves: { ...(data.psyche?.grooves ?? {}) },
    },
    schedule: {
      entries: Array.isArray(data.schedule?.entries)
        ? data.schedule.entries.map((e) => ({ ...e }))
        : [],
    },
    relationshipScore: data.relationshipScore ?? 0,
    currentLocationId: data.currentLocationId ?? null,
    want: data.want ?? '',
    fear: data.fear ?? '',
    decisionWeights,
  }
}
