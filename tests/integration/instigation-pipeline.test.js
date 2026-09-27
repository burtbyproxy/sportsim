/**
 * Integration: instigating. The player's real skill is getting people to
 * fight: the talk in the room sets a grudge off, the grudge swings at
 * whoever is nearest, and the fight is told from the bar stool, or from
 * the wrong end of it when it comes at the player. Watching gets in. The
 * world's fights carry the player home or out the door once the tick
 * ends, and carry a character home for hours. Driven through the real
 * loop, store and content.
 *
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useGameStore } from '../../src/stores/game.js'
import { playerCreate } from '../../src/models/player.js'
import { locationCreate } from '../../src/models/location.js'
import { characterCreate } from '../../src/models/character.js'
import { useNarrative } from '../../src/composables/useNarrative.js'
import { useGameLoop } from '../../src/composables/useGameLoop.js'
import { FIGHT_ENDINGS } from '../../src/engine/fight.js'
import { contentDir, contentFile, tuningContent } from '../helpers/content.js'
import { narrativeSettle } from '../helpers/narrative.js'
import { textFill } from '../../src/utils/text.js'

const tuning = tuningContent()
const config = contentFile({ path: 'content/game.json' })
const locations = contentDir({ dir: 'content/maps/kenton/locations' })
const actions = contentDir({ dir: 'content/maps/kenton/actions' }).flat()
const voices = contentDir({ dir: 'content/voices' })
const marks = contentDir({ dir: 'content/marks' })
const tables = contentDir({ dir: 'content/psyche' })
const topics = contentDir({ dir: 'content/topics' })
const characters = contentDir({ dir: 'content/characters' })
const fights = contentDir({ dir: 'content/fights' })
const acts = contentDir({ dir: 'content/acts' })
const sober = (code) => voices.find((v) => v.id === 'sober').lines[code]
const barFight = fights.find((f) => f.id === 'bar_fight')
const swings = acts.find((a) => a.id === 'grudge_swings')
const characterOf = (id) => characters.find((c) => c.id === id)
// One roll: every chance lands, every contest is a natural one, every save fails, every coin is heads.
const LANDS = 0

// Nobody wanders off mid-test.
const stillWorld = {
  tick: ({ characters: here }) => ({
    characters: here.map((c) => ({ id: c.id, locationId: c.currentLocationId })),
  }),
}

function startGame({ at = 'mocks_crest', simulation = stillWorld } = {}) {
  setActivePinia(createPinia())
  const game = useGameStore()
  game.tuningRegister({ tuning })
  game.configRegister({ config })
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
  for (const fight of fights) game.fightRegister({ fight })
  game.runStart({ player: playerCreate({ name: 'Tester' }), locationId: at })
  game.locationLearnApply({ locationId: at })
  const narrative = useNarrative({ tuning })
  const loop = useGameLoop({
    actionRegistry: actions,
    actRegistry: [swings],
    narrative,
    rng: () => LANDS,
    simulation,
  })
  return { game, narrative, loop }
}

/** Somebody arrives, carrying the marks given, some already in a fit. */
function arrives({ game, id, at = 'mocks_crest', marks: carried = [] }) {
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

const hatesDale = {
  markId: 'obsession_hate',
  target: { kind: 'character', id: 'dale' },
  inFit: true,
}
const fightOf = (subject) => subject.fights.at(-1)

describe('two other people', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('the grudge swings at the nearest, the fight is told from the bar stool, and watching gets in', async () => {
    const { game, narrative, loop } = startGame()
    const dennis = arrives({ game, id: 'dennis', marks: [hatesDale] })
    const dale = arrives({ game, id: 'dale' })
    loop.onLocationEntered()
    await narrativeSettle({ narrative })
    const moodBefore = game.player.status.mood

    await loop.tick({ ticks: 1 })
    const entries = await narrativeSettle({ narrative })

    // Dennis came in swinging at Dale (first in the room), no squaring off.
    const fight = fightOf(dennis)
    expect(fight).toMatchObject({ firstId: 'dennis', secondId: 'dale', swungFirst: 'first' })
    expect(fight.phase).toBe('over')
    expect(entries).toContain(
      textFill({
        text: sober(swings.success.lineCodeOthers),
        params: { author: 'Dennis', recipient: 'Dale', target: 'Dale' },
      })
    )
    // Dale, tougher, lands it; then the one bystander (you) pulls them apart, every chance landing.
    expect(fight.ending).toBe(FIGHT_ENDINGS.pulledApart)
    expect(entries).toContain(
      textFill({
        text: sober(barFight.lines.landed.others),
        params: { first: 'Dale', second: 'Dennis' },
      })
    )
    expect(entries).toContain(
      textFill({
        text: sober(barFight.lines.pulledApart.others),
        params: { first: 'Dennis', second: 'Dale' },
      })
    )
    expect(dennis.dazed).toBe(tuning.fight.swing.dazedOnHit)
    expect(dale.dazed).toBe(0)
    // Nobody won, so nobody is marked, and nobody was put out.
    expect(dennis.psyche.marks).toHaveLength(1)
    expect(dale.psyche.marks).toHaveLength(0)
    expect(game.locations.mocks_crest.barredUntilTick).toBe(0)
    // You watched: the show's line, its mood, and the idea it put in you.
    expect(entries).toContain(sober(barFight.watched.lineCode))
    expect(game.player.status.mood).toBeGreaterThan(moodBefore)
    expect(game.inspirationActive).toMatchObject({ sourceKind: 'fight', sourceId: fight.id })
  })

  it('out of the room it still happens, and the player hears nothing and takes nothing', async () => {
    const { game, narrative, loop } = startGame({ at: 'moms_house' })
    const dennis = arrives({ game, id: 'dennis', marks: [hatesDale] })
    arrives({ game, id: 'dale' })
    loop.onLocationEntered()
    await narrativeSettle({ narrative })
    await loop.tick({ ticks: 1 })
    const entries = await narrativeSettle({ narrative })
    expect(fightOf(dennis).phase).toBe('over')
    expect(entries.some((line) => line.includes('Dennis'))).toBe(false)
    expect(game.inspirationActive).toBeNull()
  })

  it('the talk in the room is the lever: with Kiss on the menu, the real Dennis goes off', async () => {
    const { game, loop } = startGame()
    const dennis = arrives({
      game,
      id: 'dennis',
      marks: [{ markId: 'obsession_hate', target: { kind: 'topic', id: 'kiss' } }],
    })
    arrives({ game, id: 'dale' })
    loop.onLocationEntered()
    expect(game.availableActions.find((a) => a.id === 'ask_dennis_about_kiss')).toBeTruthy()

    await loop.tick({ ticks: 1 })

    expect(dennis.psyche.marks[0].fitTicksRemaining).toBeGreaterThan(0)
    expect(fightOf(dennis)).toMatchObject({ firstId: 'dennis', secondId: 'dale' })
  })
})

describe('who fights', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('a grudge in someone soft never swings; the same grudge in someone tough does', async () => {
    const soft = startGame()
    const tina = arrives({ game: soft.game, id: 'tina', marks: [hatesDale] })
    arrives({ game: soft.game, id: 'dale' })
    soft.loop.onLocationEntered()
    await soft.loop.tick({ ticks: 1 })
    expect(tina.fights).toEqual([])

    const tough = startGame()
    const dennis = arrives({ game: tough.game, id: 'dennis', marks: [hatesDale] })
    arrives({ game: tough.game, id: 'dale' })
    tough.loop.onLocationEntered()
    await tough.loop.tick({ ticks: 1 })
    expect(dennis.fights).toHaveLength(1)
  })
})

describe('the world comes at the player', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('no squaring off: told from the wrong end, the loser takes the toll, the save, and the door, once the tick ends', async () => {
    const { game, narrative, loop } = startGame()
    const dennis = arrives({ game, id: 'dennis', marks: [hatesDale] })
    game.player.stats.toughness.base = 5
    game.player.stats.stamina.base = 5
    loop.onLocationEntered()
    await narrativeSettle({ narrative })
    const tickBefore = game.time.tick

    await loop.tick({ ticks: 1 })
    const entries = await narrativeSettle({ narrative })

    const fight = fightOf(dennis)
    expect(fight).toMatchObject({
      secondId: game.player.id,
      ending: FIGHT_ENDINGS.onTop,
      winner: 'first',
    })
    expect(entries).toContain(
      textFill({ text: sober(barFight.swing.lines.them), params: { name: 'Dennis' } })
    )
    expect(entries).toContain(
      textFill({ text: sober(barFight.lines.onTop.them), params: { name: 'Dennis' } })
    )
    expect(game.player.dazed).toBeGreaterThan(0)
    expect(game.player.psyche.marks).toEqual([
      expect.objectContaining({
        target: { kind: 'character', id: 'dennis' },
        source: { kind: 'fight', id: fight.id },
      }),
    ])
    // 86'd, and out the door once the tick that started it was over; the fight's lines came along.
    const mocks = locations.find((l) => l.id === 'mocks_crest')
    expect(game.locations.mocks_crest.barredUntilTick).toBeGreaterThan(tickBefore)
    expect(game.currentLocationId).toBe(mocks.exits[0].locationId)
    expect(entries).toContain(
      textFill({ text: sober(barFight.lines.barred), params: { place: mocks.displayInline } })
    )
  })

  it('knocked out by the world: carried home once the tick ends, hours later, with a line for where', async () => {
    const { game, narrative, loop } = startGame()
    arrives({ game, id: 'dennis', marks: [hatesDale] })
    game.player.stats.toughness.base = 5
    game.playerDazedApply({ amount: tuning.fight.knockoutAt - tuning.fight.swing.dazedOnHit + 1 })
    loop.onLocationEntered()
    await narrativeSettle({ narrative })
    const tickBefore = game.time.tick

    await loop.tick({ ticks: 1 })
    const entries = await narrativeSettle({ narrative })

    expect(game.currentLocationId).toBe('moms_house')
    expect(game.time.tick).toBe(
      tickBefore + 1 + tuning.fight.knockout.hours * tuning.clock.ticksPerHour
    )
    expect(entries).toContain(sober(barFight.lines.knockout.you))
    const wakeLines = config.knockout.spots.map((spot) => sober(spot.lineCode))
    expect(entries.some((line) => wakeLines.includes(line))).toBe(true)
  })
})

describe('carried home', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('a character knocked out is off the map for the hours, whatever the schedule says', async () => {
    const sendTo = (locationId) => ({
      tick: ({ characters: here }) => ({ characters: here.map((c) => ({ id: c.id, locationId })) }),
    })
    const { game, loop } = startGame({ simulation: sendTo('mocks_crest') })
    const dennis = arrives({ game, id: 'dennis' })
    const hours = tuning.fight.knockout.hours * tuning.clock.ticksPerHour
    game.characterAwayApply({ characterId: 'dennis', untilTick: game.time.tick + hours })
    expect(dennis.currentLocationId).toBeNull()
    await loop.tick({ ticks: 1 })
    expect(dennis.currentLocationId).toBeNull()
    await loop.tick({ ticks: hours })
    expect(dennis.currentLocationId).toBe('mocks_crest')
  })

  it('a knockout in a fight between two others carries the loser home', async () => {
    const { game, loop } = startGame({ at: 'moms_house' })
    const dennis = arrives({ game, id: 'dennis', marks: [hatesDale] })
    arrives({ game, id: 'dale' })
    // Already groggy: Dale's swing puts him out, and there is nobody there to pull anyone apart.
    game.subjectDazedApply({
      who: { kind: 'character', id: 'dennis' },
      amount: tuning.fight.knockoutAt - tuning.fight.swing.dazedOnHit + 1,
    })
    loop.onLocationEntered()
    await loop.tick({ ticks: 1 })
    expect(fightOf(dennis).ending).toBe(FIGHT_ENDINGS.knockout)
    expect(dennis.awayUntilTick).toBeGreaterThan(game.time.tick)
    expect(dennis.currentLocationId).toBeNull()
  })
})
