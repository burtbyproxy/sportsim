/**
 * Location model — pure JS, no Vue dependencies.
 * Serializable to JSON.
 */

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
    exits: Array.isArray(data.exits) ? data.exits.map(e => ({ ...e })) : [],
    npcSlots: Array.isArray(data.npcSlots) ? [...data.npcSlots] : [],
    actionIds: Array.isArray(data.actionIds) ? [...data.actionIds] : [],
    discovered: data.discovered ?? false,
    availability: data.availability
      ? { ...data.availability }
      : { openHour: 0, closeHour: 23, closedMessage: null },
    visitCount: data.visitCount ?? 0,
  };
}

/**
 * Return the appropriate description string for the given context.
 * Falls back to "default" if no specific variant matches.
 * Pure — does not mutate location.
 *
 * Context keys checked in priority order:
 *   player status-based: "drunk", "exhausted", "starving"
 *   time-based: "night", "morning", "afternoon", "evening"
 *   visit-based: "repeat" (visitCount > 1)
 *   fallback: "default"
 *
 * @param {import('./types').Location} location
 * @param {{ timeOfDay?: string, playerStatus?: Object, visitCount?: number }} context
 * @returns {string}
 */
export function getDescription(location, context = {}) {
  const descs = location.descriptions ?? {};
  const { timeOfDay, playerStatus, visitCount } = context;

  // Status-based variants take highest priority
  if (playerStatus) {
    if (playerStatus.sobriety !== undefined && playerStatus.sobriety < 30) {
      if (descs.drunk) return descs.drunk;
    }
    if (playerStatus.energy !== undefined && playerStatus.energy < 20) {
      if (descs.exhausted) return descs.exhausted;
    }
    if (playerStatus.hunger !== undefined && playerStatus.hunger < 20) {
      if (descs.starving) return descs.starving;
    }
  }

  // Time-based variants
  if (timeOfDay && descs[timeOfDay]) {
    return descs[timeOfDay];
  }

  // Repeat visit
  if (visitCount !== undefined && visitCount > 1 && descs.repeat) {
    return descs.repeat;
  }

  return descs.default ?? '';
}

/**
 * Return the available exits for a location.
 * Pure — does not mutate location.
 *
 * @param {import('./types').Location} location
 * @returns {import('./types').Exit[]}
 */
export function getAvailableExits(location) {
  return location.exits ?? [];
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
export function isOpen(location, hour) {
  const { openHour, closeHour } = location.availability;
  if (openHour === 0 && closeHour === 23) return true; // always open
  if (openHour <= closeHour) {
    return hour >= openHour && hour <= closeHour;
  }
  // Overnight: e.g. 20:00 to 02:00
  return hour >= openHour || hour <= closeHour;
}

/**
 * Increment the visit count for a location.
 * Mutates location in place.
 *
 * @param {import('./types').Location} location
 * @returns {void}
 */
export function incrementVisitCount(location) {
  location.visitCount = (location.visitCount ?? 0) + 1;
}
