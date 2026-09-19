import { describe, it, expect } from 'vitest'
import {
  FIT_TRIGGER_KINDS,
  MARK_STATUSES,
  PSYCHE_ERROR_CODES,
  psycheAvoids,
  psycheBlendSources,
  psycheDraw,
  psycheFitsTick,
  psycheGrooveTick,
  psycheTableRoll,
  psycheTrauma,
} from './psyche.js'
import { blendCompute, PERSONA_SOURCES } from './blend.js'
import { tuningContent } from '../../tests/helpers/content.js'
import { rngForNatural, rngSequence } from '../../tests/helpers/rng.js'

const tuning = tuningContent()
const FAIL = rngForNatural({ natural: 1 })
const PASS = rngForNatural({ natural: 20 })

// --- Fixtures ---

const fit = ({ trigger, personaId = 'panic' }) => ({
  trigger,
  chancePerTick: 0.5,
  ticks: 2,
  weight: 0.6,
  persona: { id: personaId, display: personaId, compulsion: 'Go.' },
  modifiers: [
    { stat: 'stamina', value: 3 },
    { stat: 'wits', value: -5 },
  ],
  confusion: 20,
  lineCode: `psyche.fit.${personaId}`,
})

const marks = {
  phobia: {
    id: 'phobia',
    kind: 'phobia',
    targetKinds: ['location', 'character'],
    avoids: true,
    draws: 0,
    confusion: 0,
    fit: fit({ trigger: { kind: FIT_TRIGGER_KINDS.target } }),
  },
  crush: {
    id: 'crush',
    kind: 'obsession',
    targetKinds: ['substance', 'character', 'item', 'location', 'topic'],
    avoids: false,
    draws: 0.5,
    confusion: 0,
    fit: null,
  },
  voices: {
    id: 'voices',
    kind: 'psychosis',
    targetKinds: [],
    avoids: false,
    draws: 0,
    modifiers: [
      { stat: 'creativity', value: 3 },
      { stat: 'wits', value: -3 },
    ],
    confusion: 10,
    fit: fit({
      trigger: { kind: FIT_TRIGGER_KINDS.status, status: 'energy', below: 25 },
      personaId: 'committee',
    }),
  },
}

const tables = {
  root: {
    id: 'root',
    entries: [
      { weight: 1, tableId: 'fears' },
      { weight: 1, markId: 'crush' },
    ],
  },
  fears: { id: 'fears', entries: [{ weight: 1, markId: 'phobia' }] },
  mad: { id: 'mad', entries: [{ weight: 1, markId: 'voices' }] },
}

function subject({ marks: carried = [], stats = {}, blend = null, grooves = {} } = {}) {
  return {
    id: 'p',
    stats: { toughness: { base: 10, modifiers: [], xp: 0 }, ...stats },
    status: { energy: 80, mood: 50 },
    inventory: [],
    intoxications: {},
    blend: blend ?? { weights: [], dominantPersonaId: 'sober', modifierSources: [] },
    psyche: { marks: carried, abilities: [], grooves },
  }
}

function carrying({ markId, target = null, fitTicksRemaining = 0, status = MARK_STATUSES.active }) {
  return {
    id: `${markId}:${target?.id ?? 'none'}`,
    markId,
    target,
    status,
    fitTicksRemaining,
    acquiredAtTick: 0,
    updatedAtTick: 0,
  }
}

const scene = (over = {}) => ({
  locationId: 'home',
  characterIds: [],
  inventory: [],
  intoxications: {},
  conditionIds: [],
  topicIds: [],
  status: { energy: 80, mood: 50 },
  ...over,
})

const parrot = { kind: 'location', id: 'blue_parrot' }
const whiskey = { kind: 'substance', id: 'whiskey' }

// --- psycheTableRoll ---

describe('psycheTableRoll', () => {
  const roll = ({ tableId = 'root', targetKind, values }) =>
    psycheTableRoll({
      tables,
      marks,
      tableId,
      targetKind,
      depthMax: 4,
      rng: rngSequence({ values }),
    })

  it('goes down a nested table to a mark', () => {
    // The first pick lands in the first half (the fears table), which has one mark.
    expect(roll({ targetKind: 'location', values: [0.1, 0.5] }).data.markId).toBe('phobia')
    expect(roll({ targetKind: 'location', values: [0.9] }).data.markId).toBe('crush')
  })

  it('only offers what can be about what did it', () => {
    // A substance can't be feared, only loved: the fears table is not on offer.
    for (const value of [0.01, 0.5, 0.99]) {
      expect(roll({ targetKind: 'substance', values: [value] }).data.markId).toBe('crush')
    }
  })

  it('a mark about nothing can come of anything, and of nothing', () => {
    expect(roll({ tableId: 'mad', targetKind: 'substance', values: [0.5] }).data.markId).toBe(
      'voices'
    )
    expect(roll({ tableId: 'mad', targetKind: null, values: [0.5] }).data.markId).toBe('voices')
  })

  it('comes down to nothing when nothing on it can be about the target', () => {
    expect(roll({ tableId: 'fears', targetKind: 'topic', values: [0.5] }).data.markId).toBeNull()
  })

  it('refuses a table that is not there', () => {
    const result = roll({ tableId: 'nope', targetKind: null, values: [0.5] })
    expect(result.error).toMatchObject({
      code: PSYCHE_ERROR_CODES.tableUnknown,
      params: { tableId: 'nope' },
    })
  })

  it('a branch deeper than it may go is not on offer', () => {
    const roll = (depthMax) =>
      psycheTableRoll({
        tables,
        marks,
        tableId: 'root',
        targetKind: 'location',
        depthMax,
        rng: () => 0.1,
      })
    // One table deep, only the mark on the root itself can be reached.
    expect(roll(1).data.markId).toBe('crush')
    expect(roll(2).data.markId).toBe('phobia')
  })
})

// --- psycheTrauma ---

describe('psycheTrauma', () => {
  const trauma = ({ tableId = 'fears', dc = 11 } = {}) => ({
    save: { stat: 'toughness', dc },
    tableId,
  })
  const hit = ({ who = subject(), target = parrot, values, tableId }) =>
    psycheTrauma({
      tuning,
      subject: who,
      marks,
      tables,
      trauma: trauma({ tableId }),
      target,
      source: { kind: 'event', id: 'cop_hassle' },
      gameTime: { tick: 40 },
      rng: rngSequence({ values }),
    })

  it('a save that holds leaves nothing', () => {
    const result = hit({ values: [PASS] })
    expect(result.data).toMatchObject({ saved: true, mark: null, duplicate: false, marks: [] })
    expect(result.data.check.natural).toBe(20)
  })

  it('a save that fails leaves a mark about what did it, and where it came from', () => {
    const result = hit({ values: [FAIL, 0.5] })
    expect(result.data.saved).toBe(false)
    expect(result.data.mark).toMatchObject({
      markId: 'phobia',
      target: parrot,
      source: { kind: 'event', id: 'cop_hassle' },
      status: MARK_STATUSES.active,
      fitTicksRemaining: 0,
      acquiredAtTick: 40,
      updatedAtTick: 40,
    })
    expect(result.data.marks).toEqual([result.data.mark])
  })

  it('a mark about nothing is about nothing, whatever did it', () => {
    expect(hit({ values: [FAIL, 0.5], tableId: 'mad' }).data.mark.target).toBeNull()
  })

  it('the same mark about the same thing adds nothing', () => {
    const who = subject({ marks: [carrying({ markId: 'phobia', target: parrot })] })
    const result = hit({ who, values: [FAIL, 0.5] })
    expect(result.data).toMatchObject({ saved: false, mark: null, duplicate: true })
    expect(result.data.marks).toHaveLength(1)
  })

  it('the same mark about something else is new', () => {
    const who = subject({ marks: [carrying({ markId: 'phobia', target: parrot })] })
    const result = hit({ who, values: [FAIL, 0.5], target: { kind: 'location', id: 'arbys' } })
    expect(result.data.marks).toHaveLength(2)
  })

  it('does not change the subject it was handed', () => {
    const who = subject()
    hit({ who, values: [FAIL, 0.5] })
    expect(who.psyche.marks).toEqual([])
  })

  it('refuses a save on a stat the subject does not have', () => {
    const result = psycheTrauma({
      tuning,
      subject: subject(),
      marks,
      tables,
      trauma: { save: { stat: 'swagger', dc: 5 }, tableId: 'fears' },
      target: parrot,
      source: { kind: 'event', id: 'x' },
      gameTime: { tick: 0 },
      rng: () => 0,
    })
    expect(result.error).toMatchObject({
      code: PSYCHE_ERROR_CODES.statUnknown,
      params: { stat: 'swagger' },
    })
  })

  it('refuses without a subject', () => {
    const result = psycheTrauma({
      tuning,
      subject: null,
      marks,
      tables,
      trauma: trauma(),
      target: parrot,
      source: { kind: 'event', id: 'x' },
      gameTime: { tick: 0 },
      rng: () => 0,
    })
    expect(result.error.code).toBe(PSYCHE_ERROR_CODES.subjectMissing)
  })
})

// --- psycheGrooveTick ---

describe('psycheGrooveTick', () => {
  const threshold = tuning.psyche.groove.ticksInCharge
  const inCharge = ({ personaId, source, sourceId, grooves = {} }) =>
    subject({
      grooves,
      blend: {
        dominantPersonaId: personaId,
        weights: [{ personaId, weight: 0.8, source, sourceId }],
        modifierSources: [],
      },
    })

  it("the subject's own self wears no groove", () => {
    const result = psycheGrooveTick({ tuning, subject: subject(), ticksElapsed: 5 })
    expect(result.data).toEqual({ grooves: {}, due: null })
  })

  it('time in charge counts toward a groove', () => {
    const who = inCharge({ personaId: 'priest', source: 'substance', sourceId: 'whiskey' })
    expect(psycheGrooveTick({ tuning, subject: who, ticksElapsed: 3 }).data).toEqual({
      grooves: { priest: 3 },
      due: null,
    })
  })

  it('a groove worn through is due, about what put the persona in charge, and starts over', () => {
    const who = inCharge({
      personaId: 'priest',
      source: PERSONA_SOURCES.substance,
      sourceId: 'whiskey',
      grooves: { priest: threshold - 1 },
    })
    expect(psycheGrooveTick({ tuning, subject: who, ticksElapsed: 1 }).data).toEqual({
      grooves: { priest: 0 },
      due: { personaId: 'priest', target: whiskey },
    })
  })

  it('a condition in charge wears a groove about the condition', () => {
    const who = inCharge({
      personaId: 'hollow',
      source: PERSONA_SOURCES.condition,
      sourceId: 'starving',
      grooves: { hollow: threshold },
    })
    expect(psycheGrooveTick({ tuning, subject: who, ticksElapsed: 1 }).data.due.target).toEqual({
      kind: 'condition',
      id: 'starving',
    })
  })

  it("a mark's own fit in charge wears no groove", () => {
    const who = inCharge({ personaId: 'panic', source: PERSONA_SOURCES.mark, sourceId: 'phobia' })
    expect(psycheGrooveTick({ tuning, subject: who, ticksElapsed: 5 }).data.grooves).toEqual({})
  })

  it('refuses time running backwards', () => {
    const result = psycheGrooveTick({ tuning, subject: subject(), ticksElapsed: -1 })
    expect(result.error.code).toBe(PSYCHE_ERROR_CODES.ticksInvalid)
  })
})

// --- psycheFitsTick ---

describe('psycheFitsTick', () => {
  const tick = ({ carried, here = scene(), ticksElapsed = 1, values = [0] }) =>
    psycheFitsTick({
      subject: subject({ marks: carried }),
      marks,
      scene: here,
      ticksElapsed,
      gameTime: { tick: 7 },
      rng: rngSequence({ values }),
    })

  it('a mark whose target is here may go off', () => {
    const phobia = carrying({ markId: 'phobia', target: parrot })
    const result = tick({ carried: [phobia], here: scene({ locationId: 'blue_parrot' }) })
    expect(result.data.startedIds).toEqual([phobia.id])
    expect(result.data.marks[0]).toMatchObject({ fitTicksRemaining: 2, updatedAtTick: 7 })
  })

  it('it goes off only at its chance', () => {
    const phobia = carrying({ markId: 'phobia', target: parrot })
    const result = tick({
      carried: [phobia],
      here: scene({ locationId: 'blue_parrot' }),
      values: [0.6],
    })
    expect(result.data.startedIds).toEqual([])
  })

  it('every tick the trigger held is a chance', () => {
    // 0.6 misses one tick at 0.5, but three ticks make it 0.875.
    const phobia = carrying({ markId: 'phobia', target: parrot })
    const result = tick({
      carried: [phobia],
      here: scene({ locationId: 'blue_parrot' }),
      ticksElapsed: 3,
      values: [0.6],
    })
    expect(result.data.startedIds).toEqual([phobia.id])
  })

  it('somewhere else, nothing goes off', () => {
    const result = tick({ carried: [carrying({ markId: 'phobia', target: parrot })] })
    expect(result.data.startedIds).toEqual([])
  })

  it('a person, a thing in hand, a drug in you, a topic in the air: each is a target here', () => {
    const cases = [
      [{ kind: 'character', id: 'dale' }, scene({ characterIds: ['dale'] })],
      [{ kind: 'item', id: 'knife' }, scene({ inventory: [{ id: 'knife', quantity: 1 }] })],
      [whiskey, scene({ intoxications: { whiskey: 10 } })],
      [{ kind: 'topic', id: 'kiss' }, scene({ topicIds: ['kiss'] })],
      [{ kind: 'condition', id: 'starving' }, scene({ conditionIds: ['starving'] })],
    ]
    for (const [target, here] of cases) {
      const marked = carrying({ markId: 'phobia', target })
      expect(tick({ carried: [marked], here }).data.startedIds, target.kind).toEqual([marked.id])
    }
  })

  it('a vital past its line sets a fit off; short of it, nothing', () => {
    const voices = carrying({ markId: 'voices' })
    const tired = tick({ carried: [voices], here: scene({ status: { energy: 20 } }) })
    const fine = tick({ carried: [voices], here: scene({ status: { energy: 30 } }) })
    expect(tired.data.startedIds).toEqual([voices.id])
    expect(fine.data.startedIds).toEqual([])
  })

  it('being alone, or being with somebody, can each set a fit off', () => {
    const alone = { ...marks.phobia, fit: fit({ trigger: { kind: FIT_TRIGGER_KINDS.alone } }) }
    const company = { ...marks.phobia, fit: fit({ trigger: { kind: FIT_TRIGGER_KINDS.company } }) }
    const run = ({ definition, characterIds }) =>
      psycheFitsTick({
        subject: subject({ marks: [carrying({ markId: 'x' })] }),
        marks: { x: definition },
        scene: scene({ characterIds }),
        ticksElapsed: 1,
        gameTime: { tick: 1 },
        rng: () => 0,
      }).data.startedIds.length
    expect(run({ definition: alone, characterIds: [] })).toBe(1)
    expect(run({ definition: alone, characterIds: ['dale'] })).toBe(0)
    expect(run({ definition: company, characterIds: ['dale'] })).toBe(1)
    expect(run({ definition: company, characterIds: [] })).toBe(0)
  })

  it('a fit runs its course, and ends', () => {
    const inFit = carrying({ markId: 'phobia', target: parrot, fitTicksRemaining: 2 })
    const once = tick({ carried: [inFit], here: scene({ locationId: 'blue_parrot' }) })
    expect(once.data.marks[0].fitTicksRemaining).toBe(1)
    expect(once.data.endedIds).toEqual([])
    const twice = tick({ carried: [inFit], ticksElapsed: 5 })
    expect(twice.data.marks[0].fitTicksRemaining).toBe(0)
    expect(twice.data.endedIds).toEqual([inFit.id])
    expect(twice.data.startedIds).toEqual([])
  })

  it('a mark that is not active, or has no fit, never goes off', () => {
    const cured = carrying({ markId: 'phobia', target: parrot, status: 'cured' })
    const crush = carrying({ markId: 'crush', target: parrot })
    const result = tick({ carried: [cured, crush], here: scene({ locationId: 'blue_parrot' }) })
    expect(result.data.startedIds).toEqual([])
  })

  it('refuses time running backwards', () => {
    const result = tick({ carried: [], ticksElapsed: -1 })
    expect(result.error.code).toBe(PSYCHE_ERROR_CODES.ticksInvalid)
  })
})

// --- psycheAvoids / psycheDraw ---

describe('psycheAvoids', () => {
  it('is the mark that will not let the subject near the target', () => {
    const phobia = carrying({ markId: 'phobia', target: parrot })
    const who = subject({ marks: [phobia] })
    expect(psycheAvoids({ subject: who, marks, target: parrot })).toBe(phobia)
    expect(psycheAvoids({ subject: who, marks, target: { kind: 'location', id: 'arbys' } })).toBe(
      null
    )
  })

  it('a mark that does not avoid, or is not active, lets them go', () => {
    const who = subject({
      marks: [
        carrying({ markId: 'crush', target: parrot }),
        carrying({ markId: 'phobia', target: parrot, status: 'cured' }),
      ],
    })
    expect(psycheAvoids({ subject: who, marks, target: parrot })).toBeNull()
  })
})

describe('psycheDraw', () => {
  const who = (target) => subject({ marks: [carrying({ markId: 'crush', target })] })

  it('pulls toward what an action is about, by kind of thing', () => {
    const cases = [
      [parrot, { locationId: 'blue_parrot' }],
      [{ kind: 'character', id: 'dale' }, { characterId: 'dale' }],
      [{ kind: 'item', id: 'knife' }, { requirements: { requiredItems: ['knife'] } }],
      [{ kind: 'item', id: 'knife' }, { success: { itemsGained: ['knife'] } }],
      [whiskey, { success: { doses: [{ substanceId: 'whiskey', value: 5 }] } }],
      [{ kind: 'topic', id: 'kiss' }, { topicIds: ['kiss'] }],
    ]
    for (const [target, action] of cases) {
      expect(psycheDraw({ subject: who(target), marks, action }), target.kind).toBe(0.5)
    }
  })

  it('does not pull toward what an action is not about', () => {
    expect(psycheDraw({ subject: who(parrot), marks, action: { locationId: 'arbys' } })).toBe(0)
  })

  it('pulls add up', () => {
    const both = subject({
      marks: [
        carrying({ markId: 'crush', target: parrot }),
        carrying({ markId: 'crush', target: whiskey }),
      ],
    })
    const action = {
      locationId: 'blue_parrot',
      success: { doses: [{ substanceId: 'whiskey', value: 5 }] },
    }
    expect(psycheDraw({ subject: both, marks, action })).toBe(1)
  })
})

// --- psycheBlendSources, into the blend ---

describe('psycheBlendSources', () => {
  it("a mark's standing effect bends stats and confusion, with no persona", () => {
    const who = subject({ marks: [carrying({ markId: 'voices' })] })
    expect(psycheBlendSources({ subject: who, marks })).toEqual([
      {
        sourceId: 'voices',
        personaId: null,
        weight: 0,
        modifiers: marks.voices.modifiers,
        confusion: 10,
      },
    ])
  })

  it('a mark in a fit shoves its persona into the blend, and the blend lurches', () => {
    const who = subject({
      marks: [carrying({ markId: 'phobia', target: parrot, fitTicksRemaining: 1 })],
    })
    const sources = psycheBlendSources({ subject: who, marks })
    expect(sources.at(-1)).toMatchObject({ personaId: 'panic', weight: 0.6, confusion: 20 })

    const blend = blendCompute({ player: who, psyche: sources }).data
    expect(blend.dominantPersonaId).toBe('panic')
    expect(blend.weights).toContainEqual({
      personaId: 'panic',
      weight: 0.6,
      source: PERSONA_SOURCES.mark,
      sourceId: 'phobia',
    })
    expect(blend.modifiers).toEqual({ stamina: 3, wits: -5 })
    expect(blend.confusion).toBe(20)
  })

  it('a mark that is not active puts nothing in', () => {
    const who = subject({ marks: [carrying({ markId: 'voices', status: 'cured' })] })
    expect(psycheBlendSources({ subject: who, marks })).toEqual([])
  })
})
