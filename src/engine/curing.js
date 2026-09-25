/**
 * Curing Engine — how a mark ends.
 *
 * Marks (engine/psyche.js) never wear off on their own. A cure is content
 * (content/cures): which kinds of mark it can end, how many sessions it
 * takes, and what a session is (its time, its check, its price, what it
 * takes out of you). Progress is on the mark, per cure, so switching cures
 * starts over with the new one. A session that goes wrong can set the
 * count back. When the count is reached the mark's status changes to
 * cured: it stays, as what happened, and stops doing anything.
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * The subject's active marks this cure can work on, each with its
 * definition and how far along it is with this cure.
 * @param {{ subject: Object, marks: Object<string, Object>, cure: Object }} input
 * @returns {Array<{ mark: Object, definition: Object, sessionsDone: number }>}
 */
export function cureCandidates({ subject, marks, cure }) {
  return (subject?.psyche?.marks ?? [])
    .filter((mark) => mark.status === MARK_STATUSES.active && marks[mark.markId])
    .map((mark) => ({ mark, definition: marks[mark.markId] }))
    .filter(({ definition }) => cureReaches({ cure, definition }))
    .map(({ mark, definition }) => ({
      mark,
      definition,
      sessionsDone: mark.cures?.[cure.id] ?? 0,
    }))
}

/**
 * A session of a cure, on one mark: a session that took counts one more;
 * one that went wrong counts the cure's setback back, never below nothing.
 * The count reaching the cure's sessions is the cure: the mark's status
 * changes. Nothing is applied here; the subject's marks come back changed.
 *
 * @param {{
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
 * }|null, error: Object|null }}
 *   mark — the mark after the session; setback — how many sessions a failed one cost
 */
export function cureSessionApply({ subject, marks, cure, markInstanceId, succeeded, gameTime }) {
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
  const done = before.cures?.[cure.id] ?? 0
  const setback = succeeded ? 0 : Math.min(done, cure.setbackOnFailure)
  const sessionsDone = succeeded ? done + 1 : done - setback
  const cured = sessionsDone >= cure.sessions
  const mark = {
    ...before,
    cures: { ...(before.cures ?? {}), [cure.id]: sessionsDone },
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
  })
}
