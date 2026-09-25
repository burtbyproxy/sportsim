import { describe, it, expect } from 'vitest'
import { CURE_ERROR_CODES, cureCandidates, cureSessionApply } from './curing.js'
import { MARK_STATUSES } from './psyche.js'

// --- Fixtures ---

const marks = {
  scar: { id: 'scar', kind: 'trauma', display: 'A scar' },
  phobia: { id: 'phobia', kind: 'phobia', display: 'A fear' },
  crush: { id: 'crush', kind: 'obsession', display: "Can't let go" },
}

const cure = ({ id = 'therapy', markKinds = [], sessions = 3, setbackOnFailure = 0 } = {}) => ({
  id,
  display: id,
  markKinds,
  sessions,
  setbackOnFailure,
  session: { ticks: 4, check: { stat: 'toughness', dc: 12 }, money: 0, statusChanges: {} },
  lineCodes: { took: 'x', slipped: 'y', cured: 'z' },
})

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
const at = { tick: 7 }

describe('cureCandidates — what a cure can work on', () => {
  const carried = subject([
    mark({ id: 'a', markId: 'scar' }),
    mark({ id: 'b', markId: 'phobia', cures: { hypnosis: 1 } }),
    mark({ id: 'c', markId: 'crush', status: MARK_STATUSES.cured }),
  ])

  it('a cure that names no kinds reaches every active mark, with the count so far', () => {
    const found = cureCandidates({ subject: carried, marks, cure: cure() })
    expect(found.map((f) => [f.mark.id, f.sessionsDone])).toEqual([
      ['a', 0],
      ['b', 0],
    ])
    expect(found[0].definition).toBe(marks.scar)
  })

  it('a cure that names kinds reaches only those, and the count is its own', () => {
    const found = cureCandidates({
      subject: carried,
      marks,
      cure: cure({ id: 'hypnosis', markKinds: ['phobia'] }),
    })
    expect(found.map((f) => [f.mark.id, f.sessionsDone])).toEqual([['b', 1]])
  })

  it('a mark whose definition is missing, or nobody at all, is nothing to work on', () => {
    const ghost = subject([mark({ id: 'g', markId: 'gone' })])
    expect(cureCandidates({ subject: ghost, marks, cure: cure() })).toEqual([])
    expect(cureCandidates({ subject: null, marks, cure: cure() })).toEqual([])
  })
})

describe('cureSessionApply — a session counts, sets back, and ends a mark', () => {
  it('refuses without a subject or a cure', () => {
    const noOne = cureSessionApply({
      subject: null,
      marks,
      cure: cure(),
      markInstanceId: 'a',
      succeeded: true,
      gameTime: at,
    })
    expect(noOne.error.code).toBe(CURE_ERROR_CODES.subjectMissing)
    const nothing = cureSessionApply({
      subject: subject([]),
      marks,
      cure: null,
      markInstanceId: 'a',
      succeeded: true,
      gameTime: at,
    })
    expect(nothing.error.code).toBe(CURE_ERROR_CODES.cureMissing)
  })

  it('refuses a mark the subject does not carry, one already ended, and one the cure cannot reach', () => {
    const carried = subject([
      mark({ id: 'a', markId: 'scar' }),
      mark({ id: 'c', markId: 'crush', status: MARK_STATUSES.cured }),
    ])
    const run = ({ markInstanceId, cure: which = cure() }) =>
      cureSessionApply({
        subject: carried,
        marks,
        cure: which,
        markInstanceId,
        succeeded: true,
        gameTime: at,
      })
    expect(run({ markInstanceId: 'zzz' }).error.code).toBe(CURE_ERROR_CODES.markUnknown)
    expect(run({ markInstanceId: 'c' }).error.code).toBe(CURE_ERROR_CODES.markNotActive)
    expect(run({ markInstanceId: 'a', cure: cure({ markKinds: ['phobia'] }) }).error).toMatchObject(
      { code: CURE_ERROR_CODES.markNotCurable, params: { cureId: 'therapy', markId: 'scar' } }
    )
  })

  it('a session that took counts one, on that cure, and the mark stays active until the count', () => {
    const carried = subject([mark({ id: 'a', markId: 'scar', cures: { other: 5 } })])
    const result = cureSessionApply({
      subject: carried,
      marks,
      cure: cure({ sessions: 3 }),
      markInstanceId: 'a',
      succeeded: true,
      gameTime: at,
    })
    expect(result.ok).toBe(true)
    expect(result.data).toMatchObject({
      cured: false,
      sessionsDone: 1,
      sessionsNeeded: 3,
      setback: 0,
    })
    expect(result.data.mark.cures).toEqual({ other: 5, therapy: 1 })
    expect(result.data.mark.status).toBe(MARK_STATUSES.active)
    expect(result.data.mark.updatedAtTick).toBe(7)
    // Nothing was applied to the subject.
    expect(carried.psyche.marks[0].cures).toEqual({ other: 5 })
  })

  it('the count reached is the cure: the status changes, a fit ends, and the mark stays', () => {
    const carried = subject([mark({ id: 'a', markId: 'scar', cures: { therapy: 2 }, fit: 2 })])
    const result = cureSessionApply({
      subject: carried,
      marks,
      cure: cure({ sessions: 3 }),
      markInstanceId: 'a',
      succeeded: true,
      gameTime: at,
    })
    expect(result.data.cured).toBe(true)
    expect(result.data.mark.status).toBe(MARK_STATUSES.cured)
    expect(result.data.mark.fitTicksRemaining).toBe(0)
    expect(result.data.marks).toHaveLength(1)
    expect(result.data.marks[0].id).toBe('a')
  })

  it('a session that slipped costs the setback, never below nothing', () => {
    const run = ({ done, setbackOnFailure }) =>
      cureSessionApply({
        subject: subject([mark({ id: 'a', markId: 'scar', cures: { therapy: done } })]),
        marks,
        cure: cure({ setbackOnFailure }),
        markInstanceId: 'a',
        succeeded: false,
        gameTime: at,
      }).data
    expect(run({ done: 2, setbackOnFailure: 1 })).toMatchObject({ sessionsDone: 1, setback: 1 })
    expect(run({ done: 0, setbackOnFailure: 1 })).toMatchObject({ sessionsDone: 0, setback: 0 })
    expect(run({ done: 2, setbackOnFailure: 0 })).toMatchObject({ sessionsDone: 2, setback: 0 })
  })

  it('a mark from before counts had a name still counts', () => {
    const old = { ...mark({ id: 'a', markId: 'scar' }) }
    delete old.cures
    const result = cureSessionApply({
      subject: subject([old]),
      marks,
      cure: cure(),
      markInstanceId: 'a',
      succeeded: true,
      gameTime: at,
    })
    expect(result.data.mark.cures).toEqual({ therapy: 1 })
  })
})
