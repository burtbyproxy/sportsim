import { describe, it, expect } from 'vitest'
import {
  CURE_ERROR_CODES,
  CURE_REFUSAL_CODES,
  cureCandidates,
  cureSessionAllowed,
  cureSessionApply,
} from './curing.js'
import { MARK_STATUSES } from './psyche.js'
import { tuningContent } from '../../tests/helpers/content.js'

const tuning = tuningContent()
const perHour = tuning.clock.ticksPerHour

// --- Fixtures ---

const marks = {
  scar: { id: 'scar', kind: 'trauma', display: 'A scar' },
  phobia: { id: 'phobia', kind: 'phobia', display: 'A fear' },
  crush: { id: 'crush', kind: 'obsession', display: "Can't let go" },
}

const cure = ({
  id = 'therapy',
  markKinds = [],
  sessions = 3,
  setbackOnFailure = 0,
  cadence = null,
  lapse = null,
  risk = null,
} = {}) => ({
  id,
  display: id,
  markKinds,
  sessions,
  setbackOnFailure,
  session: { ticks: 4, check: { stat: 'toughness', dc: 12 }, money: 0, statusChanges: {} },
  cadence,
  lapse,
  risk,
  lineCodes: { took: 'x', slipped: 'y', cured: 'z' },
})

const stands = ({ done, last = 0 }) => ({ sessionsDone: done, lastSessionTick: last })

const mark = ({ id, markId, status = MARK_STATUSES.active, cures = {}, fit = 0 }) => ({
  id,
  markId,
  target: { kind: 'location', id: 'park' },
  source: { kind: 'test', id: 'test' },
  status,
  fitTicksRemaining: fit,
  cures,
  acquiredAtTick: 0,
  updatedAtTick: 0,
})

const subject = (list) => ({ id: 'p', psyche: { marks: list, abilities: [], grooves: {} } })
const at = (tick) => ({ tick })

const session = ({ carried, which = cure(), markInstanceId = 'a', succeeded = true, tick = 7 }) =>
  cureSessionApply({
    tuning,
    subject: carried,
    marks,
    cure: which,
    markInstanceId,
    succeeded,
    gameTime: at(tick),
  })

describe('cureCandidates — what a cure can work on', () => {
  const carried = subject([
    mark({ id: 'a', markId: 'scar' }),
    mark({ id: 'b', markId: 'phobia', cures: { hypnosis: stands({ done: 1, last: 3 }) } }),
    mark({ id: 'c', markId: 'crush', status: MARK_STATUSES.cured }),
  ])

  it('a cure that names no kinds reaches every active mark, standing nowhere yet', () => {
    const found = cureCandidates({ subject: carried, marks, cure: cure() })
    expect(found.map((f) => [f.mark.id, f.sessionsDone, f.lastSessionTick])).toEqual([
      ['a', 0, null],
      ['b', 0, null],
    ])
    expect(found[0].definition).toBe(marks.scar)
  })

  it('a cure that names kinds reaches only those, and where it stands is its own', () => {
    const found = cureCandidates({
      subject: carried,
      marks,
      cure: cure({ id: 'hypnosis', markKinds: ['phobia'] }),
    })
    expect(found.map((f) => [f.mark.id, f.sessionsDone, f.lastSessionTick])).toEqual([['b', 1, 3]])
  })

  it('a mark whose definition is missing, or nobody at all, is nothing to work on', () => {
    const ghost = subject([mark({ id: 'g', markId: 'gone' })])
    expect(cureCandidates({ subject: ghost, marks, cure: cure() })).toEqual([])
    expect(cureCandidates({ subject: null, marks, cure: cure() })).toEqual([])
  })
})

describe('cureSessionAllowed — one session per span', () => {
  const daily = cure({ cadence: { everyHours: 24 } })
  const fresh = mark({ id: 'a', markId: 'scar' })
  const seen = mark({ id: 'a', markId: 'scar', cures: { therapy: stands({ done: 1, last: 100 }) } })

  it('a cure with no cadence is always allowed', () => {
    expect(cureSessionAllowed({ tuning, cure: cure(), mark: seen, gameTime: at(101) })).toEqual({
      allowed: true,
      reasonCode: null,
      ticksUntil: 0,
    })
  })

  it('the first session is always allowed', () => {
    expect(cureSessionAllowed({ tuning, cure: daily, mark: fresh, gameTime: at(0) }).allowed).toBe(
      true
    )
  })

  it('after a session the span has to pass, and it says how long', () => {
    const tooSoon = cureSessionAllowed({ tuning, cure: daily, mark: seen, gameTime: at(100 + 3) })
    expect(tooSoon).toEqual({
      allowed: false,
      reasonCode: CURE_REFUSAL_CODES.soon,
      ticksUntil: 24 * perHour - 3,
    })
    const inTime = cureSessionAllowed({
      tuning,
      cure: daily,
      mark: seen,
      gameTime: at(100 + 24 * perHour),
    })
    expect(inTime.allowed).toBe(true)
  })
})

describe('cureSessionApply — a session counts, sets back, lapses, and ends a mark', () => {
  it('refuses without a subject or a cure', () => {
    const noOne = cureSessionApply({
      tuning,
      subject: null,
      marks,
      cure: cure(),
      markInstanceId: 'a',
      succeeded: true,
      gameTime: at(1),
    })
    expect(noOne.error.code).toBe(CURE_ERROR_CODES.subjectMissing)
    expect(session({ carried: subject([]), which: null }).error.code).toBe(
      CURE_ERROR_CODES.cureMissing
    )
  })

  it('refuses a mark the subject does not carry, one already ended, and one the cure cannot reach', () => {
    const carried = subject([
      mark({ id: 'a', markId: 'scar' }),
      mark({ id: 'c', markId: 'crush', status: MARK_STATUSES.cured }),
    ])
    expect(session({ carried, markInstanceId: 'zzz' }).error.code).toBe(
      CURE_ERROR_CODES.markUnknown
    )
    expect(session({ carried, markInstanceId: 'c' }).error.code).toBe(
      CURE_ERROR_CODES.markNotActive
    )
    expect(session({ carried, which: cure({ markKinds: ['phobia'] }) }).error).toMatchObject({
      code: CURE_ERROR_CODES.markNotCurable,
      params: { cureId: 'therapy', markId: 'scar' },
    })
  })

  it('refuses a session before the cadence has passed, and says how long', () => {
    const carried = subject([
      mark({ id: 'a', markId: 'scar', cures: { therapy: stands({ done: 1, last: 100 }) } }),
    ])
    const result = session({ carried, which: cure({ cadence: { everyHours: 24 } }), tick: 101 })
    expect(result.error).toMatchObject({
      code: CURE_ERROR_CODES.sessionTooSoon,
      params: { cureId: 'therapy', ticksUntil: 24 * perHour - 1 },
    })
  })

  it('a session that took counts one, on that cure, and marks when; the mark stays active until the count', () => {
    const carried = subject([
      mark({ id: 'a', markId: 'scar', cures: { other: stands({ done: 5 }) } }),
    ])
    const result = session({ carried, which: cure({ sessions: 3 }), tick: 7 })
    expect(result.ok).toBe(true)
    expect(result.data).toMatchObject({
      cured: false,
      sessionsDone: 1,
      sessionsNeeded: 3,
      setback: 0,
      lapsed: 0,
    })
    expect(result.data.mark.cures).toEqual({
      other: stands({ done: 5 }),
      therapy: { sessionsDone: 1, lastSessionTick: 7 },
    })
    expect(result.data.mark.status).toBe(MARK_STATUSES.active)
    expect(result.data.mark.updatedAtTick).toBe(7)
    // Nothing was applied to the subject.
    expect(carried.psyche.marks[0].cures).toEqual({ other: stands({ done: 5 }) })
  })

  it('the count reached is the cure: the status changes, a fit ends, and the mark stays', () => {
    const carried = subject([
      mark({ id: 'a', markId: 'scar', cures: { therapy: stands({ done: 2 }) }, fit: 2 }),
    ])
    const result = session({ carried, which: cure({ sessions: 3 }) })
    expect(result.data.cured).toBe(true)
    expect(result.data.mark.status).toBe(MARK_STATUSES.cured)
    expect(result.data.mark.fitTicksRemaining).toBe(0)
    expect(result.data.marks).toHaveLength(1)
    expect(result.data.marks[0].id).toBe('a')
  })

  it('a session that slipped costs the setback, never below nothing', () => {
    const run = ({ done, setbackOnFailure }) =>
      session({
        carried: subject([mark({ id: 'a', markId: 'scar', cures: { therapy: stands({ done }) } })]),
        which: cure({ setbackOnFailure }),
        succeeded: false,
      }).data
    expect(run({ done: 2, setbackOnFailure: 1 })).toMatchObject({ sessionsDone: 1, setback: 1 })
    expect(run({ done: 0, setbackOnFailure: 1 })).toMatchObject({ sessionsDone: 0, setback: 0 })
    expect(run({ done: 2, setbackOnFailure: 0 })).toMatchObject({ sessionsDone: 2, setback: 0 })
  })

  it('let go past the lapse, the count slides back before the session counts', () => {
    const lapsing = cure({ cadence: { everyHours: 24 }, lapse: { afterHours: 72, setback: 1 } })
    const standing = (last) =>
      subject([mark({ id: 'a', markId: 'scar', cures: { therapy: stands({ done: 2, last }) } })])
    const kept = session({ carried: standing(0), which: lapsing, tick: 72 * perHour })
    expect(kept.data).toMatchObject({ lapsed: 0, sessionsDone: 3, cured: true })
    const gone = session({ carried: standing(0), which: lapsing, tick: 72 * perHour + 1 })
    expect(gone.data).toMatchObject({ lapsed: 1, sessionsDone: 2, cured: false })
    // A lapse and a slip in one session: both count against, never below nothing.
    const both = session({
      carried: subject([
        mark({ id: 'a', markId: 'scar', cures: { therapy: stands({ done: 1, last: 0 }) } }),
      ]),
      which: cure({
        cadence: { everyHours: 24 },
        lapse: { afterHours: 72, setback: 1 },
        setbackOnFailure: 1,
      }),
      succeeded: false,
      tick: 1000,
    })
    expect(both.data).toMatchObject({ lapsed: 1, setback: 0, sessionsDone: 0 })
  })

  it('a mark from before counts had a name still counts', () => {
    const old = { ...mark({ id: 'a', markId: 'scar' }) }
    delete old.cures
    const result = session({ carried: subject([old]), tick: 7 })
    expect(result.data.mark.cures).toEqual({ therapy: { sessionsDone: 1, lastSessionTick: 7 } })
  })
})
