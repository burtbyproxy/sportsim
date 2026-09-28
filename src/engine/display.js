/**
 * Display Engine — the world's verdict.
 *
 * Making produces only the artist's text: what the maker sees. What anybody
 * else sees is written once, when the piece goes up in front of strangers,
 * and never again: a piece cannot be re-hung for a second verdict. The
 * venue decides who is there (content on the location: `venue`), and
 * friends are not the world, so a piece shown to them is not shown.
 *
 * The verdict is a check: the player's standing against the venue, bent
 * by how the piece came out. It reads praised, ignored, or mocked, and
 * leaves legend on the piece, which is what a piece will one day sell on.
 * Showing transforms the piece: the idea survives only as story.
 *
 * Pure functions. No side effects. No Vue. No DOM. Every public function
 * takes a single input struct; the ones that can fail return a result
 * struct (ok/data/error).
 */

import { resultOk, resultFail } from './result.js'
import { checkRoll } from './dice.js'
import { ARTIFACT_KINDS, ARTIFACT_STATUSES } from './making.js'

/** Enumerated error codes for every display result. The code is the contract. */
export const DISPLAY_ERROR_CODES = Object.freeze({
  artifactMissing: 'ARTIFACT_MISSING',
  artifactShown: 'ARTIFACT_SHOWN',
  venueNone: 'VENUE_NONE',
  venueFriends: 'VENUE_FRIENDS',
  statUnknown: 'STAT_UNKNOWN',
})

/** Who a venue puts in front of a piece. */
export const VENUE_AUDIENCES = Object.freeze({
  // The world. A verdict.
  strangers: 'strangers',
  // Not the world. No verdict, and nothing lost.
  friends: 'friends',
})

/** How the world read it. */
export const RECEPTIONS = Object.freeze({
  praised: 'praised',
  ignored: 'ignored',
  mocked: 'mocked',
})

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Whether a piece has had its verdict.
 * @param {{ artifact: Object }} input
 * @returns {boolean}
 */
export function artifactShown({ artifact }) {
  return artifact?.reception !== null && artifact?.reception !== undefined
}

/**
 * The pieces the player carries that could still be shown.
 * @param {{ player: Object }} input
 * @returns {Object[]}
 */
export function displayCandidates({ player }) {
  return (player?.portfolio ?? []).filter(
    (artifact) => artifact.kind === ARTIFACT_KINDS.portable && !artifactShown({ artifact })
  )
}

/**
 * Whether a place has the world in it: a venue with strangers.
 * @param {{ location: Object }} input
 * @returns {{ ok: boolean, data: { venue: Object }|null, error: Object|null }}
 */
export function displayVenue({ location }) {
  const venue = location?.venue ?? null
  if (!venue) {
    return resultFail({
      code: DISPLAY_ERROR_CODES.venueNone,
      message: `Nobody to show anything to at '${location?.id}'`,
      params: { locationId: location?.id ?? '' },
    })
  }
  if (venue.audience !== VENUE_AUDIENCES.strangers) {
    return resultFail({
      code: DISPLAY_ERROR_CODES.venueFriends,
      message: `Friends are not the world at '${location.id}'`,
      params: { locationId: location.id },
    })
  }
  return resultOk({ venue })
}

/**
 * A piece goes up in front of strangers. The player's standing is checked
 * against the venue, bent by how the piece came out; the verdict is read
 * off the check; legend lands on the piece; the piece is shown, once and
 * for all. Nothing is applied here; the piece comes back changed, and the
 * artist's text is the caller's to overwrite with the world's.
 *
 * @param {{
 *   tuning: Object,
 *   player: Object,
 *   artifact: Object,
 *   location: Object,
 *   gameTime: { tick: number },
 *   rng: () => number,
 * }} input
 * @returns {{ ok: boolean, data: {
 *   artifact: Object,
 *   reception: string,
 *   check: Object,
 *   legendGained: number,
 * }|null, error: Object|null }}
 */
export function displayReveal({ tuning, player, artifact, location, gameTime, rng }) {
  if (!artifact) {
    return resultFail({
      code: DISPLAY_ERROR_CODES.artifactMissing,
      message: 'displayReveal needs a piece',
    })
  }
  if (artifactShown({ artifact })) {
    return resultFail({
      code: DISPLAY_ERROR_CODES.artifactShown,
      message: `Piece '${artifact.id}' has had its verdict`,
      params: { artifactId: artifact.id },
    })
  }
  const venue = displayVenue({ location })
  if (!venue.ok) return venue
  const { stat, tierModifiers, legend } = tuning.display
  if (!player?.stats?.[stat]) {
    return resultFail({
      code: DISPLAY_ERROR_CODES.statUnknown,
      message: `No stat '${stat}' to be judged on`,
      params: { stat },
    })
  }
  const check = checkRoll({
    tuning,
    player,
    statName: stat,
    modifiers: [tierModifiers[artifact.tier] ?? 0],
    dc: venue.data.venue.dc,
    rng,
  })
  const reception = check.criticalFailure
    ? RECEPTIONS.mocked
    : check.success
      ? RECEPTIONS.praised
      : RECEPTIONS.ignored
  const legendGained = legend[reception] ?? 0
  const shown = {
    ...artifact,
    status: artifact.kind === ARTIFACT_KINDS.portable ? ARTIFACT_STATUSES.shown : artifact.status,
    reception,
    legend: Math.max(0, (artifact.legend ?? 0) + legendGained),
    ideaText: artifact.artistText,
    shownAtTick: gameTime.tick,
    shownAtLocationId: location.id,
    updatedAtTick: gameTime.tick,
  }
  return resultOk({ artifact: shown, reception, check, legendGained })
}
