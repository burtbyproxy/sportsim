/**
 * Integration: real fights, as they actually go. The player starts
 * something with whoever they have picked out; the menu becomes the
 * squaring off; the side that cracks swings first and badly; the frantic
 * moment and the ground follow at once; the loser takes the knocks and a
 * save; a bar 86's you; a knockout is a trip home, hours later. Driven
 * through the real loop, store and content.
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
import { FIGHT_ENDINGS, FIGHT_PHASES } from '../../src/engine/fight.js'
import { contentDir, contentFile, tuningContent } from '../helpers/content.js'
import { narrativeSettle } from '../helpers/narrative.js'
import { rngForNatural } from '../helpers/rng.js'
import { textFill } from '../../src/utils/text.js'

const tuning = tuningContent()
const config = contentFile({ path: 'content/game.json' })
const locations = contentDir({ dir: 'content/maps/kenton/locations' })
const actions = contentDir({ dir: 'content/maps/kenton/actions' }).flat()
const voices = contentDir({ dir: 'content/voices' })
const marks = contentDir({ dir: 'content/marks' })
const tables = contentDir({ dir: 'content/psyche' })
const characters = contentDir({ dir: 'content/characters' })
const fights = contentDir({ dir: 'content/fights' })
const sober = (code) => voices.find((v) => v.id === 'sober').lines[code]
const barFight = fights.find((f) => f.id === 'bar_fight')
const characterOf = (id) => characters.find((c) => c.id === id)
// One roll for everything: contests fall to the stats, and no chance under it lands.
const EVEN = rngForNatural({ natural: 10 })

const stillWorld = { tick: ({ characters: here }) => ({ characters: here }) }

function startGame({ at = 'mocks_crest', rng = () => EVEN, opponents = ['dennis'] } = {}) {
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
  for (const fight of fights) game.fightRegister({ fight })
  game.runStart({ player: playerCreate({ name: 'Tester' }), locationId: at })
  game.locationLearnApply({ locationId: at })
  for (const id of opponents) {
    game.characterRegister({
      character: characterCreate({ ...characterOf(id), psyche: { marks: [], abilities: [] } }),
    })
    game.characterLocationSet({ characterId: id, locationId: at })
  }
  game.blendRefresh()
  const narrative = useNarrative({ tuning })
  const loop = useGameLoop({ actionRegistry: actions, narrative, rng, simulation: stillWorld })
  loop.onLocationEntered()
  return { game, narrative, loop }
}

/** The player's stats, set to make the fight go one way. */
function built({ game, stats }) {
  for (const [name, base] of Object.entries(stats)) game.player.stats[name].base = base
}

const entry = ({ game, id }) => game.menuActions.find((a) => a.id === id)
const fightOf = (game) => game.player.fights.at(-1)

/** Pick Dennis out and square up. */
async function squareUp({ game, loop }) {
  game.characterSelect({ characterId: 'dennis' })
  await loop.resolvePlayerAction(entry({ game, id: 'start_something' }))
}

describe('starting something', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('is about whoever the player has picked out, by name, and costs nothing until it starts', async () => {
    const { game, narrative, loop } = startGame()
    expect(entry({ game, id: 'start_something' })).toBeUndefined()
    game.characterSelect({ characterId: 'dennis' })
    const door = entry({ game, id: 'start_something' })
    expect(door.label).toBe('Start something with Dennis')
    const tickBefore = game.time.tick

    await loop.resolvePlayerAction(door)
    const entries = await narrativeSettle({ narrative })

    expect(game.time.tick).toBe(tickBefore)
    expect(fightOf(game)).toMatchObject({ secondId: 'dennis', phase: FIGHT_PHASES.squaring })
    expect(entries).toContain(
      textFill({ text: sober(barFight.lines.started), params: { name: 'Dennis' } })
    )
    expect(game.availableActions.map((a) => a.id)).toEqual([
      ...barFight.jabs.map((jab) => `fight_choice_${jab.id}`),
      'fight_choice_swing',
      'fight_choice_walk',
    ])
    expect(game.availableActions[0].label).toBe(
      textFill({ text: barFight.jabs[0].label, params: { name: 'Dennis' } })
    )
  })

  it('walking away ends it with nobody winning, costs what the fight says, and no bar minds', async () => {
    const { game, narrative, loop } = startGame()
    await squareUp({ game, loop })
    const moodBefore = game.player.status.mood
    await loop.resolvePlayerAction(entry({ game, id: 'fight_choice_walk' }))
    const entries = await narrativeSettle({ narrative })
    expect(fightOf(game)).toMatchObject({
      phase: FIGHT_PHASES.over,
      ending: FIGHT_ENDINGS.walked,
      winner: null,
    })
    expect(entries).toContain(sober(barFight.walk.lineCode))
    expect(game.player.status.mood).toBeLessThan(moodBefore)
    expect(game.locations.mocks_crest.barredUntilTick).toBe(0)
    expect(game.fightActive).toBeNull()
  })
})

describe('squaring off', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('a jab won puts its heat on the other side; kept up, the other side cracks and swings first', async () => {
    const { game, narrative, loop } = startGame()
    // Sharper than Dennis (wits 35): every needle lands.
    built({ game, stats: { wits: 60, toughness: 60, stamina: 60 } })
    await squareUp({ game, loop })
    const needle = barFight.jabs.find((jab) => jab.id === 'needle')

    await loop.resolvePlayerAction(entry({ game, id: 'fight_choice_needle' }))
    expect(fightOf(game).heat).toEqual({
      first: tuning.fight.heatPerRound,
      second: needle.heat + tuning.fight.heatPerRound,
    })
    let rounds = 1
    while (game.fightActive) {
      await loop.resolvePlayerAction(entry({ game, id: 'fight_choice_needle' }))
      rounds += 1
    }
    const entries = await narrativeSettle({ narrative })
    const fight = fightOf(game)
    expect(fight.swungFirst).toBe('second')
    expect(rounds).toBe(Math.ceil(tuning.fight.crackAt / (needle.heat + tuning.fight.heatPerRound)))
    expect(entries).toContain(
      textFill({ text: sober(barFight.lines.crackedThem), params: { name: 'Dennis' } })
    )
    // He swung first, at a penalty, into somebody tougher: he lost.
    expect(fight.winner).toBe('first')
  })
})

describe('what comes of it', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("losing: the knocks, the loser's toll, a save about the winner; and a bar 86's you and puts you out", async () => {
    const { game, narrative, loop } = startGame()
    // Weak, and swinging first: Dennis lands it and ends up on top.
    built({ game, stats: { toughness: 5, stamina: 5 } })
    await squareUp({ game, loop })
    const before = { mood: game.player.status.mood, tick: game.time.tick }

    await loop.resolvePlayerAction(entry({ game, id: 'fight_choice_swing' }))
    const entries = await narrativeSettle({ narrative })

    const fight = fightOf(game)
    expect(fight).toMatchObject({ phase: FIGHT_PHASES.over, winner: 'second' })
    expect(fight.ending).toBe(FIGHT_ENDINGS.onTop)
    expect(entries).toContain(
      textFill({ text: sober(barFight.lines.landedThem), params: { name: 'Dennis' } })
    )
    expect(entries).toContain(
      textFill({ text: sober(barFight.lines.onTopThem), params: { name: 'Dennis' } })
    )
    // The knocks are on the player, wearing off since.
    expect(game.player.dazed).toBeGreaterThan(0)
    expect(game.player.status.mood).toBeLessThan(before.mood)
    // The save held (an even roll against DC 12 with toughness 5 does not), so a mark about Dennis.
    expect(game.player.psyche.marks).toEqual([
      expect.objectContaining({
        target: { kind: 'character', id: 'dennis' },
        source: { kind: 'fight', id: fight.id },
      }),
    ])
    // 86'd, and out the door.
    const mocks = locations.find((l) => l.id === 'mocks_crest')
    expect(entries).toContain(
      textFill({ text: sober(barFight.lines.barred), params: { place: mocks.displayInline } })
    )
    expect(game.locations.mocks_crest.barredUntilTick).toBe(
      before.tick + tuning.fight.barred.hours * tuning.clock.ticksPerHour
    )
    expect(game.currentLocationId).toBe(mocks.exits[0].locationId)
  })

  it("86'd is a door you can see and cannot take, until the while is up", async () => {
    const { game, loop } = startGame()
    built({ game, stats: { toughness: 5, stamina: 5 } })
    await squareUp({ game, loop })
    await loop.resolvePlayerAction(entry({ game, id: 'fight_choice_swing' }))
    const back = () => game.availableExits.find((e) => e.locationId === 'mocks_crest')
    const mocks = locations.find((l) => l.id === 'mocks_crest')
    expect(back().available).toBe(false)
    expect(back().unavailableReason).toBe(
      textFill({ text: sober('requirement.barred'), params: { place: mocks.displayInline } })
    )
    await loop.tick({ ticks: tuning.fight.barred.hours * tuning.clock.ticksPerHour })
    // Open, and open hours: Mock's opens at some hour; wait for it.
    while (!back().available && game.time.tick < 2000) await loop.tick({ ticks: 1 })
    expect(back().available).toBe(true)
  })

  it("winning: the other side takes the knocks and a save about the place, and you take the winner's toll", async () => {
    const { game, loop } = startGame()
    built({ game, stats: { toughness: 80, stamina: 80 } })
    await squareUp({ game, loop })
    const dennis = game.characters.dennis
    // Soft enough that an even save against DC 12 fails.
    dennis.stats.toughness.base = 5
    await loop.resolvePlayerAction(entry({ game, id: 'fight_choice_swing' }))
    const fight = fightOf(game)
    expect(fight.winner).toBe('first')
    expect(dennis.dazed).toBeGreaterThan(0)
    expect(game.player.dazed).toBe(0)
    // Dennis, toughness 30, fails an even save against DC 12: a mark about the place.
    expect(dennis.psyche.marks).toEqual([
      expect.objectContaining({
        target: { kind: 'location', id: 'mocks_crest' },
        source: { kind: 'fight', id: fight.id },
      }),
    ])
  })

  it("knocked out: and then nothing, and hours later you wake up at mom's, with a line for where", async () => {
    const { game, narrative, loop } = startGame()
    built({ game, stats: { toughness: 5, stamina: 5 } })
    // Already groggy: the swing's knock crosses the line.
    game.playerDazedApply({ amount: tuning.fight.knockoutAt - tuning.fight.swing.dazedOnHit + 1 })
    await squareUp({ game, loop })
    const tickBefore = game.time.tick

    await loop.resolvePlayerAction(entry({ game, id: 'fight_choice_swing' }))
    const entries = await narrativeSettle({ narrative })

    expect(fightOf(game).ending).toBe(FIGHT_ENDINGS.knockout)
    expect(game.currentLocationId).toBe('moms_house')
    expect(game.time.tick).toBe(
      tickBefore + tuning.fight.knockout.hours * tuning.clock.ticksPerHour
    )
    const wakeLines = config.knockout.spots.map((spot) => sober(spot.lineCode))
    expect(entries.some((line) => wakeLines.includes(line))).toBe(true)
    // The bar still 86'd you on the way down.
    expect(game.locations.mocks_crest.barredUntilTick).toBeGreaterThan(tickBefore)
  })

  it('whoever is there can pull you apart, and then nobody won and nobody is marked', async () => {
    // A roll under the pull chance with two bystanders: pulled apart on the ground.
    const chance = tuning.fight.ground.pulledApartChancePerBystander
    const { game, loop } = startGame({
      rng: () => chance * 2 - 0.01,
      opponents: ['dennis', 'dale', 'sheila'],
    })
    built({ game, stats: { toughness: 5, stamina: 5 } })
    await squareUp({ game, loop })
    await loop.resolvePlayerAction(entry({ game, id: 'fight_choice_swing' }))
    const fight = fightOf(game)
    expect(fight.ending).toBe(FIGHT_ENDINGS.pulledApart)
    expect(fight.winner).toBeNull()
    expect(game.player.psyche.marks).toEqual([])
    expect(game.characters.dennis.psyche.marks).toEqual([])
  })
})
