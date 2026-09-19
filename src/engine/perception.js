/**
 * Perception Engine — what the player takes the world to be.
 *
 * The world is what content and the run say it is. The player sees less:
 * a place they do not know shows only its looks, and its own business stays
 * off the menu until they find out what it is. And a confused player sees
 * wrong: another place's name and business, somebody else's face, a way out
 * that leads somewhere it doesn't. Every wrong thing is a real thing, swapped
 * in by id (a neighbour by its exits, a face from the roster), never words
 * made up for the occasion. This module decides what the player perceives;
 * the store turns ids into words, the loop acts against reality.
 *
 * Pure functions. No side effects. No Vue. No DOM. Every public function
 * takes a single input struct; the ones that can fail return a result
 * struct (ok/data/error).
 */

import { resultOk, resultFail } from './result.js'
import { randomChance, randomInt } from '../utils/random.js'
import { numberClamp, numberRound } from '../utils/number.js'
import { listSortBy } from '../utils/list.js'

/** Enumerated error codes for every perception result. The code is the contract. */
export const PERCEPTION_ERROR_CODES = Object.freeze({
  playerMissing: 'PLAYER_MISSING',
  locationUnknown: 'LOCATION_UNKNOWN',
  ticksInvalid: 'TICKS_INVALID',
})

/** What confusion can swap. Each distortion is { kind, realId, perceivedId }. */
export const DISTORTION_KINDS = Object.freeze({
  // The place itself: its name, its looks, and its business on the menu.
  place: 'place',
  // Only the menu: the right place, somewhere else's business.
  menu: 'menu',
  // Somebody here, taken for somebody else.
  person: 'person',
  // A way out, taken to lead somewhere it doesn't.
  exit: 'exit',
})

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * One of the candidates, or null when there are none. Candidates are
 * sorted first, so the same roll always picks the same one.
 * @param {{ ids: string[], rng: () => number }} input
 * @returns {string|null}
 */
function idPick({ ids, rng }) {
  if (ids.length === 0) return null
  const sorted = listSortBy({ items: [...new Set(ids)], keyOf: (id) => id })
  return sorted[randomInt({ min: 0, max: sorted.length - 1, rng })]
}

/**
 * Whether a distortion of a kind happens: each point of confusion is a
 * chance (content/tuning.json `perception.chancePerPoint`).
 * @param {{ tuning: Object, kind: string, confusion: number, rng: () => number }} input
 * @returns {boolean}
 */
function distortionHappens({ tuning, kind, confusion, rng }) {
  const chance = Math.min(1, confusion * tuning.perception.chancePerPoint[kind])
  return chance > 0 && randomChance({ probability: chance, rng })
}

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
 * How confused a subject is, 0–100: what the blend carries (substances and
 * conditions), plus a knock to the head.
 * @param {{ blend: { confusion: number }, dazed: number }} input
 * @returns {number}
 */
export function confusionDerive({ blend, dazed }) {
  const total = blend.confusion + dazed
  return numberRound({ value: numberClamp({ value: total, min: 0, max: 100 }), places: 2 })
}

/**
 * Which band of confusion the player is in: 0 below the first
 * (`perception.bands`), and one more for each band reached. The scene is
 * seen afresh when the band changes, not on every wobble inside one.
 * @param {{ tuning: Object, confusion: number }} input
 * @returns {number}
 */
export function confusionBand({ tuning, confusion }) {
  return tuning.perception.bands.filter((band) => confusion >= band.atLeast).length
}

/**
 * A knock to the head wears off.
 * @param {{ tuning: Object, dazed: number, ticksElapsed: number }} input
 * @returns {{ ok: boolean, data: { dazed: number }|null, error: Object|null }}
 */
export function dazedDecay({ tuning, dazed, ticksElapsed }) {
  if (!Number.isFinite(ticksElapsed) || ticksElapsed < 0) {
    return resultFail({
      code: PERCEPTION_ERROR_CODES.ticksInvalid,
      message: `ticksElapsed must be >= 0, got ${ticksElapsed}`,
    })
  }
  const next = Math.max(0, dazed - tuning.perception.dazedDecayPerTick * ticksElapsed)
  return resultOk({ dazed: numberRound({ value: next, places: 2 }) })
}

/**
 * Roll what a confused player gets wrong about the scene. Below the first
 * band nothing is wrong. Otherwise each kind of thing rolls on its own:
 * the place (it becomes a neighbour: somewhere its exits reach), or, when
 * the place holds, just the menu (a neighbour's business); each person here
 * (somebody else from the roster who isn't here); each way out (somewhere
 * past where it really goes). Only real things are swapped in, by id.
 *
 * @param {{
 *   tuning: Object,
 *   confusion: number,
 *   location: Object,
 *   locations: Object<string, Object>,
 *   characters: Object[],
 *   roster: Object<string, Object>,
 *   rng: () => number,
 * }} input
 *   location — where the player really is; characters — who is really
 *   there; roster — everybody
 * @returns {{ ok: boolean, data: { distortions: Array<{ kind: string, realId: string, perceivedId: string }> }|null, error: Object|null }}
 */
export function perceptionRoll({
  tuning,
  confusion,
  location,
  locations,
  characters,
  roster,
  rng,
}) {
  if (!location || !locations[location.id]) {
    return resultFail({
      code: PERCEPTION_ERROR_CODES.locationUnknown,
      message: `No location '${location?.id}' to perceive`,
      params: { locationId: location?.id ?? null },
    })
  }
  const distortions = []
  if (confusionBand({ tuning, confusion }) === 0) return resultOk({ distortions })
  const happens = (kind) => distortionHappens({ tuning, kind, confusion, rng })
  const distort = ({ kind, realId, ids }) => {
    const perceivedId = idPick({ ids, rng })
    if (perceivedId) distortions.push({ kind, realId, perceivedId })
  }

  const neighbourIds = (location.exits ?? [])
    .map((exit) => exit.locationId)
    .filter((id) => id !== location.id && locations[id])
  if (happens(DISTORTION_KINDS.place)) {
    distort({ kind: DISTORTION_KINDS.place, realId: location.id, ids: neighbourIds })
  } else if (happens(DISTORTION_KINDS.menu)) {
    distort({ kind: DISTORTION_KINDS.menu, realId: location.id, ids: neighbourIds })
  }

  const hereIds = characters.map((character) => character.id)
  const elsewhereIds = Object.keys(roster).filter((id) => !hereIds.includes(id))
  for (const character of characters) {
    if (!happens(DISTORTION_KINDS.person)) continue
    distort({ kind: DISTORTION_KINDS.person, realId: character.id, ids: elsewhereIds })
  }

  for (const exit of location.exits ?? []) {
    if (!happens(DISTORTION_KINDS.exit)) continue
    const beyondIds = (locations[exit.locationId]?.exits ?? [])
      .map((further) => further.locationId)
      .filter((id) => id !== location.id && locations[id])
    distort({ kind: DISTORTION_KINDS.exit, realId: exit.locationId, ids: beyondIds })
  }

  return resultOk({ distortions })
}

/**
 * Whether an action the player picked belongs to a place or a person that
 * is not really here: they took the place, or the face, for something it
 * isn't. The act runs against reality, and misfires.
 * @param {{ action: Object, location: Object, characters: Object[] }} input
 *   location — where the player really is; characters — who is really there
 * @returns {boolean}
 */
export function actionMisperceived({ action, location, characters }) {
  if (action.locationId && action.locationId !== 'any' && action.locationId !== location.id) {
    return true
  }
  if (action.characterId && !characters.some((c) => c.id === action.characterId)) return true
  return false
}

/**
 * The scene as the player perceives it: the place they take themselves to
 * be in, whose business the menu offers, who they take the people here to
 * be, and where they take each way out to lead. Each carries whether the
 * player knows the place it names. Distortions (perceptionRoll) swap in
 * what the player gets wrong; one about somebody no longer here is moot.
 *
 * @param {{
 *   player: Object,
 *   location: Object,
 *   locations: Object<string, Object>,
 *   characters: Object[],
 *   distortions: Array<{ kind: string, realId: string, perceivedId: string }>,
 * }} input
 *   location — where the player really is; characters — who is really there
 * @returns {{ ok: boolean, data: {
 *   place: { locationId: string, known: boolean },
 *   menu: { locationId: string, known: boolean },
 *   people: Array<{ characterId: string, realId: string }>,
 *   exits: Array<{ locationId: string, perceivedLocationId: string, known: boolean }>,
 * }|null, error: Object|null }}
 */
export function perceptionView({ player, location, locations, characters, distortions }) {
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
  const swapped = ({ kind, realId }) =>
    distortions.find((d) => d.kind === kind && d.realId === realId)?.perceivedId ?? realId
  const placeId = swapped({ kind: DISTORTION_KINDS.place, realId: location.id })
  const menuId =
    placeId !== location.id
      ? placeId
      : swapped({ kind: DISTORTION_KINDS.menu, realId: location.id })
  return resultOk({
    place: { locationId: placeId, known: knows(placeId) },
    menu: { locationId: menuId, known: knows(menuId) },
    people: characters.map((character) => ({
      characterId: swapped({ kind: DISTORTION_KINDS.person, realId: character.id }),
      realId: character.id,
    })),
    exits: (location.exits ?? []).map((exit) => {
      const perceivedLocationId = swapped({ kind: DISTORTION_KINDS.exit, realId: exit.locationId })
      return {
        locationId: exit.locationId,
        perceivedLocationId,
        known: knows(perceivedLocationId),
      }
    }),
  })
}
