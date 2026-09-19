/**
 * Integration: what the player knows about a place decides what they see
 * of it. A place they do not know is its looks: the header, the scene, the
 * exits that lead to it. Its own business stays off the menu until they
 * find out what it is. Coming back is a line; looking closer is the place.
 * Driven through the real loop, store and content.
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
import { useBoot } from '../../src/composables/useBoot.js'
import { contentDir, contentFile, tuningContent } from '../helpers/content.js'
import { narrativeSettle } from '../helpers/narrative.js'
import { rngSequence } from '../helpers/rng.js'

const tuning = tuningContent()
const locations = contentDir({ dir: 'content/maps/kenton/locations' })
const actions = contentDir({ dir: 'content/maps/kenton/actions' }).flat()
const voices = contentDir({ dir: 'content/voices' })
const config = contentFile({ path: 'content/game.json' })
const park = locations.find((l) => l.id === 'columbia_park')
const sober = (code) => voices.find((v) => v.id === 'sober').lines[code]
const actionOf = (id) => actions.find((a) => a.id === id)

function startGame() {
  setActivePinia(createPinia())
  const game = useGameStore()
  game.tuningRegister({ tuning })
  for (const location of locations) game.locationRegister({ location: locationCreate(location) })
  for (const voice of voices) game.voiceRegister({ voice })
  game.runStart({ player: playerCreate({ name: 'Tester' }), locationId: 'moms_house' })
  const narrative = useNarrative({ tuning })
  const loop = useGameLoop({ actionRegistry: actions, narrative })
  return { game, narrative, loop }
}

const offered = (game) => game.availableActions.filter((a) => a.available).map((a) => a.id)
const parkBusiness = actions.filter((a) => a.locationId === 'columbia_park').map((a) => a.id)

describe('a place the player does not know', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('the way there is named for how it looks', () => {
    const { game, loop } = startGame()
    loop.onLocationEntered()
    const exit = game.availableExits.find((e) => e.locationId === 'columbia_park')
    const template = locations
      .find((l) => l.id === 'moms_house')
      .exits.find((e) => e.locationId === 'columbia_park').label
    expect(exit.label).toBe(template.replace('{place}', park.appearance.displayInline))
  })

  it('arriving shows its looks, under its looks for a name, and none of its business', async () => {
    const { game, narrative, loop } = startGame()
    await loop.travel({ locationId: 'columbia_park' })

    expect(game.scenePlace.display).toBe(park.appearance.display)
    const [scene] = await narrativeSettle({ narrative })
    expect(scene).toBe(park.appearance.descriptions.default)
    expect(parkBusiness.length).toBeGreaterThan(0)
    for (const id of parkBusiness) expect(offered(game)).not.toContain(id)
    expect(offered(game)).toContain('investigate')
  })

  it('finding out what it is takes time, names it, describes it, and opens its business', async () => {
    const { game, narrative, loop } = startGame()
    await loop.travel({ locationId: 'columbia_park' })
    await narrativeSettle({ narrative })
    const tickBefore = game.time.tick

    await loop.resolvePlayerAction(game.availableActions.find((a) => a.id === 'investigate'))
    const entries = await narrativeSettle({ narrative })

    expect(game.time.tick).toBe(tickBefore + actionOf('investigate').timeCost)
    expect(game.player.knownLocationIds).toContain('columbia_park')
    expect(game.scenePlace.display).toBe(park.display)
    expect(entries.join('\n')).toContain(park.descriptions.default)
    expect(offered(game)).not.toContain('investigate')
    expect(offered(game).some((id) => parkBusiness.includes(id))).toBe(true)
  })

  it('somebody telling the player about a place is knowing it', async () => {
    const { game, loop } = startGame()
    const tip = {
      ...actionOf('look_closer'),
      id: 'hear_about_the_park',
      kind: undefined,
      timeCost: 1,
      success: {
        narrative: 'Somebody tells you about the park.',
        locationDiscovered: 'columbia_park',
      },
    }
    await loop.resolvePlayerAction(tip)
    expect(game.player.knownLocationIds).toContain('columbia_park')
    const exit = game.availableExits.find((e) => e.locationId === 'columbia_park')
    expect(exit.label).toContain(park.displayInline)
  })
})

describe('coming back', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('is a line that the player is back, and looking closer is the whole place, for free', async () => {
    const { game, narrative, loop } = startGame()
    game.locationLearnApply({ locationId: 'columbia_park' })
    await loop.travel({ locationId: 'columbia_park' })
    await loop.travel({ locationId: 'moms_house' })
    await loop.travel({ locationId: 'columbia_park' })
    const [back] = await narrativeSettle({ narrative })
    expect(back).toBe(sober('location.return').replace('{place}', park.displayInline))

    const tickBefore = game.time.tick
    await loop.resolvePlayerAction(game.availableActions.find((a) => a.id === 'look_closer'))
    const entries = await narrativeSettle({ narrative })
    expect(game.time.tick).toBe(tickBefore)
    expect(entries.at(-1)).toBe(park.descriptions.repeat)
  })

  it('somewhere still not known is back at its looks', async () => {
    const { narrative, loop } = startGame()
    await loop.travel({ locationId: 'columbia_park' })
    await loop.travel({ locationId: 'moms_house' })
    await loop.travel({ locationId: 'columbia_park' })
    const [back] = await narrativeSettle({ narrative })
    expect(back).toBe(sober('location.return').replace('{place}', park.appearance.displayInline))
  })
})

describe('a new game', () => {
  it('knows the places content says the player starts out knowing', () => {
    setActivePinia(createPinia())
    const boot = useBoot()
    expect(boot.gameBoot().ok).toBe(true)
    expect(boot.gameNew().ok).toBe(true)
    expect(useGameStore().player.knownLocationIds).toEqual(config.start.knownLocationIds)
  })
})

describe('a confused player', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const characters = contentDir({ dir: 'content/characters' })
  const moms = locations.find((l) => l.id === 'moms_house')
  const parrot = locations.find((l) => l.id === 'blue_parrot')
  const dizzy = ({ game, amount }) => game.playerDazedApply({ amount })
  // Nobody wanders off mid-test: everyone stays where they are.
  const stillWorld = {
    tick: ({ characters: here }) => ({
      characters: here.map((c) => ({ id: c.id, locationId: c.currentLocationId })),
    }),
  }

  function startConfused({ values, at = 'moms_house' }) {
    setActivePinia(createPinia())
    const game = useGameStore()
    game.tuningRegister({ tuning })
    for (const location of locations) game.locationRegister({ location: locationCreate(location) })
    for (const voice of voices) game.voiceRegister({ voice })
    for (const substance of contentDir({ dir: 'content/substances' })) {
      game.substanceRegister({ substance })
    }
    game.runStart({ player: playerCreate({ name: 'Tester' }), locationId: at })
    // Noon, with money: the bars are open and a beer is affordable.
    game.timeAdvance({ ticks: 16 })
    game.playerMoneyAdjust({ delta: 20 })
    const narrative = useNarrative({ tuning })
    const loop = useGameLoop({
      actionRegistry: actions,
      narrative,
      rng: rngSequence({ values, repeatLast: true }),
      simulation: stillWorld,
    })
    return { game, narrative, loop }
  }

  it('can take the place for a neighbour: its name, its looks, its business', async () => {
    // The place lands (0) on the first neighbour by id (0); nothing else lands.
    const { game, narrative, loop } = startConfused({ values: [0, 0, 0.99] })
    game.locationLearnApply({ locationId: 'blue_parrot' })
    dizzy({ game, amount: 100 })
    loop.onLocationEntered()

    expect(game.scene.place.locationId).toBe('blue_parrot')
    expect(game.scenePlace.display).toBe(parrot.display)
    const [scene] = await narrativeSettle({ narrative })
    expect(scene).toBe(parrot.descriptions.default)
    expect(offered(game)).toContain('order_beer_parrot')
  })

  it("reaching for what isn't here misfires: reality gets through, the act does nothing, time passes", async () => {
    const { game, narrative, loop } = startConfused({ values: [0, 0, 0.99] })
    game.locationLearnApply({ locationId: 'blue_parrot' })
    dizzy({ game, amount: 100 })
    loop.onLocationEntered()
    await narrativeSettle({ narrative })
    const moneyBefore = game.playerMoney
    const tickBefore = game.time.tick

    const beer = game.availableActions.find((a) => a.id === 'order_beer_parrot')
    await loop.resolvePlayerAction(beer)
    const entries = await narrativeSettle({ narrative })

    expect(entries).toContain(sober('perception.misfire').replaceAll('{place}', moms.displayInline))
    expect(game.playerMoney).toBe(moneyBefore)
    expect(game.time.tick).toBe(tickBefore + beer.timeCost)
    expect(game.scene.place.locationId).toBe('moms_house')
    expect(offered(game)).not.toContain('order_beer_parrot')
  })

  it('can take somebody for somebody else, and dealing with them misfires', async () => {
    // Place and menu miss; Dale lands (0) as the first somebody-not-here by id; the ways out miss.
    const { game, narrative, loop } = startConfused({
      values: [0.99, 0.99, 0, 0, 0.99],
      at: 'mocks_crest',
    })
    game.locationLearnApply({ locationId: 'mocks_crest' })
    for (const character of characters) {
      game.characterRegister({ character: characterCreate(character) })
      game.characterLocationSet({ characterId: character.id, locationId: 'arbys' })
    }
    game.characterLocationSet({ characterId: 'dale', locationId: 'mocks_crest' })
    dizzy({ game, amount: 100 })
    loop.onLocationEntered()

    expect(game.scenePeople.map((c) => c.id)).toEqual(['dennis'])
    game.characterSelect({ characterId: 'dennis' })
    const talk = game.menuActions.find((a) => a.id === 'talk_to_dennis')
    expect(talk.available).toBe(true)

    await loop.resolvePlayerAction(talk)
    const entries = await narrativeSettle({ narrative })
    expect(entries.at(-1)).toBe(
      sober('perception.misfire').replaceAll(
        '{place}',
        locations.find((l) => l.id === 'mocks_crest').displayInline
      )
    )
    expect(game.scenePeople.map((c) => c.id)).toEqual(['dale'])
  })

  it('can take a way out to lead somewhere past it, and it still goes where it goes', async () => {
    // Place and menu miss; the way to the Parrot lands (0) on the first place past it by id; the rest miss.
    const { game, loop } = startConfused({ values: [0.99, 0.99, 0, 0, 0.99] })
    dizzy({ game, amount: 100 })
    loop.onLocationEntered()

    const exit = game.availableExits.find((e) => e.locationId === 'blue_parrot')
    const template = moms.exits.find((e) => e.locationId === 'blue_parrot').label
    expect(exit.label).toBe(template.replace('{place}', park.appearance.displayInline))

    await loop.travel({ locationId: exit.locationId })
    expect(game.currentLocationId).toBe('blue_parrot')
  })

  it('what was wrong about one scene is not carried into the next', () => {
    // At Mom's the way to the Parrot is taken to lead past it; Mock's has a way to the Parrot too.
    const { game, loop } = startConfused({ values: [0.99, 0.99, 0, 0, 0.99] })
    dizzy({ game, amount: 100 })
    loop.onLocationEntered()
    expect(game.perception.distortions).toContainEqual(
      expect.objectContaining({ realId: 'blue_parrot' })
    )
    game.playerMove({ locationId: 'mocks_crest' })
    const toParrot = game.scene.exits.find((e) => e.locationId === 'blue_parrot')
    expect(toParrot.perceivedLocationId).toBe('blue_parrot')
  })

  it('sees the same wrong things for the whole scene while the confusion holds', async () => {
    const { game, loop } = startConfused({ values: [0, 0, 0.99] })
    dizzy({ game, amount: 100 })
    loop.onLocationEntered()
    const seen = game.perception.distortions
    expect(seen.length).toBeGreaterThan(0)
    await loop.tick({ ticks: 1 })
    expect(game.perception.distortions).toEqual(seen)
  })

  it('comes to as the knock wears off: below the first band, the scene is itself again', async () => {
    const floor = tuning.perception.bands[0].atLeast
    const { game, loop } = startConfused({ values: [0, 0, 0.99] })
    dizzy({ game, amount: floor })
    loop.onLocationEntered()
    expect(game.scene.place.locationId).not.toBe('moms_house')

    await loop.tick({ ticks: 1 })
    expect(game.player.status.confusion).toBeLessThan(floor)
    expect(game.scene.place.locationId).toBe('moms_house')
  })

  it('a knock to the head from the world is confusion', async () => {
    const { game, loop } = startConfused({ values: [0.99] })
    const blow = {
      ...actionOf('look_closer'),
      id: 'walk_into_a_pole',
      kind: undefined,
      timeCost: 1,
      success: { narrative: 'You walk into a pole.', dazed: 40 },
    }
    await loop.resolvePlayerAction(blow)
    const worn = 40 - tuning.perception.dazedDecayPerTick
    expect(game.player.dazed).toBe(worn)
    expect(game.player.status.confusion).toBe(worn)
  })

  it('drinking enough jumbles the scene: a change of band sees it afresh', async () => {
    const { game, loop } = startConfused({ values: [0, 0, 0.99] })
    loop.onLocationEntered()
    expect(game.perception.distortions).toEqual([])
    game.playerDosesApply({ doses: [{ substanceId: 'whiskey', value: 100 }] })
    expect(game.player.status.confusion).toBeGreaterThanOrEqual(tuning.perception.bands[0].atLeast)
    await loop.tick({ ticks: 1 })
    expect(game.perception.distortions.length).toBeGreaterThan(0)
  })
})
