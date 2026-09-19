/**
 * Integration: the menu the player sees is built by the loop and the store,
 * not by the components. What is on it, in what order, why something is
 * greyed out, and what happens when the player picks something they can't.
 *
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { createPinia, setActivePinia } from 'pinia'
import { useGameStore } from '../../src/stores/game.js'
import { playerCreate } from '../../src/models/player.js'
import { locationCreate } from '../../src/models/location.js'
import { characterCreate } from '../../src/models/character.js'
import { itemCreate } from '../../src/models/item.js'
import { useNarrative } from '../../src/composables/useNarrative.js'
import { useGameLoop } from '../../src/composables/useGameLoop.js'
import { contentDir, contentFile, tuningContent } from '../helpers/content.js'
import { narrativeSettle } from '../helpers/narrative.js'

const tuning = tuningContent()

const locations = contentDir({ dir: 'content/maps/kenton/locations' })
const momsHouseActions = contentFile({ path: 'content/maps/kenton/actions/moms_house.json' })
const voices = contentDir({ dir: 'content/voices' })
const items = contentDir({ dir: 'content/items' }).flat()
const dale = contentFile({ path: 'content/characters/dale.json' })
const vocabulary = contentFile({ path: 'content/vocabulary.json' })
const sober = (code) => voices.find((v) => v.id === 'sober').lines[code]

function startGame({ at = 'moms_house' } = {}) {
  setActivePinia(createPinia())
  const game = useGameStore()
  game.tuningRegister({ tuning })
  for (const location of locations) game.locationRegister({ location: locationCreate(location) })
  for (const voice of voices) game.voiceRegister({ voice })
  for (const item of items) game.itemRegister({ item: itemCreate(item) })
  game.vocabularyRegister({ vocabulary })
  game.runStart({ player: playerCreate({ name: 'Tester' }), locationId: at })
  return game
}

describe('the menu', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("keeps the engine's order, so what a mark pulls toward moves up the menu", () => {
    const game = startGame()
    for (const mark of contentDir({ dir: 'content/marks' })) game.markRegister({ mark })
    const actions = [
      { id: 'sensible', label: 'Sensible', locationId: 'moms_house', weight: 50 },
      {
        id: 'compulsion',
        label: 'Compulsion',
        locationId: 'moms_house',
        weight: 40,
        success: { doses: [{ substanceId: 'whiskey', value: 10 }] },
      },
    ]
    game.player.psyche.marks = [
      {
        id: 'm1',
        markId: 'obsession_love',
        target: { kind: 'substance', id: 'whiskey' },
        status: 'active',
        fitTicksRemaining: 0,
      },
    ]
    useGameLoop({ actionRegistry: actions }).onLocationEntered()
    expect(game.menuEntries.filter((e) => e.kind === 'action').map((e) => e.action.id)).toEqual([
      'compulsion',
      'sensible',
    ])
  })

  it('a greyed-out action says the real reason, the one the loop worked out', () => {
    const game = startGame()
    useGameLoop({ actionRegistry: momsHouseActions }).onLocationEntered()
    const sleep = game.menuEntries.find((e) => e.action?.id === 'sleep')
    expect(sleep.available).toBe(false)
    expect(sleep.reason).toBe(sober('requirement.hour.early'))
  })

  it("an exit to a shut place the player knows is greyed out with the place's own words", () => {
    const game = startGame()
    game.locationLearnApply({ locationId: 'blue_parrot' })
    useGameLoop().onLocationEntered()
    const parrot = game.menuEntries.find((e) => e.exit?.locationId === 'blue_parrot')
    expect(parrot.available).toBe(false)
    expect(parrot.reason).toBe(game.locations.blue_parrot.availability.closedMessage)
  })

  it('an exit to a shut place the player does not know is just shut: its words would name it', () => {
    const game = startGame()
    useGameLoop().onLocationEntered()
    const parrot = game.menuEntries.find((e) => e.exit?.locationId === 'blue_parrot')
    expect(parrot.available).toBe(false)
    expect(parrot.reason).toBe(sober('requirement.closed'))
  })

  it('walking into a shut place is refused, out loud, and nobody moves', async () => {
    const game = startGame()
    game.locationLearnApply({ locationId: 'blue_parrot' })
    const narrative = useNarrative({ tuning })
    const loop = useGameLoop({ narrative })
    await loop.travel({ locationId: 'blue_parrot' })
    expect(game.currentLocationId).toBe('moms_house')
    expect(await narrativeSettle({ narrative })).toContain(
      game.locations.blue_parrot.availability.closedMessage
    )
  })

  it('there is no walking to a place this one has no way to', async () => {
    const game = startGame()
    const narrative = useNarrative({ tuning })
    await useGameLoop({ narrative }).travel({ locationId: 'arbys' })
    expect(game.currentLocationId).toBe('moms_house')
    expect(await narrativeSettle({ narrative })).toContain('[EXIT_NONE]')
  })

  it('picking a greyed-out action says why instead of doing it', async () => {
    const game = startGame()
    const narrative = useNarrative({ tuning })
    const loop = useGameLoop({ actionRegistry: momsHouseActions, narrative })
    loop.onLocationEntered()
    const sleep = game.menuEntries.find((e) => e.action?.id === 'sleep').action
    const tickBefore = game.time.tick
    await loop.resolvePlayerAction(sleep)
    expect(game.time.tick).toBe(tickBefore)
    expect(await narrativeSettle({ narrative })).toContain(sober('requirement.hour.early'))
  })

  it('picking someone out shows their actions; leaving lets them go', async () => {
    const game = startGame({ at: 'mocks_crest' })
    game.locationLearnApply({ locationId: 'mocks_crest' })
    game.characterRegister({ character: characterCreate(dale) })
    game.characterLocationSet({ characterId: 'dale', locationId: 'mocks_crest' })
    const talk = {
      id: 'talk_to_dale',
      label: 'Talk to Dale',
      locationId: 'mocks_crest',
      characterId: 'dale',
      requirements: {},
    }
    const beer = {
      id: 'order_beer',
      label: 'Order a beer',
      locationId: 'mocks_crest',
      requirements: {},
    }
    const loop = useGameLoop({ actionRegistry: [talk, beer] })
    loop.onLocationEntered()

    const offered = () =>
      game.menuEntries.filter((e) => e.kind === 'action').map((e) => e.action.id)
    expect(offered()).toEqual(['order_beer'])
    game.characterSelect({ characterId: 'dale' })
    expect(offered()).toEqual(['talk_to_dale'])
    game.characterSelect({ characterId: 'dale' })
    expect(offered()).toEqual(['order_beer'])

    game.characterSelect({ characterId: 'dale' })
    await loop.travel({ locationId: 'moms_house' })
    expect(game.characterSelectedId).toBeNull()
  })

  it('the inventory says which things can be used, by the same rule using them follows', () => {
    const game = startGame()
    game.player.inventory.push(
      { ...game.itemGet({ itemId: 'tallboy_oly' }) },
      { ...game.itemGet({ itemId: 'single_sock' }) }
    )
    const usable = Object.fromEntries(game.playerInventory.map((i) => [i.id, i.usable]))
    expect(usable).toEqual(
      Object.fromEntries([
        ['tallboy_oly', true],
        ['single_sock', false],
      ])
    )
  })

  it("the menu is headed by the question, the person picked out, or the event, in content's words", () => {
    const game = startGame({ at: 'mocks_crest' })
    game.characterRegister({ character: characterCreate(dale) })
    game.characterLocationSet({ characterId: 'dale', locationId: 'mocks_crest' })
    useGameLoop().onLocationEntered()
    expect(game.menuTitle).toBe(vocabulary.ui.menu.title)
    game.characterSelect({ characterId: 'dale' })
    expect(game.menuTitle).toBe(dale.name)
    expect(game.menuEmptyText).toBe(vocabulary.ui.menu.emptyWith.replace('{name}', dale.name))
    game.eventActiveSet({ event: { id: 'x', title: 'A knock', choices: [{ label: 'Answer' }] } })
    expect(game.menuTitle).toBe('A knock')
  })

  it('money reads as money', () => {
    const game = startGame()
    game.player.status.money = -2
    expect(game.playerMoneyText).toBe('-$2.00')
  })
})
