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
 * A piece is a carried artifact, a mark on a wall, or, for a performance
 * that leaves no object, the experience itself: the room was the venue
 * and the verdict is live, at the finish.
 *
 * The world acts on what is left in it. A piece on a wall in front of
 * strangers, with legend on it, can be stolen, or defaced, or whatever
 * fates content names: stolen is the best compliment there is, and it
 * still sucks when you're broke.
 *
 * Pure functions. No side effects. No Vue. No DOM. Every public function
 * takes a single input struct; the ones that can fail return a result
 * struct (ok/data/error).
 */

import { resultOk, resultFail } from './result.js'
import { checkRoll } from './dice.js'
import { ARTIFACT_KINDS, ARTIFACT_STATUSES } from './making.js'
import { randomChance } from '../utils/random.js'

/** Enumerated error codes for every display result. The code is the contract. */
export const DISPLAY_ERROR_CODES = Object.freeze({
  pieceMissing: 'PIECE_MISSING',
  pieceShown: 'PIECE_SHOWN',
  ticksInvalid: 'TICKS_INVALID',
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
 * @param {{ piece: Object }} input
 * @returns {boolean}
 */
export function pieceShown({ piece }) {
  return piece?.reception !== null && piece?.reception !== undefined
}

/**
 * The pieces the player carries that could still be shown.
 * @param {{ player: Object }} input
 * @returns {Object[]}
 */
export function displayCandidates({ player }) {
  return (player?.portfolio ?? []).filter(
    (artifact) => artifact.kind === ARTIFACT_KINDS.portable && !pieceShown({ piece: artifact })
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
 *   piece: Object,
 *   location: Object,
 *   gameTime: { tick: number },
 *   rng: () => number,
 * }} input
 *   piece — an artifact, or the experience of a performance
 * @returns {{ ok: boolean, data: {
 *   piece: Object,
 *   reception: string,
 *   check: Object,
 *   legendGained: number,
 * }|null, error: Object|null }}
 */
export function displayReveal({ tuning, player, piece, location, gameTime, rng }) {
  if (!piece) {
    return resultFail({
      code: DISPLAY_ERROR_CODES.pieceMissing,
      message: 'displayReveal needs a piece',
    })
  }
  if (pieceShown({ piece })) {
    return resultFail({
      code: DISPLAY_ERROR_CODES.pieceShown,
      message: `Piece '${piece.id}' has had its verdict`,
      params: { pieceId: piece.id },
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
    modifiers: [tierModifiers[piece.tier] ?? 0],
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
    ...piece,
    status: piece.kind === ARTIFACT_KINDS.portable ? ARTIFACT_STATUSES.shown : piece.status,
    reception,
    legend: Math.max(0, (piece.legend ?? 0) + legendGained),
    ideaText: piece.artistText,
    shownAtTick: gameTime.tick,
    shownAtLocationId: location.id,
    updatedAtTick: gameTime.tick,
  }
  return resultOk({ piece: shown, reception, check, legendGained })
}

/**
 * The world acts on what is left in it. Over the ticks that passed, every
 * piece still up on this place's walls that the world has seen and put
 * legend on may meet a fate (tuning `display.fates`, in order): stolen,
 * defaced, whatever content says, each at its legend's chance per tick,
 * when there are strangers here to do it. A piece that meets a fate takes
 * the fate's status and its legend, and is not yet noticed by the one who
 * made it. One fate per piece per span.
 *
 * @param {{ tuning: Object, location: Object, ticksElapsed: number, gameTime: { tick: number }, rng: () => number }} input
 * @returns {{ ok: boolean, data: { marks: Object[], fated: Array<{ markId: string, status: string }> }|null, error: Object|null }}
 */
export function fateTick({ tuning, location, ticksElapsed, gameTime, rng }) {
  if (!Number.isFinite(ticksElapsed) || ticksElapsed < 0) {
    return resultFail({
      code: DISPLAY_ERROR_CODES.ticksInvalid,
      message: `ticksElapsed must be >= 0, got ${ticksElapsed}`,
    })
  }
  const marks = location?.marks ?? []
  if (!displayVenue({ location }).ok) return resultOk({ marks: [...marks], fated: [] })
  const fated = []
  const next = marks.map((mark) => {
    const wanted =
      mark.status === ARTIFACT_STATUSES.fresh && pieceShown({ piece: mark }) && mark.legend > 0
    if (!wanted) return mark
    for (const fate of tuning.display.fates) {
      const perTick = Math.min(1, mark.legend * fate.chancePerTickPerLegend)
      const chance = 1 - (1 - perTick) ** ticksElapsed
      if (!randomChance({ probability: chance, rng })) continue
      fated.push({ markId: mark.id, status: fate.status })
      return {
        ...mark,
        status: fate.status,
        legend: Math.max(0, mark.legend + fate.legendBonus),
        endedBy: { kind: 'fate', id: fate.status },
        noticedAtTick: null,
        updatedAtTick: gameTime.tick,
      }
    }
    return mark
  })
  return resultOk({ marks: next, fated })
}

/**
 * What a piece's fate is called, and what it says: the fate in tuning
 * with the piece's status, or null for a piece that has met none.
 * @param {{ tuning: Object, mark: Object }} input
 * @returns {Object|null}
 */
export function fateOf({ tuning, mark }) {
  return tuning.display.fates.find((fate) => fate.status === mark.status) ?? null
}
