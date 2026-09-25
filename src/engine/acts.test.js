import { describe, it, expect } from 'vitest'
import {
  ACT_AUTHOR_KINDS,
  ACT_ERROR_CODES,
  ACT_RECIPIENT_KINDS,
  SUBJECT_KINDS,
  actResolve,
  actsRoll,
} from './acts.js'
import { FIT_TRIGGER_KINDS, MARK_STATUSES } from './psyche.js'
import { CONTEST_WINNERS } from './dice.js'
import { tuningContent } from '../../tests/helpers/content.js'
import { rngForNatural, rngSequence } from '../../tests/helpers/rng.js'

const tuning = tuningContent()
const LOW = rngForNatural({ natural: 1 })
const HIGH = rngForNatural({ natural: 20 })
// A chance roll that lands, and one that misses everything short of certain.
const LANDS = 0
const MISSES = 0.999

// --- Fixtures ---

const stat = (base) => ({ base, modifiers: [], xp: 0 })

function person({ id = 'dennis', personaId = 'sober', marks = [], stats = {} } = {}) {
  return {
    id,
    name: id,
    stats: { charm: stat(10), wits: stat(10), ...stats },
    blend: { dominantPersonaId: personaId, weights: [] },
    psyche: { marks, abilities: [], grooves: {} },
    status: { mood: 50, energy: 50 },
  }
}

const inFit = ({ markId, target, ticks = 2 }) => ({
  id: `${markId}:${target?.id ?? 'none'}`,
  markId,
  target,
  source: { kind: 'test', id: 'test' },
  status: MARK_STATUSES.active,
  fitTicksRemaining: ticks,
  acquiredAtTick: 0,
  updatedAtTick: 0,
})

const branch = (name) => ({
  outcome: { statusChanges: { mood: -5 } },
  outcomeAuthor: { statusChanges: { mood: 2 } },
  lineCode: `act.${name}`,
  lineCodeOthers: `act.${name}.them`,
})

function act({
  id = 'snap',
  author = { kind: ACT_AUTHOR_KINDS.mark, id: 'grudge' },
  trigger = null,
  to = ACT_RECIPIENT_KINDS.anyone,
  chancePerTick = 0.5,
  check = null,
} = {}) {
  return {
    id,
    display: id,
    author,
    trigger,
    to,
    chancePerTick,
    check,
    success: branch(`${id}.success`),
    failure: check ? branch(`${id}.failure`) : null,
  }
}

function scene({ characterIds = [], playerId = null, topicIds = [], status = null } = {}) {
  return {
    locationId: 'bar',
    characterIds,
    playerId,
    inventory: [],
    intoxications: {},
    conditionIds: [],
    topicIds,
    status,
  }
}

const kiss = { kind: 'topic', id: 'kiss' }

// --- actsRoll ---

describe('actsRoll — who does what, and to whom', () => {
  it('refuses without an author, or with time running backwards', () => {
    const missing = actsRoll({
      acts: [],
      author: null,
      scene: scene(),
      ticksElapsed: 1,
      rng: () => 0,
    })
    expect(missing.ok).toBe(false)
    expect(missing.error.code).toBe(ACT_ERROR_CODES.authorMissing)
    const backwards = actsRoll({
      acts: [],
      author: person(),
      scene: scene(),
      ticksElapsed: -1,
      rng: () => 0,
    })
    expect(backwards.ok).toBe(false)
    expect(backwards.error.code).toBe(ACT_ERROR_CODES.ticksInvalid)
  })

  it('a mark author is anyone with that mark in a fit, and the act is about its target', () => {
    const grudge = act()
    const marked = person({ marks: [inFit({ markId: 'grudge', target: kiss })] })
    const rolled = actsRoll({
      acts: [grudge],
      author: marked,
      scene: scene({ characterIds: ['greg'] }),
      ticksElapsed: 1,
      rng: () => LANDS,
    })
    expect(rolled.ok).toBe(true)
    expect(rolled.data.act).toBe(grudge)
    expect(rolled.data.mark.target).toEqual(kiss)
    expect(rolled.data.recipient).toEqual({ kind: SUBJECT_KINDS.character, id: 'greg' })
  })

  it('the same mark, not in a fit, authors nothing', () => {
    const calm = person({ marks: [inFit({ markId: 'grudge', target: kiss, ticks: 0 })] })
    const rolled = actsRoll({
      acts: [act()],
      author: calm,
      scene: scene({ characterIds: ['greg'] }),
      ticksElapsed: 1,
      rng: () => LANDS,
    })
    expect(rolled.data.act).toBeNull()
  })

  it('a persona author is anyone with that persona in charge', () => {
    const yells = act({ author: { kind: ACT_AUTHOR_KINDS.persona, id: 'yeller' } })
    const loud = person({ personaId: 'yeller' })
    const quiet = person({ personaId: 'sober' })
    const here = scene({ characterIds: ['greg'] })
    expect(
      actsRoll({ acts: [yells], author: loud, scene: here, ticksElapsed: 1, rng: () => LANDS }).data
        .act
    ).toBe(yells)
    expect(
      actsRoll({ acts: [yells], author: quiet, scene: here, ticksElapsed: 1, rng: () => LANDS })
        .data.act
    ).toBeNull()
  })

  it('a character author is that one person', () => {
    const holdsForth = act({
      author: { kind: ACT_AUTHOR_KINDS.character, id: 'dennis' },
      to: ACT_RECIPIENT_KINDS.player,
    })
    const here = scene({ characterIds: ['you'], playerId: 'you' })
    expect(
      actsRoll({
        acts: [holdsForth],
        author: person({ id: 'dennis' }),
        scene: here,
        ticksElapsed: 1,
        rng: () => LANDS,
      }).data.act
    ).toBe(holdsForth)
    expect(
      actsRoll({
        acts: [holdsForth],
        author: person({ id: 'greg' }),
        scene: here,
        ticksElapsed: 1,
        rng: () => LANDS,
      }).data.act
    ).toBeNull()
  })

  it("a trigger has to hold in the author's own scene", () => {
    const withCompany = act({
      author: { kind: ACT_AUTHOR_KINDS.character, id: 'dennis' },
      trigger: { kind: FIT_TRIGGER_KINDS.company },
      to: ACT_RECIPIENT_KINDS.none,
    })
    const alone = actsRoll({
      acts: [withCompany],
      author: person(),
      scene: scene(),
      ticksElapsed: 1,
      rng: () => LANDS,
    })
    expect(alone.data.act).toBeNull()
    const company = actsRoll({
      acts: [withCompany],
      author: person(),
      scene: scene({ characterIds: ['greg'] }),
      ticksElapsed: 1,
      rng: () => LANDS,
    })
    expect(company.data.act).toBe(withCompany)
  })

  it("a target trigger reads the author's mark: what it is about has to be there", () => {
    const onSight = act({
      trigger: { kind: FIT_TRIGGER_KINDS.target },
      to: ACT_RECIPIENT_KINDS.none,
    })
    const marked = person({ marks: [inFit({ markId: 'grudge', target: kiss })] })
    const silent = actsRoll({
      acts: [onSight],
      author: marked,
      scene: scene(),
      ticksElapsed: 1,
      rng: () => LANDS,
    })
    expect(silent.data.act).toBeNull()
    const spoken = actsRoll({
      acts: [onSight],
      author: marked,
      scene: scene({ topicIds: ['kiss'] }),
      ticksElapsed: 1,
      rng: () => LANDS,
    })
    expect(spoken.data.act).toBe(onSight)
  })

  it('done to the player: only when the player is there', () => {
    const atYou = act({ to: ACT_RECIPIENT_KINDS.player })
    const marked = person({ marks: [inFit({ markId: 'grudge', target: kiss })] })
    const without = actsRoll({
      acts: [atYou],
      author: marked,
      scene: scene({ characterIds: ['greg'] }),
      ticksElapsed: 1,
      rng: () => LANDS,
    })
    expect(without.data.act).toBeNull()
    const withYou = actsRoll({
      acts: [atYou],
      author: marked,
      scene: scene({ characterIds: ['greg', 'you'], playerId: 'you' }),
      ticksElapsed: 1,
      rng: () => LANDS,
    })
    expect(withYou.data.recipient).toEqual({ kind: SUBJECT_KINDS.player, id: 'you' })
  })

  it("done to the mark's target: that person, when the mark is about a person who is there", () => {
    const atThem = act({ to: ACT_RECIPIENT_KINDS.target })
    const aboutGreg = person({
      marks: [inFit({ markId: 'grudge', target: { kind: 'character', id: 'greg' } })],
    })
    const aboutKiss = person({ marks: [inFit({ markId: 'grudge', target: kiss })] })
    const roll = ({ author, here }) =>
      actsRoll({ acts: [atThem], author, scene: here, ticksElapsed: 1, rng: () => LANDS }).data
    expect(
      roll({ author: aboutGreg, here: scene({ characterIds: ['greg', 'you'], playerId: 'you' }) })
        .recipient
    ).toEqual({ kind: SUBJECT_KINDS.character, id: 'greg' })
    expect(
      roll({ author: aboutGreg, here: scene({ characterIds: ['you'], playerId: 'you' }) }).act
    ).toBeNull()
    expect(roll({ author: aboutKiss, here: scene({ characterIds: ['greg'] }) }).act).toBeNull()
  })

  it('done to anyone: whoever is there, the player included, and nobody when nobody is', () => {
    const atAnyone = act({ to: ACT_RECIPIENT_KINDS.anyone })
    const marked = person({ marks: [inFit({ markId: 'grudge', target: kiss })] })
    const here = scene({ characterIds: ['greg', 'you'], playerId: 'you' })
    // The pick comes first, then the chance.
    const first = actsRoll({
      acts: [atAnyone],
      author: marked,
      scene: here,
      ticksElapsed: 1,
      rng: rngSequence({ values: [0.1, LANDS] }),
    })
    expect(first.data.recipient).toEqual({ kind: SUBJECT_KINDS.character, id: 'greg' })
    const second = actsRoll({
      acts: [atAnyone],
      author: marked,
      scene: here,
      ticksElapsed: 1,
      rng: rngSequence({ values: [0.9, LANDS] }),
    })
    expect(second.data.recipient).toEqual({ kind: SUBJECT_KINDS.player, id: 'you' })
    const empty = actsRoll({
      acts: [atAnyone],
      author: marked,
      scene: scene(),
      ticksElapsed: 1,
      rng: () => LANDS,
    })
    expect(empty.data.act).toBeNull()
  })

  it('done to nobody needs nobody', () => {
    const toSelf = act({ to: ACT_RECIPIENT_KINDS.none })
    const marked = person({ marks: [inFit({ markId: 'grudge', target: kiss })] })
    const rolled = actsRoll({
      acts: [toSelf],
      author: marked,
      scene: scene(),
      ticksElapsed: 1,
      rng: () => LANDS,
    })
    expect(rolled.data.act).toBe(toSelf)
    expect(rolled.data.recipient).toBeNull()
  })

  it('the chance is per tick, and adds up over ticks', () => {
    const rare = act({ to: ACT_RECIPIENT_KINDS.none, chancePerTick: 0.5 })
    const marked = person({ marks: [inFit({ markId: 'grudge', target: kiss })] })
    // Over one tick 0.6 misses a 0.5 chance; over three ticks the chance is 0.875 and 0.6 lands.
    const one = actsRoll({
      acts: [rare],
      author: marked,
      scene: scene(),
      ticksElapsed: 1,
      rng: () => 0.6,
    })
    expect(one.data.act).toBeNull()
    const three = actsRoll({
      acts: [rare],
      author: marked,
      scene: scene(),
      ticksElapsed: 3,
      rng: () => 0.6,
    })
    expect(three.data.act).toBe(rare)
  })

  it('a chance that misses is no act', () => {
    const marked = person({ marks: [inFit({ markId: 'grudge', target: kiss })] })
    const rolled = actsRoll({
      acts: [act({ to: ACT_RECIPIENT_KINDS.none })],
      author: marked,
      scene: scene(),
      ticksElapsed: 1,
      rng: () => MISSES,
    })
    expect(rolled.data.act).toBeNull()
  })

  it('one act per author per tick: the first that goes off', () => {
    const first = act({ id: 'first', to: ACT_RECIPIENT_KINDS.none })
    const second = act({ id: 'second', to: ACT_RECIPIENT_KINDS.none })
    const marked = person({ marks: [inFit({ markId: 'grudge', target: kiss })] })
    const rolled = actsRoll({
      acts: [first, second],
      author: marked,
      scene: scene(),
      ticksElapsed: 1,
      rng: rngSequence({ values: [MISSES, LANDS] }),
    })
    expect(rolled.data.act).toBe(second)
  })
})

// --- actResolve ---

describe('actResolve — what comes of it', () => {
  const marked = person({ marks: [inFit({ markId: 'grudge', target: kiss })] })

  it('refuses without an author', () => {
    const result = actResolve({ tuning, act: act(), author: null, recipient: null, rng: () => 0 })
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe(ACT_ERROR_CODES.authorMissing)
  })

  it('without a check it simply comes off: the success branch, no contest', () => {
    const plain = act()
    const result = actResolve({
      tuning,
      act: plain,
      author: marked,
      recipient: person({ id: 'greg' }),
      rng: () => 0,
    })
    expect(result.ok).toBe(true)
    expect(result.data).toEqual({ succeeded: true, branch: plain.success, contest: null })
  })

  it('a check with nobody to check against is a contract violation, not a roll', () => {
    const contested = act({ check: { stat: 'charm', opposedStat: 'wits' } })
    const result = actResolve({
      tuning,
      act: contested,
      author: marked,
      recipient: null,
      rng: () => 0,
    })
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe(ACT_ERROR_CODES.recipientMissing)
  })

  it('a check needs both stats to exist', () => {
    const contested = act({ check: { stat: 'charm', opposedStat: 'nerve' } })
    const result = actResolve({
      tuning,
      act: contested,
      author: marked,
      recipient: person({ id: 'greg' }),
      rng: () => 0,
    })
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe(ACT_ERROR_CODES.statUnknown)
    expect(result.error.params).toEqual({ stat: 'nerve', actId: 'snap' })
  })

  it("a contest the author takes is the success branch; the author's roll is first", () => {
    const contested = act({ check: { stat: 'charm', opposedStat: 'wits' } })
    const result = actResolve({
      tuning,
      act: contested,
      author: marked,
      recipient: person({ id: 'greg' }),
      rng: rngSequence({ values: [HIGH, LOW] }),
    })
    expect(result.data.succeeded).toBe(true)
    expect(result.data.branch).toBe(contested.success)
    expect(result.data.contest.winner).toBe(CONTEST_WINNERS.first)
    expect(result.data.contest.first.stat).toBe('charm')
    expect(result.data.contest.second.stat).toBe('wits')
  })

  it('a contest the recipient holds is the failure branch, and so is a tie', () => {
    const contested = act({ check: { stat: 'charm', opposedStat: 'wits' } })
    const held = actResolve({
      tuning,
      act: contested,
      author: marked,
      recipient: person({ id: 'greg' }),
      rng: rngSequence({ values: [LOW, HIGH] }),
    })
    expect(held.data.succeeded).toBe(false)
    expect(held.data.branch).toBe(contested.failure)
    const tied = actResolve({
      tuning,
      act: contested,
      author: marked,
      recipient: person({ id: 'greg' }),
      rng: rngSequence({ values: [HIGH, HIGH] }),
    })
    expect(tied.data.contest.winner).toBe(CONTEST_WINNERS.tie)
    expect(tied.data.succeeded).toBe(false)
  })
})
