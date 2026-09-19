/**
 * Integration: the game loop feeds action prose to the narrative renderer.
 *
 * Raid the fridge and stare at the ceiling changed stats and time but said
 * nothing, because the loop tried to inject a renderer that the same
 * component had provided, and Vue only injects from the parent. The renderer
 * is now an explicit input. This test drives a real action from content/
 * through the loop and asserts its text lands in the log.
 *
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'
import { createPinia, setActivePinia } from 'pinia'
import { useGameStore } from '../../src/stores/game.js'
import { playerCreate } from '../../src/models/player.js'
import { locationCreate } from '../../src/models/location.js'
import { characterCreate } from '../../src/models/character.js'
import { useNarrative } from '../../src/composables/useNarrative.js'
import { useGameLoop } from '../../src/composables/useGameLoop.js'

const momsHouse = JSON.parse(
  readFileSync(resolve('content/maps/kenton/locations/moms_house.json'), 'utf-8')
)
const momsHouseActions = JSON.parse(
  readFileSync(resolve('content/maps/kenton/actions/moms_house.json'), 'utf-8')
)
const byId = (id) => momsHouseActions.find((a) => a.id === id)
const mocksCrest = JSON.parse(
  readFileSync(resolve('content/maps/kenton/locations/mocks_crest.json'), 'utf-8')
)
const talkToDale = JSON.parse(
  readFileSync(resolve('content/maps/kenton/actions/npc_interactions.json'), 'utf-8')
).find((a) => a.id === 'talk_to_dale')
const dale = JSON.parse(readFileSync(resolve('content/characters/dale.json'), 'utf-8'))
const voices = readdirSync(resolve('content/voices')).map((file) =>
  JSON.parse(readFileSync(resolve('content/voices', file), 'utf-8'))
)
const substances = readdirSync(resolve('content/substances')).map((file) =>
  JSON.parse(readFileSync(resolve('content/substances', file), 'utf-8'))
)

function startGame() {
  setActivePinia(createPinia())
  const game = useGameStore()
  game.registerLocation(locationCreate(momsHouse))
  for (const substance of substances) game.registerSubstance({ substance })
  game.startNewGame(playerCreate({ name: 'Tester' }), 'moms_house')
  return game
}

async function settle(narrative) {
  await vi.advanceTimersByTimeAsync(20000)
  return narrative.log.value.map((entry) => entry.tokens.map((t) => t.rendered).join(''))
}

describe('useGameLoop → narrative', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('raiding the fridge writes its prose to the log and raises hunger', async () => {
    const game = startGame()
    const narrative = useNarrative()
    const loop = useGameLoop({ actionRegistry: momsHouseActions, narrative })
    const hungerBefore = game.player.status.hunger
    const tickBefore = game.time.tick

    await loop.resolvePlayerAction(byId('raid_fridge'))
    const entries = await settle(narrative)

    expect(entries).toHaveLength(1)
    expect(entries[0]).toContain('You eat the cheese.')
    expect(game.player.status.hunger).toBeGreaterThan(hungerBefore)
    expect(game.time.tick).toBe(tickBefore + 1)
  })

  it('staring at the ceiling writes its prose too', async () => {
    startGame()
    const narrative = useNarrative()
    const loop = useGameLoop({ actionRegistry: momsHouseActions, narrative })

    await loop.resolvePlayerAction(byId('stare_at_ceiling'))
    const entries = await settle(narrative)

    const expected = byId('stare_at_ceiling')
      .success.narrative.tokens.map((t) => t.text)
      .join('')
    expect(entries).toEqual([expected])
  })

  it('two actions in a row produce two log entries in order', async () => {
    startGame()
    const narrative = useNarrative()
    const loop = useGameLoop({ actionRegistry: momsHouseActions, narrative })

    await loop.resolvePlayerAction(byId('raid_fridge'))
    await loop.resolvePlayerAction(byId('stare_at_ceiling'))
    const entries = await settle(narrative)

    expect(entries).toHaveLength(2)
    expect(entries[0]).toContain('cheese')
    expect(entries[1]).not.toContain('cheese')
  })

  it('runs without a renderer at all', async () => {
    const game = startGame()
    const loop = useGameLoop({ actionRegistry: momsHouseActions })
    await expect(loop.resolvePlayerAction(byId('raid_fridge'))).resolves.toBeUndefined()
    expect(game.time.tick).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Auto-save on arrival
// ---------------------------------------------------------------------------

import { useSave, AUTO_SAVE_NAME } from '../../src/composables/useSave.js'

const columbiaPark = JSON.parse(
  readFileSync(resolve('content/maps/kenton/locations/columbia_park.json'), 'utf-8')
)

function installLocalStorage() {
  let store = {}
  globalThis.localStorage = {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => {
      store[key] = String(value)
    },
    removeItem: (key) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
}

describe('useGameLoop → auto-save', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    installLocalStorage()
  })
  afterEach(() => {
    vi.useRealTimers()
    delete globalThis.localStorage
  })

  it('arriving somewhere writes the auto-save slot with the new location and time', async () => {
    const game = startGame()
    game.registerLocation(locationCreate(columbiaPark))
    const save = useSave()
    const loop = useGameLoop({ actionRegistry: momsHouseActions, save })

    await loop.travel({ locationId: 'columbia_park', travelTicks: 2 })

    const saves = save.savesList().data
    expect(saves).toHaveLength(1)
    expect(saves[0].name).toBe(AUTO_SAVE_NAME)

    const data = save.saveRead({ id: saves[0].id }).data
    expect(data.player.currentLocationId).toBe('columbia_park')
    expect(data.time.tick).toBe(2)
    expect(data.locations.columbia_park.visitCount).toBe(1)
  })

  it('the auto-save slot is replaced, not accumulated', async () => {
    const game = startGame()
    game.registerLocation(locationCreate(columbiaPark))
    const save = useSave()
    const loop = useGameLoop({ actionRegistry: momsHouseActions, save })

    await loop.travel({ locationId: 'columbia_park', travelTicks: 1 })
    await loop.travel({ locationId: 'moms_house', travelTicks: 1 })

    const saves = save.savesList().data
    expect(saves).toHaveLength(1)
    expect(save.saveRead({ id: saves[0].id }).data.player.currentLocationId).toBe('moms_house')
  })

  it('a fresh store restored from the auto-save resumes where the player was', async () => {
    const game = startGame()
    game.registerLocation(locationCreate(columbiaPark))
    const save = useSave()
    const loop = useGameLoop({ actionRegistry: momsHouseActions, save })
    await loop.resolvePlayerAction(byId('raid_fridge'))
    await loop.travel({ locationId: 'columbia_park', travelTicks: 1 })
    const hungerAtSave = game.player.status.hunger

    setActivePinia(createPinia())
    const restored = useGameStore()
    expect(restored.isRunning).toBe(false)
    const [entry] = useSave().savesList().data
    restored.loadSave(useSave().saveRead({ id: entry.id }).data)

    expect(restored.isRunning).toBe(true)
    expect(restored.currentLocationId).toBe('columbia_park')
    expect(restored.player.status.hunger).toBe(hungerAtSave)
    expect(restored.time.tick).toBe(2)
  })

  it('a save that cannot be written is said out loud, not swallowed', async () => {
    const game = startGame()
    game.registerLocation(locationCreate(columbiaPark))
    for (const voice of voices) game.registerVoice({ voice })
    globalThis.localStorage.setItem = () => {
      throw new Error('QuotaExceededError')
    }
    const narrative = useNarrative()
    const loop = useGameLoop({ actionRegistry: momsHouseActions, narrative, save: useSave() })

    await loop.travel({ locationId: 'columbia_park', travelTicks: 1 })
    const entries = await settle(narrative)

    expect(entries).toContain(voices.find((v) => v.id === 'sober').lines['save.failed'])
  })

  it('actions alone do not write a save', async () => {
    startGame()
    const save = useSave()
    const loop = useGameLoop({ actionRegistry: momsHouseActions, save })
    await loop.resolvePlayerAction(byId('raid_fridge'))
    expect(save.savesList().data).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Events: the world happens to the player
// ---------------------------------------------------------------------------

const kentonEvents = ['street', 'moms_house', 'bars', 'park', 'market'].flatMap((name) =>
  JSON.parse(readFileSync(resolve(`content/maps/kenton/events/${name}.json`), 'utf-8'))
)
const eventById = (id) => kentonEvents.find((e) => e.id === id)
const always = () => 0 // randomChance({ probability: p }) is rng() < p, so 0 fires anything with p > 0
const never = () => 0.999

describe('useGameLoop → events', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('a random event fires on the tick, says its piece, and applies its outcome', async () => {
    const game = startGame()
    const narrative = useNarrative()
    const loop = useGameLoop({
      actionRegistry: momsHouseActions,
      eventRegistry: [eventById('found_change')],
      narrative,
      rng: always,
    })
    const moneyBefore = game.player.status.money

    await loop.tick({ ticks: 1 })
    const entries = await settle(narrative)

    expect(entries).toHaveLength(1)
    expect(entries[0]).toContain('money on the ground')
    expect(game.player.status.money).toBeCloseTo(moneyBefore + 0.6, 5)
    expect(game.player.counters.change_found).toBe(1)
  })

  it('nothing fires when the roll misses', async () => {
    const game = startGame()
    const narrative = useNarrative()
    const loop = useGameLoop({
      actionRegistry: momsHouseActions,
      eventRegistry: [eventById('found_change')],
      narrative,
      rng: never,
    })
    await loop.tick({ ticks: 1 })
    expect(await settle(narrative)).toHaveLength(0)
    expect(game.activeEvent).toBeNull()
  })

  it('a one-time triggered event fires once and never again', async () => {
    const game = startGame()
    game.player.status.hunger = 10
    const narrative = useNarrative()
    const loop = useGameLoop({
      actionRegistry: momsHouseActions,
      eventRegistry: [eventById('first_starving')],
      narrative,
      rng: never,
    })

    await loop.tick({ ticks: 1 })
    await loop.tick({ ticks: 1 })
    await loop.tick({ ticks: 1 })

    expect(await settle(narrative)).toHaveLength(1)
    expect(game.firedEventIds).toEqual(['first_starving'])
    expect(game.player.counters.times_starving).toBe(1)
  })

  it('an event with choices waits on the player, then the choice resolves it', async () => {
    const game = startGame()
    const narrative = useNarrative()
    const loop = useGameLoop({
      actionRegistry: momsHouseActions,
      eventRegistry: [eventById('mom_upstairs')],
      narrative,
      rng: always,
    })
    await loop.tick({ ticks: 16 }) // 8:00 → 12:00, inside mom's waking hours
    expect(game.activeEvent?.id).toBe('mom_upstairs')
    const hungerBefore = game.player.status.hunger

    loop.resolveEventChoice({ choiceIndex: 1 })
    const entries = await settle(narrative)

    expect(game.activeEvent).toBeNull()
    expect(entries).toHaveLength(2)
    expect(entries[1]).toContain('sandwich')
    expect(game.player.status.hunger).toBe(hungerBefore + 20)
    expect(game.player.counters.talks_with_mom).toBe(1)
  })

  it('no second event fires while a choice is pending', async () => {
    const game = startGame()
    const loop = useGameLoop({
      actionRegistry: momsHouseActions,
      eventRegistry: [eventById('mom_upstairs'), eventById('found_change')],
      rng: always,
    })
    await loop.tick({ ticks: 16 })
    const moneyAfterFirst = game.player.status.money
    await loop.tick({ ticks: 1 })
    expect(game.activeEvent?.id).toBe('mom_upstairs')
    expect(game.player.status.money).toBe(moneyAfterFirst)
  })

  it('a checked choice that fails applies the failure outcome', async () => {
    const game = startGame()
    // The cruiser works the street, so be on it.
    game.registerLocation(locationCreate(columbiaPark))
    game.moveTo('columbia_park')
    const narrative = useNarrative()
    // A low roll botches every check. Force the event by type so the roll only governs the check.
    const botch = () => 0.001
    const cop = { ...eventById('cop_hassle'), type: 'triggered' }
    const loop = useGameLoop({
      actionRegistry: momsHouseActions,
      eventRegistry: [cop],
      narrative,
      rng: botch,
    })

    await loop.tick({ ticks: 56 }) // 8:00 → 22:00, after the cruiser starts prowling
    game.applyDoses({ doses: [{ substanceId: 'beer', value: 80 }] }) // sobriety 20; beer wears off over time
    await loop.tick({ ticks: 1 })
    expect(game.activeEvent?.id).toBe('cop_hassle')
    loop.resolveEventChoice({ choiceIndex: 1 })
    const entries = await settle(narrative)

    expect(entries[1]).toContain('spotlight')
    expect(game.player.counters.times_detained).toBe(1)
  })

  it('the pending event survives the auto-save round trip', async () => {
    const game = startGame()
    const columbia = locationCreate(columbiaPark)
    game.registerLocation(columbia)
    installLocalStorage()
    const save = useSave()
    const loop = useGameLoop({
      actionRegistry: momsHouseActions,
      eventRegistry: [eventById('park_acquaintance')],
      save,
      rng: always,
    })
    await loop.tick({ ticks: 16 }) // noon; nothing fires at home for a park event

    await loop.travel({ locationId: 'columbia_park', travelTicks: 1 })
    expect(game.activeEvent?.id).toBe('park_acquaintance')

    setActivePinia(createPinia())
    const restored = useGameStore()
    const [entry] = useSave().savesList().data
    restored.loadSave(useSave().saveRead({ id: entry.id }).data)
    expect(restored.activeEvent?.id).toBe('park_acquaintance')
    delete globalThis.localStorage
  })
})

describe('useGameLoop → scene order on arrival', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('the new place is described first and an arrival event lands beneath it', async () => {
    const game = startGame()
    game.registerLocation(locationCreate(columbiaPark))
    const narrative = useNarrative()
    const loop = useGameLoop({
      actionRegistry: momsHouseActions,
      eventRegistry: [eventById('found_change')],
      narrative,
      rng: always,
    })

    await loop.travel({ locationId: 'columbia_park', travelTicks: 1 })
    const entries = await settle(narrative)

    expect(entries).toHaveLength(2)
    expect(entries[0]).toContain('Columbia Park')
    expect(entries[1]).toContain('money on the ground')
  })

  it('mounting the screen with a pending event puts the event back in front', async () => {
    const game = startGame()
    const narrative = useNarrative()
    game.setActiveEvent(eventById('mom_upstairs'))
    const loop = useGameLoop({ actionRegistry: momsHouseActions, narrative })

    loop.onLocationEntered()
    const entries = await settle(narrative)

    expect(entries).toHaveLength(2)
    expect(entries[1]).toContain('You okay down there')
  })
})

describe('useGameLoop → visits and company', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  // Dale tends bar at Mock's Crest and talks to regulars. Everything here is
  // content: the bar, Dale, and what it takes to get a word out of him.
  function startAtTheBar({ visits, daleIn }) {
    setActivePinia(createPinia())
    const game = useGameStore()
    game.registerLocation(locationCreate(momsHouse))
    game.registerLocation(locationCreate(mocksCrest))
    for (const substance of substances) game.registerSubstance({ substance })
    for (const voice of voices) game.registerVoice({ voice })
    game.startNewGame(playerCreate({ name: 'Tester' }), 'moms_house')
    game.registerCharacter(characterCreate(dale))
    for (let n = 0; n < visits; n++) {
      game.moveTo('mocks_crest')
      if (n < visits - 1) game.moveTo('moms_house')
    }
    game.setCharacterLocation('dale', daleIn ? 'mocks_crest' : 'moms_house')
    return game
  }

  const onTheMenu = (game) => game.availableActions.find((a) => a.id === talkToDale.id)

  it('with Dale out, there is no one to talk to, however often you come', () => {
    const game = startAtTheBar({ visits: 5, daleIn: false })
    const loop = useGameLoop({ actionRegistry: [talkToDale] })
    loop.onLocationEntered()
    expect(onTheMenu(game)).toBeUndefined()
  })

  it('a first-time visitor sees Dale greyed out, and asking anyway is refused', async () => {
    const game = startAtTheBar({ visits: 1, daleIn: true })
    const narrative = useNarrative()
    const loop = useGameLoop({ actionRegistry: [talkToDale], narrative, rng: () => 0.9 })
    loop.onLocationEntered()

    expect(onTheMenu(game).available).toBe(false)
    await loop.resolvePlayerAction(talkToDale)
    const entries = await settle(narrative)

    expect(entries.at(-1)).toBe(voices.find((v) => v.id === 'sober').lines['requirement.visits'])
  })

  it('a regular gets Dale on the menu, and talking to him goes through', async () => {
    const game = startAtTheBar({ visits: 2, daleIn: true })
    const narrative = useNarrative()
    const loop = useGameLoop({ actionRegistry: [talkToDale], narrative, rng: () => 0.9 })
    loop.onLocationEntered()

    expect(onTheMenu(game).available).toBe(true)
    await loop.resolvePlayerAction(talkToDale)
    const entries = await settle(narrative)

    expect(entries.join('')).toContain(talkToDale.success.narrative.tokens[1].text)
  })
})
