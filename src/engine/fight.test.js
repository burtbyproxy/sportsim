import { describe, it, expect } from 'vitest'
import {
  FIGHT_CHOICES,
  FIGHT_ENDINGS,
  FIGHT_ERROR_CODES,
  FIGHT_EVENTS,
  FIGHT_PHASES,
  FIGHT_SIDES,
  fightActive,
  fightOffer,
  fightResolve,
  fightSquareRound,
  fightStart,
} from './fight.js'
import { tuningContent } from '../../tests/helpers/content.js'
import { rngForNatural } from '../../tests/helpers/rng.js'

const tuning = tuningContent()
// One constant roll: every contest is the same natural for both sides, so the stats decide.
const EVEN = rngForNatural({ natural: 10 })
// A roll that never lands a chance (the bystanders never pull anyone apart).
const NEVER = 0.999

// --- Fixtures ---

const stat = (base) => ({ base, modifiers: [], xp: 0 })
const person = ({ id, wits = 10, toughness = 10, charm = 10, stamina = 10, dazed = 0 }) => ({
  id,
  name: id,
  stats: {
    wits: stat(wits),
    toughness: stat(toughness),
    charm: stat(charm),
    stamina: stat(stamina),
  },
  dazed,
  fights: [],
})

const fightDef = {
  id: 'test_fight',
  display: 'A fight',
  jabs: [
    {
      id: 'needle',
      label: 'Needle {name}',
      stat: 'wits',
      opposedStat: 'wits',
      heat: 40,
      lineWon: 'w',
      lineLost: 'l',
    },
  ],
  swing: { label: 'Swing', lines: { you: 's', them: 's2', others: 's3' } },
  walk: { label: 'Walk', lineCode: 'k', statusChanges: { mood: -5 } },
  lines: {},
  watched: null,
}

const at = (tick = 5) => ({ tick })

function started({ first, second }) {
  return fightStart({ fightDef, first, second, locationId: 'bar', gameTime: at() }).data.fight
}

describe('fightStart — somebody starts something', () => {
  it('needs two sides and a fight', () => {
    const me = person({ id: 'me' })
    expect(
      fightStart({ fightDef, first: me, second: null, locationId: 'bar', gameTime: at() }).error
        .code
    ).toBe(FIGHT_ERROR_CODES.subjectMissing)
    expect(
      fightStart({
        fightDef: null,
        first: me,
        second: person({ id: 'd' }),
        locationId: 'bar',
        gameTime: at(),
      }).error.code
    ).toBe(FIGHT_ERROR_CODES.fightMissing)
  })

  it("puts the fight on the starter's record, squaring off, cold, and finds it active", () => {
    const me = person({ id: 'me' })
    const result = fightStart({
      fightDef,
      first: me,
      second: person({ id: 'd' }),
      locationId: 'bar',
      gameTime: at(3),
    })
    expect(result.ok).toBe(true)
    const { fight, fights } = result.data
    expect(fights).toEqual([fight])
    expect(fight).toMatchObject({
      fightId: 'test_fight',
      firstId: 'me',
      secondId: 'd',
      locationId: 'bar',
      phase: FIGHT_PHASES.squaring,
      round: 1,
      heat: { first: 0, second: 0 },
      swungFirst: null,
      ending: null,
      winner: null,
      startedAtTick: 3,
    })
    expect(fightActive({ subject: { ...me, fights } })).toBe(fight)
    expect(fightActive({ subject: me })).toBeNull()
  })

  it('started swinging, it skips the squaring off: the starter has already cracked', () => {
    const me = person({ id: 'me' })
    const result = fightStart({
      fightDef,
      first: me,
      second: person({ id: 'd' }),
      locationId: 'bar',
      gameTime: at(),
      swinging: true,
    })
    expect(result.data.fight).toMatchObject({
      phase: FIGHT_PHASES.swinging,
      swungFirst: FIGHT_SIDES.first,
    })
  })

  it('one at a time', () => {
    const me = person({ id: 'me' })
    const fight = started({ first: me, second: person({ id: 'd' }) })
    const again = fightStart({
      fightDef,
      first: { ...me, fights: [fight] },
      second: person({ id: 'd' }),
      locationId: 'bar',
      gameTime: at(),
    })
    expect(again.error.code).toBe(FIGHT_ERROR_CODES.alreadyFighting)
  })
})

describe('fightOffer — what there is to do while squaring off', () => {
  it('every jab, the swing, and the walk, with the name left to fill', () => {
    const fight = started({ first: person({ id: 'me' }), second: person({ id: 'd' }) })
    expect(fightOffer({ fightDef, fight }).data.choices).toEqual([
      { id: 'needle', label: 'Needle {name}', kind: 'jab' },
      { id: FIGHT_CHOICES.swing, label: 'Swing', kind: 'swing' },
      { id: FIGHT_CHOICES.walk, label: 'Walk', kind: 'walk' },
    ])
  })

  it('nothing to choose once somebody has swung', () => {
    const fight = {
      ...started({ first: person({ id: 'me' }), second: person({ id: 'd' }) }),
      phase: FIGHT_PHASES.swinging,
    }
    expect(fightOffer({ fightDef, fight }).error.code).toBe(FIGHT_ERROR_CODES.phaseWrong)
  })
})

describe('fightSquareRound — insults, antagonizing', () => {
  const me = person({ id: 'me', wits: 40 })
  const dennis = person({ id: 'd', wits: 10 })
  const round = ({ fight, first = me, second = dennis, choiceId = 'needle', rng = () => EVEN }) =>
    fightSquareRound({ tuning, fightDef, fight, first, second, choiceId, gameTime: at(9), rng })

  it('refuses a choice that is not on offer, and a fight not squaring off', () => {
    const fight = started({ first: me, second: dennis })
    expect(round({ fight, choiceId: 'headbutt' }).error.code).toBe(FIGHT_ERROR_CODES.choiceUnknown)
    expect(round({ fight: { ...fight, phase: FIGHT_PHASES.over } }).error.code).toBe(
      FIGHT_ERROR_CODES.phaseWrong
    )
  })

  it("the jab's winner puts its heat on the loser, and the round heats both; the round counts", () => {
    const fight = started({ first: me, second: dennis })
    const result = round({ fight })
    expect(result.data.jabWon).toBe(true)
    expect(result.data.fight.heat).toEqual({
      first: tuning.fight.heatPerRound,
      second: 40 + tuning.fight.heatPerRound,
    })
    expect(result.data.fight.round).toBe(2)
    expect(result.data.fight.phase).toBe(FIGHT_PHASES.squaring)
    expect(result.data.events).toEqual([
      { kind: FIGHT_EVENTS.jab, side: FIGHT_SIDES.first, jabId: 'needle' },
    ])
    expect(result.data.cracked).toBeNull()
    expect(result.data.fight.updatedAtTick).toBe(9)
    // The other way round.
    const lost = round({ fight, first: dennis, second: me })
    expect(lost.data.jabWon).toBe(false)
    expect(lost.data.fight.heat.first).toBe(40 + tuning.fight.heatPerRound)
    expect(lost.data.events).toEqual([
      { kind: FIGHT_EVENTS.jab, side: FIGHT_SIDES.second, jabId: 'needle' },
    ])
  })

  it('the side whose heat reaches the line cracks and swings first; the hotter side, at a dead heat the starter', () => {
    const fight = started({ first: me, second: dennis })
    const hot = { ...fight, heat: { first: 0, second: tuning.fight.crackAt - 41 } }
    const them = round({ fight: hot })
    expect(them.data.cracked).toBe(FIGHT_SIDES.second)
    expect(them.data.fight).toMatchObject({
      phase: FIGHT_PHASES.swinging,
      swungFirst: FIGHT_SIDES.second,
    })
    expect(them.data.events.at(-1)).toEqual({
      kind: FIGHT_EVENTS.cracked,
      side: FIGHT_SIDES.second,
    })

    const both = round({
      fight: { ...fight, heat: { first: tuning.fight.crackAt, second: tuning.fight.crackAt - 50 } },
    })
    expect(both.data.cracked).toBe(FIGHT_SIDES.first)
    expect(both.data.events.at(-1)).toEqual({ kind: FIGHT_EVENTS.cracked, side: FIGHT_SIDES.first })
  })

  it('walking ends it with nobody winning; swinging first is the swinging, on the starter', () => {
    const fight = started({ first: me, second: dennis })
    const walked = round({ fight, choiceId: FIGHT_CHOICES.walk })
    expect(walked.data.fight).toMatchObject({
      phase: FIGHT_PHASES.over,
      ending: FIGHT_ENDINGS.walked,
      winner: null,
    })
    expect(walked.data.events).toEqual([{ kind: FIGHT_EVENTS.walked, side: FIGHT_SIDES.first }])
    const swung = round({ fight, choiceId: FIGHT_CHOICES.swing })
    expect(swung.data.fight).toMatchObject({
      phase: FIGHT_PHASES.swinging,
      swungFirst: FIGHT_SIDES.first,
    })
    expect(swung.data.events).toEqual([{ kind: FIGHT_EVENTS.swungFirst, side: FIGHT_SIDES.first }])
  })

  it('needs the stats it contests', () => {
    const fight = started({ first: me, second: dennis })
    const witless = { ...dennis, stats: { toughness: stat(10) } }
    expect(round({ fight, second: witless }).error).toMatchObject({
      code: FIGHT_ERROR_CODES.statUnknown,
      params: { stat: 'wits' },
    })
  })
})

describe('fightResolve — the frantic moment, and the ground', () => {
  const swinging = ({ first, second, swungFirst }) => ({
    ...started({ first, second }),
    phase: FIGHT_PHASES.swinging,
    swungFirst,
  })
  const resolve = ({ fight, first, second, bystanders = 0, rng = () => EVEN }) =>
    fightResolve({ tuning, fight, first, second, bystanders, gameTime: at(12), rng })

  it('refuses a fight nobody has swung in', () => {
    const me = person({ id: 'me' })
    const fight = started({ first: me, second: person({ id: 'd' }) })
    expect(resolve({ fight, first: me, second: person({ id: 'd' }) }).error.code).toBe(
      FIGHT_ERROR_CODES.phaseWrong
    )
  })

  it('the first swing is a penalty: even sides, and the one who swung first loses the swing', () => {
    // Even stats, even roll: the penalty on the swinger decides it.
    const me = person({ id: 'me', toughness: 20, stamina: 30 })
    const dennis = person({ id: 'd', toughness: 20, stamina: 10 })
    const result = resolve({
      fight: swinging({ first: me, second: dennis, swungFirst: FIGHT_SIDES.second }),
      first: me,
      second: dennis,
    })
    expect(result.ok).toBe(true)
    expect(result.data.events).toEqual([
      { kind: FIGHT_EVENTS.landed, side: FIGHT_SIDES.first },
      { kind: FIGHT_EVENTS.onTop, side: FIGHT_SIDES.first },
    ])
    // The swing's knock, then the ground's: the stronger side stays on top.
    expect(result.data.dazed).toEqual({
      first: 0,
      second: tuning.fight.swing.dazedOnHit + tuning.fight.ground.dazedOnTop,
    })
    expect(result.data.fight).toMatchObject({
      ending: FIGHT_ENDINGS.onTop,
      winner: FIGHT_SIDES.first,
    })
  })

  it('a knock past the line is a knockout where they fell', () => {
    const me = person({ id: 'me', toughness: 30 })
    const groggy = person({
      id: 'd',
      toughness: 10,
      dazed: tuning.fight.knockoutAt - tuning.fight.swing.dazedOnHit,
    })
    const result = resolve({
      fight: swinging({ first: me, second: groggy, swungFirst: FIGHT_SIDES.second }),
      first: me,
      second: groggy,
    })
    expect(result.data.fight).toMatchObject({
      phase: FIGHT_PHASES.over,
      ending: FIGHT_ENDINGS.knockout,
      winner: FIGHT_SIDES.first,
    })
    expect(result.data.loser).toBe(FIGHT_SIDES.second)
    expect(result.data.events).toEqual([
      { kind: FIGHT_EVENTS.landed, side: FIGHT_SIDES.first },
      { kind: FIGHT_EVENTS.knockout, side: FIGHT_SIDES.second },
    ])
    expect(result.data.dazed).toEqual({ first: 0, second: tuning.fight.swing.dazedOnHit })
  })

  it('otherwise the ground: the stronger side ends up on top, and the bottom takes a knock', () => {
    const me = person({ id: 'me', toughness: 30, stamina: 10 })
    const dennis = person({ id: 'd', toughness: 10, stamina: 40 })
    const result = resolve({
      fight: swinging({ first: me, second: dennis, swungFirst: FIGHT_SIDES.second }),
      first: me,
      second: dennis,
    })
    expect(result.data.fight).toMatchObject({
      ending: FIGHT_ENDINGS.onTop,
      winner: FIGHT_SIDES.second,
    })
    expect(result.data.fight.ground.second).toBe(tuning.fight.ground.onTopAt)
    expect(result.data.loser).toBe(FIGHT_SIDES.first)
    expect(result.data.events).toEqual([
      { kind: FIGHT_EVENTS.landed, side: FIGHT_SIDES.first },
      { kind: FIGHT_EVENTS.onTop, side: FIGHT_SIDES.second },
    ])
    expect(result.data.dazed).toEqual({
      first: tuning.fight.ground.dazedOnTop,
      second: tuning.fight.swing.dazedOnHit,
    })
  })

  it('whoever is there can pull them apart, and then nobody won', () => {
    const me = person({ id: 'me', toughness: 30 })
    const dennis = person({ id: 'd', toughness: 10, stamina: 40 })
    // The pull is rolled first on the ground; a roll under the chance lands it.
    const chance = tuning.fight.ground.pulledApartChancePerBystander
    const result = resolve({
      fight: swinging({ first: me, second: dennis, swungFirst: FIGHT_SIDES.first }),
      first: me,
      second: dennis,
      bystanders: 2,
      rng: () => chance * 2 - 0.01,
    })
    expect(result.data.fight).toMatchObject({ ending: FIGHT_ENDINGS.pulledApart, winner: null })
    expect(result.data.loser).toBeNull()
    expect(result.data.events.at(-1)).toEqual({ kind: FIGHT_EVENTS.pulledApart, side: null })
    const nobody = resolve({
      fight: swinging({ first: me, second: dennis, swungFirst: FIGHT_SIDES.first }),
      first: me,
      second: dennis,
      bystanders: 0,
      rng: () => NEVER,
    })
    expect(nobody.data.fight.ending).not.toBe(FIGHT_ENDINGS.pulledApart)
  })
})
