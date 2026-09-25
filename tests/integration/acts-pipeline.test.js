/**
 * Integration: people start things. An act has an author (a person, a
 * persona in charge, a mark in a fit), goes off in the author's own scene,
 * and lands on whoever it is done to: on the player like any outcome, on
 * anyone else on their body and mind. The player hears of it when they are
 * in the room, and not otherwise. Driven through the real loop, store and
 * content.
 *
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useGameStore, STORE_ERROR_CODES } from '../../src/stores/game.js'
import { playerCreate } from '../../src/models/player.js'
import { locationCreate } from '../../src/models/location.js'
import { characterCreate } from '../../src/models/character.js'
import { useNarrative } from '../../src/composables/useNarrative.js'
import { useGameLoop } from '../../src/composables/useGameLoop.js'
import { ACT_AUTHOR_KINDS, ACT_RECIPIENT_KINDS, SUBJECT_KINDS } from '../../src/engine/acts.js'
import { contentDir, tuningContent } from '../helpers/content.js'
import { narrativeSettle } from '../helpers/narrative.js'
import { rngSequence } from '../helpers/rng.js'
import { textFill } from '../../src/utils/text.js'

const tuning = tuningContent()
const locations = contentDir({ dir: 'content/maps/kenton/locations' })
const actions = contentDir({ dir: 'content/maps/kenton/actions' }).flat()
const voices = contentDir({ dir: 'content/voices' })
const marks = contentDir({ dir: 'content/marks' })
const tables = contentDir({ dir: 'content/psyche' })
const topics = contentDir({ dir: 'content/topics' })
const characters = contentDir({ dir: 'content/characters' })
const acts = contentDir({ dir: 'content/acts' })
const sober = (code) => voices.find((v) => v.id === 'sober').lines[code]
const actOf = (id) => acts.find((a) => a.id === id)
const characterOf = (id) => characters.find((c) => c.id === id)
const fill = ({ text, params }) => textFill({ text, params })

// Nobody wanders off mid-test; a test that wants somebody somewhere says so.
const stillWorld = {
  tick: ({ characters: here }) => ({
    characters: here.map((c) => ({ id: c.id, locationId: c.currentLocationId })),
  }),
}

// One constant roll: every chance lands, and every contest is a tie the recipient holds.
const ALWAYS = 0

function startGame({ at = 'mocks_crest', values = [ALWAYS], actRegistry = acts } = {}) {
  setActivePinia(createPinia())
  const game = useGameStore()
  game.tuningRegister({ tuning })
  for (const location of locations) game.locationRegister({ location: locationCreate(location) })
  for (const voice of voices) game.voiceRegister({ voice })
  for (const substance of contentDir({ dir: 'content/substances' })) {
    game.substanceRegister({ substance })
  }
  for (const condition of contentDir({ dir: 'content/conditions' })) {
    game.conditionRegister({ condition })
  }
  for (const mark of marks) game.markRegister({ mark })
  for (const table of tables) game.psycheTableRegister({ table })
  for (const topic of topics) game.topicRegister({ topic })
  for (const act of acts) game.actRegister({ act })
  game.runStart({ player: playerCreate({ name: 'Tester' }), locationId: at })
  game.locationLearnApply({ locationId: at })
  const narrative = useNarrative({ tuning })
  const loop = useGameLoop({
    actionRegistry: actions,
    actRegistry,
    narrative,
    rng: rngSequence({ values, repeatLast: true }),
    simulation: stillWorld,
  })
  return { game, narrative, loop }
}

/**
 * Somebody from content, somewhere, carrying only the marks the test wants,
 * some of them already in a fit.
 */
function arrives({ game, id, at, marks: carried = [] }) {
  const character = characterCreate({
    ...characterOf(id),
    psyche: { marks: carried.map(({ markId, target }) => ({ markId, target })), abilities: [] },
  })
  for (const { markId, inFit } of carried) {
    if (inFit) character.psyche.marks.find((m) => m.markId === markId).fitTicksRemaining = 3
  }
  game.characterRegister({ character })
  game.characterLocationSet({ characterId: id, locationId: at })
  game.blendRefresh()
  return game.characters[id]
}

const who = (id) => ({ kind: SUBJECT_KINDS.character, id })
const hatesDale = {
  markId: 'obsession_hate',
  target: { kind: 'character', id: 'dale' },
  inFit: true,
}
const hatesKiss = { markId: 'obsession_hate', target: { kind: 'topic', id: 'kiss' }, inFit: true }

/** An act a test writes, on the same contract as content's. */
function actMake({ id, author, to, check = null, success, failure = null, trigger = null }) {
  const branch = (b) => ({
    outcome: null,
    outcomeAuthor: null,
    lineCode: null,
    lineCodeOthers: null,
    ...b,
  })
  return {
    id,
    display: id,
    author,
    trigger,
    to,
    chancePerTick: 1,
    check,
    success: branch(success),
    failure: failure ? branch(failure) : null,
  }
}

describe('somebody does something to the player', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('the talk around the player sets a mark off in the room, and the fit acts on the player', async () => {
    const preaches = actOf('devotee_preaches')
    const { game, narrative, loop } = startGame({ actRegistry: [preaches] })
    // Dennis, with only his love of classic rock; the menu here talks about it.
    const dennis = arrives({
      game,
      id: 'dennis',
      at: 'mocks_crest',
      marks: [{ markId: 'obsession_love', target: { kind: 'topic', id: 'classic_rock' } }],
    })
    loop.onLocationEntered()
    await narrativeSettle({ narrative })
    const moodBefore = dennis.status.mood

    await loop.tick({ ticks: 1 })
    const entries = await narrativeSettle({ narrative })

    expect(dennis.psyche.marks[0].fitTicksRemaining).toBeGreaterThan(0)
    expect(entries).toContain(
      fill({
        text: sober(preaches.success.lineCode),
        params: { author: 'Dennis', target: 'classic rock' },
      })
    )
    expect(dennis.status.mood).toBe(moodBefore + preaches.success.outcomeAuthor.statusChanges.mood)
  })

  it("what it does to the player is the act's outcome, no more: the control run differs by exactly that", async () => {
    const preaches = actOf('devotee_preaches')
    const love = { markId: 'obsession_love', target: { kind: 'topic', id: 'classic_rock' } }
    const acted = startGame({ actRegistry: [preaches] })
    arrives({ game: acted.game, id: 'dennis', at: 'mocks_crest', marks: [love] })
    acted.loop.onLocationEntered()
    await acted.loop.tick({ ticks: 1 })

    const control = startGame({ actRegistry: [] })
    arrives({ game: control.game, id: 'dennis', at: 'mocks_crest', marks: [love] })
    control.loop.onLocationEntered()
    await control.loop.tick({ ticks: 1 })

    expect(acted.game.player.status.mood).toBe(
      control.game.player.status.mood + preaches.success.outcome.statusChanges.mood
    )
  })

  it('a named person acts as themselves, when their trigger holds', async () => {
    const holdsForth = actOf('dennis_holds_forth')
    const { game, narrative, loop } = startGame({ actRegistry: [holdsForth] })
    const dennis = arrives({ game, id: 'dennis', at: 'mocks_crest' })
    loop.onLocationEntered()
    await narrativeSettle({ narrative })
    const moodBefore = dennis.status.mood

    await loop.tick({ ticks: 1 })
    const entries = await narrativeSettle({ narrative })
    expect(entries).toContain(sober(holdsForth.success.lineCode))
    expect(dennis.status.mood).toBe(
      moodBefore + holdsForth.success.outcomeAuthor.statusChanges.mood
    )
  })

  const snaps = actMake({
    id: 'snaps_at_you',
    author: { kind: ACT_AUTHOR_KINDS.mark, id: 'obsession_hate' },
    to: ACT_RECIPIENT_KINDS.player,
    check: { stat: 'charm', opposedStat: 'wits' },
    success: { outcome: { statusChanges: { mood: -6 } }, lineCode: 'act.grudge_snaps.you' },
    failure: {
      outcomeAuthor: { statusChanges: { mood: -4 } },
      lineCode: 'act.grudge_snaps.you.held',
    },
  })

  // With one constant roll both sides throw the same natural, so the stats
  // decide: Dennis's charm against the player's wits.
  it("a contest the author takes is the success branch, and the player's side trains as a failure", async () => {
    const { game, narrative, loop } = startGame({ actRegistry: [snaps] })
    const dennis = arrives({ game, id: 'dennis', at: 'mocks_crest', marks: [hatesKiss] })
    game.player.stats.wits.base = 10
    loop.onLocationEntered()
    await narrativeSettle({ narrative })
    const xpBefore = game.player.stats.wits.xp
    const moodBefore = dennis.status.mood

    await loop.tick({ ticks: 1 })
    const entries = await narrativeSettle({ narrative })
    expect(entries).toContain(
      fill({ text: sober('act.grudge_snaps.you'), params: { author: 'Dennis', target: 'Kiss' } })
    )
    expect(game.player.stats.wits.xp).toBe(xpBefore + tuning.stats.xpCheckFailure)
    expect(dennis.status.mood).toBe(moodBefore)
  })

  it("a contest the player holds is the failure branch, and the player's side trains as a success", async () => {
    const { game, narrative, loop } = startGame({ actRegistry: [snaps] })
    const dennis = arrives({ game, id: 'dennis', at: 'mocks_crest', marks: [hatesKiss] })
    game.player.stats.wits.base = 90
    loop.onLocationEntered()
    await narrativeSettle({ narrative })
    const xpBefore = game.player.stats.wits.xp
    const moodBefore = dennis.status.mood

    await loop.tick({ ticks: 1 })
    const entries = await narrativeSettle({ narrative })
    expect(entries).toContain(
      fill({
        text: sober('act.grudge_snaps.you.held'),
        params: { author: 'Dennis', target: 'Kiss' },
      })
    )
    expect(game.player.stats.wits.xp).toBe(xpBefore + tuning.stats.xpCheckSuccess)
    expect(dennis.status.mood).toBe(moodBefore - 4)
  })

  it('what it leaves on the player is about the one who did it', async () => {
    const scares = actMake({
      id: 'scares_you',
      author: { kind: ACT_AUTHOR_KINDS.mark, id: 'obsession_hate' },
      to: ACT_RECIPIENT_KINDS.player,
      success: {
        outcome: { trauma: { save: { stat: 'toughness', dc: 12 }, tableId: 'trauma' } },
        lineCode: 'act.grudge_snaps.you',
      },
    })
    const { game, loop } = startGame({ actRegistry: [scares] })
    arrives({ game, id: 'dennis', at: 'mocks_crest', marks: [hatesKiss] })
    loop.onLocationEntered()
    // The constant roll fails the save, and the tables come down to something.
    await loop.tick({ ticks: 1 })
    expect(game.player.psyche.marks).toEqual([
      expect.objectContaining({
        target: { kind: 'character', id: 'dennis' },
        source: { kind: 'act', id: 'scares_you' },
      }),
    ])
  })
})

describe('somebody does something to somebody else', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const marksDale = actMake({
    id: 'marks_dale',
    author: { kind: ACT_AUTHOR_KINDS.mark, id: 'obsession_hate' },
    to: ACT_RECIPIENT_KINDS.target,
    success: {
      outcome: {
        statusChanges: { mood: -10 },
        dazed: 30,
        trauma: { save: { stat: 'toughness', dc: 12 }, tableId: 'trauma' },
      },
      outcomeAuthor: { statusChanges: { mood: 5 } },
      lineCodeOthers: 'act.grudge_snaps.them',
    },
  })

  it('lands on their body and mind, and what it leaves is about the author; the player, in the room, hears it', async () => {
    const { game, narrative, loop } = startGame({ actRegistry: [marksDale] })
    const dennis = arrives({ game, id: 'dennis', at: 'mocks_crest', marks: [hatesDale] })
    const dale = arrives({ game, id: 'dale', at: 'mocks_crest' })
    loop.onLocationEntered()
    await narrativeSettle({ narrative })
    const before = { dale: dale.status.mood, dennis: dennis.status.mood }

    await loop.tick({ ticks: 1 })
    const entries = await narrativeSettle({ narrative })

    expect(dale.status.mood).toBe(before.dale - 10)
    expect(dale.dazed).toBe(30 - tuning.perception.dazedDecayPerTick * 0)
    expect(dale.psyche.marks).toEqual([
      expect.objectContaining({
        target: { kind: 'character', id: 'dennis' },
        source: { kind: 'act', id: 'marks_dale' },
      }),
    ])
    expect(dennis.status.mood).toBe(before.dennis + 5)
    expect(entries).toContain(
      fill({
        text: sober('act.grudge_snaps.them'),
        params: { author: 'Dennis', recipient: 'Dale', target: 'Dale' },
      })
    )
    expect(game.player.psyche.marks).toEqual([])
  })

  it('out of the room it still happens, and the player hears nothing', async () => {
    const { game, narrative, loop } = startGame({ at: 'moms_house', actRegistry: [marksDale] })
    arrives({ game, id: 'dennis', at: 'mocks_crest', marks: [hatesDale] })
    const dale = arrives({ game, id: 'dale', at: 'mocks_crest' })
    loop.onLocationEntered()
    await narrativeSettle({ narrative })
    const before = dale.status.mood

    await loop.tick({ ticks: 1 })
    const entries = await narrativeSettle({ narrative })
    expect(dale.status.mood).toBe(before - 10)
    expect(dale.psyche.marks).toHaveLength(1)
    expect(entries.some((line) => line.includes('Dennis'))).toBe(false)
  })

  it('a knock to the head wears off for them like it does for the player', async () => {
    const { game, loop } = startGame({ actRegistry: [] })
    const dale = arrives({ game, id: 'dale', at: 'mocks_crest' })
    game.subjectDazedApply({ who: who('dale'), amount: 20 })
    expect(dale.dazed).toBe(20)
    await loop.tick({ ticks: 1 })
    expect(dale.dazed).toBe(20 - tuning.perception.dazedDecayPerTick)
  })

  it("a mark's target who is not there cannot be done to, and the act waits", async () => {
    const { game, loop } = startGame({ actRegistry: [marksDale] })
    const dennis = arrives({ game, id: 'dennis', at: 'mocks_crest', marks: [hatesDale] })
    const dale = arrives({ game, id: 'dale', at: 'ainsworth_plaid' })
    loop.onLocationEntered()
    await loop.tick({ ticks: 1 })
    expect(dale.status.mood).toBe(50)
    expect(dennis.status.mood).toBe(50)
  })
})

describe('the room', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('the player is company: alone with the player is not alone', async () => {
    const lonely = { markId: 'needs_company', target: null }
    const together = startGame({ at: 'columbia_park', actRegistry: [] })
    const maurice = arrives({
      game: together.game,
      id: 'maurice',
      at: 'columbia_park',
      marks: [lonely],
    })
    together.loop.onLocationEntered()
    await together.loop.tick({ ticks: 1 })
    expect(maurice.psyche.marks[0].fitTicksRemaining).toBe(0)

    const apart = startGame({ at: 'moms_house', actRegistry: [] })
    const alone = arrives({ game: apart.game, id: 'maurice', at: 'columbia_park', marks: [lonely] })
    apart.loop.onLocationEntered()
    await apart.loop.tick({ ticks: 1 })
    expect(alone.psyche.marks[0].fitTicksRemaining).toBeGreaterThan(0)
  })

  it('an outcome for nobody is refused with its code, not lost', () => {
    const { game } = startGame({ actRegistry: [] })
    const landed = game.subjectOutcomeApply({
      who: who('nobody'),
      outcome: { statusChanges: { mood: -1 } },
      traumaTarget: null,
      source: { kind: 'test', id: 'test' },
    })
    expect(landed.ok).toBe(false)
    expect(landed.error.code).toBe(STORE_ERROR_CODES.subjectUnknown)
    expect(landed.error.params).toEqual({ kind: 'character', id: 'nobody' })
  })
})
