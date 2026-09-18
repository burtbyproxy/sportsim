/**
 * Location model — pure JS, no Vue dependencies.
 * Serializable to JSON.
 */

import { meetsRequirements } from '../engine/actions.js'

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a Location from raw JSON data.
 *
 * @param {Object} data - raw location data
 * @returns {import('./types').Location}
 */
export function createLocation(data) {
  return {
    id: data.id,
    type: data.type,
    variant: data.variant ?? null,
    display: data.display,
    descriptions: data.descriptions ?? { default: '' },
    exits: Array.isArray(data.exits) ? data.exits.map((e) => ({ ...e })) : [],
    npcSlots: Array.isArray(data.npcSlots) ? [...data.npcSlots] : [],
    actionIds: Array.isArray(data.actionIds) ? [...data.actionIds] : [],
    discovered: data.discovered ?? false,
    availability: data.availability
      ? { ...data.availability }
      : { openHour: 0, closeHour: 23, closedMessage: null },
    visitCount: data.visitCount ?? 0,
    // Which loot table looking around here draws from; null means there is nothing to find.
    scavengeTableId: data.scavengeTableId ?? null,
    // How picked-over the place is, and when it was last worked. See engine/scavenge.js.
    scavenge: data.scavenge ? { ...data.scavenge } : { depletion: 0, updatedAtTick: 0 },
    // What the place itself offers to work on: a wall, a table, a corner to stand in.
    surfaces: Array.isArray(data.surfaces)
      ? data.surfaces.map((s) => ({ ...s, mediumIds: [...(s.mediumIds ?? [])] }))
      : [],
    // Everything the player ever left here, fresh or gone over. See engine/making.js.
    marks: Array.isArray(data.marks) ? data.marks.map((m) => ({ ...m })) : [],
  }
}

/**
 * A location as a save remembers it, rebuilt on today's definition. What a
 * place IS comes from content; what HAPPENED there comes from the save. A
 * save from before the place learned something new picks it up on load.
 *
 * @param {{ definition: Object, saved: Object|null }} input
 * @returns {import('./types').Location}
 */
export function locationRestore({ definition, saved }) {
  if (!saved) return createLocation(definition)
  return createLocation({
    ...definition,
    discovered: saved.discovered ?? definition.discovered,
    visitCount: saved.visitCount,
    scavenge: saved.scavenge,
    marks: saved.marks,
  })
}

/**
 * Check whether a location is open at a given hour (0-23).
 * Pure — does not mutate location.
 *
 * Handles overnight windows (e.g. openHour=20, closeHour=2).
 *
 * @param {import('./types').Location} location
 * @param {number} hour - 0 to 23
 * @returns {boolean}
 */
/**
 * Check whether the player meets an exit's requirements.
 * Exits share the requirement vocabulary of actions, so the same rules apply.
 * @param {{ exit: Object, player: Object, gameTime: Object }} input
 * @returns {{ meets: boolean, reason: string|null }}
 */
export function exitMeetsRequirements({ exit, player, gameTime }) {
  if (!exit.requirements) return { meets: true, reason: null }
  return meetsRequirements(player, { requirements: exit.requirements }, gameTime)
}

export function isOpen(location, hour) {
  const { openHour, closeHour } = location.availability
  if (openHour === 0 && closeHour === 23) return true // always open
  if (openHour <= closeHour) {
    return hour >= openHour && hour <= closeHour
  }
  // Overnight: e.g. 20:00 to 02:00
  return hour >= openHour || hour <= closeHour
}

/**
 * Increment the visit count for a location.
 * Mutates location in place.
 *
 * @param {import('./types').Location} location
 * @returns {void}
 */
export function incrementVisitCount(location) {
  location.visitCount = (location.visitCount ?? 0) + 1
}
