/**
 * Curing Engine — how a mark ends.
 *
 * Marks (engine/psyche.js) never wear off on their own. A cure is content
 * (content/cures): which kinds of mark it can end, how many sessions it
 * takes, what a session is (its time, its check, its price, what it takes
 * out of you), how often one may be had (the cadence), what letting it go
 * costs (the lapse), and what a session gone wrong can do (the risk).
 * Progress is on the mark, per cure: the sessions done and when the last
 * was, so switching cures starts over with the new one. A session that
 * goes wrong can set the count back. When the count is reached the mark's
 * status changes to cured: it stays, as what happened, and stops doing
 * anything.
 *
 * Nothing happens in one sitting. A cure with a cadence takes one session
 * per its span and no more; a cure with a lapse slides back when the span
 * since the last session runs past it. A cure with no cadence is the
 * shortcut, and a shortcut carries a risk.
 *
 * Pure functions. No side effects. No Vue. No DOM. Every public function
 * takes a single input struct; the ones that can fail return a result
 * struct (ok/data/error).
 */

import { resultOk, resultFail } from './result.js'
import { MARK_STATUSES } from './psyche.js'

/** Enumerated error codes for every curing result. The code is the contract. */
export const CURE_ERROR_CODES = Object.freeze({
  subjectMissing: 'SUBJECT_MISSING',
  cureMissing: 'CURE_MISSING',
  markUnknown: 'MARK_UNKNOWN',
  markNotActive: 'MARK_NOT_ACTIVE',
  markNotCurable: 'MARK_NOT_CURABLE',
  sessionTooSoon: 'SESSION_TOO_SOON',
})

/** Why a session cannot be had yet. A voice code: the words are content. */
export const CURE_REFUSAL_CODES = Object.freeze({
  soon: 'requirement.cure.soon',
})

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Whether a cure can end a kind of mark: any kind, when it names none.
 * @param {{ cure: Object, definition: Object }} input
 * @returns {boolean}
 */
function cureReaches({ cure, definition }) {
  return cure.markKinds.length === 0 || cure.markKinds.includes(definition.kind)
}

/**
 * Hours of content, as ticks.
 * @param {{ hours: number, tuning: Object }} input
 * @returns {number}
 */
function ticksOf({ hours, tuning }) {
  return hours * tuning.clock.ticksPerHour
}

/**
 * Where a mark stands with a cure: nowhere, until a session is had.
 * @param {{ mark: Object, cure: Object }} input
 * @returns {{ sessionsDone: number, lastSessionTick: number|null }}
 */
function progressOf({ mark, cure }) {
  const progress = mark.cures?.[cure.id]
  return {
    sessionsDone: progress?.sessionsDone ?? 0,
    lastSessionTick: progress?.lastSessionTick ?? null,
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * The subject's active marks this cure can work on, each with its
 * definition and where it stands with this cure.
 * @param {{ subject: Object, marks: Object<string, Object>, cure: Object }} input
 * @returns {Array<{ mark: Object, definition: Object, sessionsDone: number, lastSessionTick: number|null }>}
 */
export function cureCandidates({ subject, marks, cure }) {
  return (subject?.psyche?.marks ?? [])
    .filter((mark) => mark.status === MARK_STATUSES.active && marks[mark.markId])
    .map((mark) => ({ mark, definition: marks[mark.markId] }))
    .filter(({ definition }) => cureReaches({ cure, definition }))
    .map(({ mark, definition }) => ({ mark, definition, ...progressOf({ mark, cure }) }))
}

/**
 * Whether a session of a cure may be had on a mark now: always, for a cure
 * with no cadence; otherwise only once the cadence's span has passed since
 * the last one.
 * @param {{ tuning: Object, cure: Object, mark: Object, gameTime: { tick: number } }} input
 * @returns {{ allowed: boolean, reasonCode: string|null, ticksUntil: number }}
 *   reasonCode — a voice code for why not; ticksUntil — how long until it may
 */
export function cureSessionAllowed({ tuning, cure, mark, gameTime }) {
  const { lastSessionTick } = progressOf({ mark, cure })
  if (!cure.cadence || lastSessionTick === null) {
    return { allowed: true, reasonCode: null, ticksUntil: 0 }
  }
  const span = ticksOf({ hours: cure.cadence.everyHours, tuning })
  const ticksUntil = Math.max(0, lastSessionTick + span - gameTime.tick)
  return ticksUntil === 0
    ? { allowed: true, reasonCode: null, ticksUntil: 0 }
    : { allowed: false, reasonCode: CURE_REFUSAL_CODES.soon, ticksUntil }
}

/**
 * A session of a cure, on one mark. First the lapse: a cure let go past
 * its span slides back before the session counts. Then the session: one
 * that took counts one more; one that went wrong counts the cure's
 * setback back, never below nothing. The count reaching the cure's
 * sessions is the cure: the mark's status changes. Nothing is applied
 * here; the subject's marks come back changed.
 *
 * @param {{
 *   tuning: Object,
 *   subject: Object,
 *   marks: Object<string, Object>,
 *   cure: Object,
 *   markInstanceId: string,
 *   succeeded: boolean,
 *   gameTime: { tick: number },
 * }} input
 * @returns {{ ok: boolean, data: {
 *   marks: Object[],
 *   mark: Object,
 *   cured: boolean,
 *   sessionsDone: number,
 *   sessionsNeeded: number,
 *   setback: number,
 *   lapsed: number,
 * }|null, error: Object|null }}
 *   mark — the mark after the session; setback — sessions a failed one cost;
 *   lapsed — sessions letting it go cost, before this one
 */
export function cureSessionApply({
  tuning,
  subject,
  marks,
  cure,
  markInstanceId,
  succeeded,
  gameTime,
}) {
  if (!subject) {
    return resultFail({
      code: CURE_ERROR_CODES.subjectMissing,
      message: 'cureSessionApply needs a subject',
    })
  }
  if (!cure) {
    return resultFail({
      code: CURE_ERROR_CODES.cureMissing,
      message: 'cureSessionApply needs a cure',
    })
  }
  const current = subject.psyche?.marks ?? []
  const before = current.find((m) => m.id === markInstanceId)
  if (!before) {
    return resultFail({
      code: CURE_ERROR_CODES.markUnknown,
      message: `No mark '${markInstanceId}' on the subject`,
      params: { markInstanceId },
    })
  }
  if (before.status !== MARK_STATUSES.active) {
    return resultFail({
      code: CURE_ERROR_CODES.markNotActive,
      message: `Mark '${markInstanceId}' is ${before.status}, not active`,
      params: { markInstanceId, status: before.status },
    })
  }
  const definition = marks[before.markId]
  if (!definition || !cureReaches({ cure, definition })) {
    return resultFail({
      code: CURE_ERROR_CODES.markNotCurable,
      message: `Cure '${cure.id}' cannot end a '${definition?.kind ?? before.markId}'`,
      params: { cureId: cure.id, markId: before.markId },
    })
  }
  const soon = cureSessionAllowed({ tuning, cure, mark: before, gameTime })
  if (!soon.allowed) {
    return resultFail({
      code: CURE_ERROR_CODES.sessionTooSoon,
      message: `Cure '${cure.id}' has ${soon.ticksUntil} ticks to wait`,
      params: { cureId: cure.id, ticksUntil: soon.ticksUntil },
    })
  }
  const { sessionsDone: done, lastSessionTick } = progressOf({ mark: before, cure })
  let lapsed = 0
  if (cure.lapse && lastSessionTick !== null) {
    const gone = gameTime.tick - lastSessionTick > ticksOf({ hours: cure.lapse.afterHours, tuning })
    if (gone) lapsed = Math.min(done, cure.lapse.setback)
  }
  const kept = done - lapsed
  const setback = succeeded ? 0 : Math.min(kept, cure.setbackOnFailure)
  const sessionsDone = succeeded ? kept + 1 : kept - setback
  const cured = sessionsDone >= cure.sessions
  const mark = {
    ...before,
    cures: {
      ...(before.cures ?? {}),
      [cure.id]: { sessionsDone, lastSessionTick: gameTime.tick },
    },
    status: cured ? MARK_STATUSES.cured : before.status,
    fitTicksRemaining: cured ? 0 : before.fitTicksRemaining,
    updatedAtTick: gameTime.tick,
  }
  return resultOk({
    marks: current.map((m) => (m.id === markInstanceId ? mark : m)),
    mark,
    cured,
    sessionsDone,
    sessionsNeeded: cure.sessions,
    setback,
    lapsed,
  })
}
