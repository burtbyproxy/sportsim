/**
 * Location model — pure JS, no Vue dependencies.
 * Serializable to JSON.
 */

import { requirementsMeet } from '../engine/actions.js'

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a Location from raw JSON data.
 *
 * @param {Object} data - raw location data
 * @returns {import('./types').Location}
 */
export function locationCreate(data) {
  return {
    id: data.id,
    type: data.type,
    display: data.display,
    // How the place reads inside a piece made on nothing but the spot: "outside the Denver Ave 7-11".
    pieceAs: data.pieceAs ?? null,
    // Whether being here is being out on the street, where the street's events can find you.
    outdoors: data.outdoors ?? false,
    descriptions: data.descriptions ?? { default: '' },
    exits: Array.isArray(data.exits) ? data.exits.map((e) => ({ ...e })) : [],
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
  if (!saved) return locationCreate(definition)
  return locationCreate({
    ...definition,
    discovered: saved.discovered ?? definition.discovered,
    visitCount: saved.visitCount,
    scavenge: saved.scavenge,
    marks: saved.marks,
  })
}

/**
 * Check whether the player meets an exit's requirements.
 * Exits share the requirement vocabulary of actions, so the same rules apply:
 * minVisits counts visits to the place the exit leads out of.
 * @param {{ exit: Object, player: Object, gameTime: Object, location: Object }} input
 *   location — where the player is standing.
 * @returns {{ meets: boolean, reasonCode: string|null, reasonParams: Object<string, string> }}
 */
export function exitRequirementsMeet({ exit, player, gameTime, location }) {
  if (!exit.requirements) return { meets: true, reasonCode: null, reasonParams: {} }
  return requirementsMeet({
    player,
    action: { requirements: exit.requirements },
    gameTime,
    location,
  })
}

/**
 * Check whether a location is open at a given hour (0-23).
 * Pure — does not mutate location.
 *
 * Handles overnight windows (e.g. openHour=20, closeHour=2).
 *
 * @param {{ location: import('./types').Location, hour: number }} input
 *   hour — 0 to 23
 * @returns {boolean}
 */
export function locationOpen({ location, hour }) {
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
 * @param {{ location: import('./types').Location }} input
 * @returns {void}
 */
export function locationVisitAdd({ location }) {
  location.visitCount = (location.visitCount ?? 0) + 1
}
