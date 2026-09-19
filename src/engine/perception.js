/**
 * Perception Engine — what the player takes the world to be.
 *
 * The world is what content and the run say it is. The player sees less:
 * a place they do not know shows only its looks, and its own business stays
 * off the menu until they find out what it is. This module decides, by id,
 * what the player perceives; the store turns ids into words, the loop acts
 * against reality.
 *
 * Pure functions. No side effects. No Vue. No DOM. Every public function
 * takes a single input struct; the ones that can fail return a result
 * struct (ok/data/error).
 */

import { resultOk, resultFail } from './result.js'

/** Enumerated error codes for every perception result. The code is the contract. */
export const PERCEPTION_ERROR_CODES = Object.freeze({
  playerMissing: 'PLAYER_MISSING',
  locationUnknown: 'LOCATION_UNKNOWN',
})

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Whether the player knows what a place is.
 * @param {{ player: Object, locationId: string }} input
 * @returns {boolean}
 */
export function locationKnown({ player, locationId }) {
  return (player?.knownLocationIds ?? []).includes(locationId)
}

/**
 * The player's knowledge with one more place in it. Knowing a place twice
 * changes nothing. Does not mutate.
 * @param {{ player: Object, locations: Object<string, Object>, locationId: string }} input
 * @returns {{ ok: boolean, data: { knownLocationIds: string[], learned: boolean }|null, error: Object|null }}
 *   learned — whether the place was news
 */
export function locationLearn({ player, locations, locationId }) {
  if (!player) {
    return resultFail({
      code: PERCEPTION_ERROR_CODES.playerMissing,
      message: 'locationLearn needs a player',
    })
  }
  if (!locations[locationId]) {
    return resultFail({
      code: PERCEPTION_ERROR_CODES.locationUnknown,
      message: `No location '${locationId}' to know`,
      params: { locationId },
    })
  }
  const known = player.knownLocationIds ?? []
  if (known.includes(locationId)) return resultOk({ knownLocationIds: [...known], learned: false })
  return resultOk({ knownLocationIds: [...known, locationId], learned: true })
}

/**
 * The scene as the player perceives it: the place they take themselves to
 * be in, whose business the menu offers, who they take the people here to
 * be, and where they take each way out to lead. Each carries whether the
 * player knows the place it names.
 *
 * @param {{ player: Object, location: Object, locations: Object<string, Object>, characters: Object[] }} input
 *   location — where the player really is; characters — who is really there
 * @returns {{ ok: boolean, data: {
 *   place: { locationId: string, known: boolean },
 *   menu: { locationId: string, known: boolean },
 *   people: Array<{ characterId: string, realId: string }>,
 *   exits: Array<{ locationId: string, perceivedLocationId: string, known: boolean }>,
 * }|null, error: Object|null }}
 */
export function perceptionView({ player, location, locations, characters }) {
  if (!player) {
    return resultFail({
      code: PERCEPTION_ERROR_CODES.playerMissing,
      message: 'perceptionView needs a player',
    })
  }
  if (!location || !locations[location.id]) {
    return resultFail({
      code: PERCEPTION_ERROR_CODES.locationUnknown,
      message: `No location '${location?.id}' to perceive`,
      params: { locationId: location?.id ?? null },
    })
  }
  const knows = (locationId) => locationKnown({ player, locationId })
  return resultOk({
    place: { locationId: location.id, known: knows(location.id) },
    menu: { locationId: location.id, known: knows(location.id) },
    people: characters.map((character) => ({ characterId: character.id, realId: character.id })),
    exits: (location.exits ?? []).map((exit) => ({
      locationId: exit.locationId,
      perceivedLocationId: exit.locationId,
      known: knows(exit.locationId),
    })),
  })
}
