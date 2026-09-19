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
import { useNarrative } from '../../src/composables/useNarrative.js'
import { useGameLoop } from '../../src/composables/useGameLoop.js'
import { useBoot } from '../../src/composables/useBoot.js'
import { contentDir, contentFile, tuningContent } from '../helpers/content.js'
import { narrativeSettle } from '../helpers/narrative.js'

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
