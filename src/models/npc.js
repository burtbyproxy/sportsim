/**
 * NPC model — pure JS, no Vue dependencies.
 * Serializable to JSON.
 */

import { v4 as uuidv4 } from 'uuid';

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
  return Math.max(min, Math.min(max, value));
}

/**
 * Create a blank Stat object for an NPC.
 * @param {number} base
 * @returns {import('./types').Stat}
 */
function createStat(base) {
  return { base, modifiers: [], xp: 0 };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create an NPC from raw JSON data.
 *
 * @param {Object} data - raw NPC data
 * @returns {import('./types').NPC}
 */
export function createNPC(data) {
  return {
    id: data.id ?? uuidv4(),
    name: data.name,
    description: data.description ?? '',
    habit: data.habit ?? '',
    voice: data.voice ?? '',
    stats: data.stats ?? {
      stamina:    createStat(10),
      toughness:  createStat(10),
      wits:       createStat(10),
      creativity: createStat(10),
      charm:      createStat(10),
      reputation: createStat(10),
      luck:       createStat(10),
      karma:      createStat(10),
    },
    status: data.status ?? {
      hunger:   50,
      sobriety: 80,
      energy:   70,
      mood:     50,
      health:   100,
    },
    psyche: data.psyche ?? {
      traumas:    [],
      obsessions: [],
      insanities: [],
      abilities:  [],
    },
    schedule: data.schedule ?? { entries: [] },
    relationshipScore: data.relationshipScore ?? 0,
    currentLocationId: data.currentLocationId ?? null,
    dialogueTreeIds: Array.isArray(data.dialogueTreeIds) ? [...data.dialogueTreeIds] : [],
    want: data.want ?? '',
    fear: data.fear ?? '',
    level: data.level ?? 1,
  };
}

/**
 * Return the locationId where this NPC should be at a given hour and day.
 * Evaluates schedule entries in order and returns the first matching candidate.
 * Does NOT roll dice — the simulation Worker handles probability checks.
 * Pure — does not mutate NPC.
 *
 * @param {import('./types').NPC} npc
 * @param {number} hour - 0 to 23
 * @param {string} dayOfWeek - e.g. "monday"
 * @returns {{ locationId: string, probability: number } | null}
 */
export function getScheduledLocation(npc, hour, dayOfWeek) {
  const entries = npc.schedule?.entries ?? [];
  for (const entry of entries) {
    const daysMatch = entry.days.includes('all') || entry.days.includes(dayOfWeek);
    const hourInRange = hour >= entry.startHour && hour < entry.endHour;
    if (daysMatch && hourInRange) {
      return { locationId: entry.locationId, probability: entry.probability };
    }
  }
  return null;
}

/**
 * Adjust the NPC's relationship score with the player.
 * Clamped to -100 to 100.
 * Mutates NPC in place.
 *
 * @param {import('./types').NPC} npc
 * @param {number} delta
 * @returns {void}
 */
export function adjustRelationship(npc, delta) {
  npc.relationshipScore = clamp((npc.relationshipScore ?? 0) + delta, -100, 100);
}
