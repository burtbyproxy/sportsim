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
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createPinia, setActivePinia } from 'pinia'
import { useGameStore } from '../../src/stores/game.js'
import { createPlayer } from '../../src/models/player.js'
import { createLocation } from '../../src/models/location.js'
import { useNarrative } from '../../src/composables/useNarrative.js'
import { useGameLoop } from '../../src/composables/useGameLoop.js'

const momsHouse = JSON.parse(
  readFileSync(resolve('content/maps/kenton/locations/moms_house.json'), 'utf-8')
)
const momsHouseActions = JSON.parse(
  readFileSync(resolve('content/maps/kenton/actions/moms_house.json'), 'utf-8')
)
const byId = (id) => momsHouseActions.find((a) => a.id === id)

function startGame() {
  setActivePinia(createPinia())
  const game = useGameStore()
  game.registerLocation(createLocation(momsHouse))
  game.startNewGame(createPlayer('Tester'), 'moms_house')
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

    const expected = byId('stare_at_ceiling').success.narrative.tokens.map((t) => t.text).join('')
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
    game.registerLocation(createLocation(columbiaPark))
    const save = useSave()
    const loop = useGameLoop({ actionRegistry: momsHouseActions, save })

    await loop.travel('columbia_park', 2)

    const saves = save.listSaves()
    expect(saves).toHaveLength(1)
    expect(saves[0].name).toBe(AUTO_SAVE_NAME)

    const data = save.load(saves[0].id)
    expect(data.player.currentLocationId).toBe('columbia_park')
    expect(data.time.tick).toBe(2)
    expect(data.locations.columbia_park.visitCount).toBe(1)
  })

  it('the auto-save slot is replaced, not accumulated', async () => {
    const game = startGame()
    game.registerLocation(createLocation(columbiaPark))
    const save = useSave()
    const loop = useGameLoop({ actionRegistry: momsHouseActions, save })

    await loop.travel('columbia_park', 1)
    await loop.travel('moms_house', 1)

    const saves = save.listSaves()
    expect(saves).toHaveLength(1)
    expect(save.load(saves[0].id).player.currentLocationId).toBe('moms_house')
  })

  it('a fresh store restored from the auto-save resumes where the player was', async () => {
    const game = startGame()
    game.registerLocation(createLocation(columbiaPark))
    const save = useSave()
    const loop = useGameLoop({ actionRegistry: momsHouseActions, save })
    await loop.resolvePlayerAction(byId('raid_fridge'))
    await loop.travel('columbia_park', 1)
    const hungerAtSave = game.player.status.hunger

    setActivePinia(createPinia())
    const restored = useGameStore()
    expect(restored.isRunning).toBe(false)
    const [entry] = useSave().listSaves()
    restored.loadSave(useSave().load(entry.id))

    expect(restored.isRunning).toBe(true)
    expect(restored.currentLocationId).toBe('columbia_park')
    expect(restored.player.status.hunger).toBe(hungerAtSave)
    expect(restored.time.tick).toBe(2)
  })

  it('actions alone do not write a save', async () => {
    startGame()
    const save = useSave()
    const loop = useGameLoop({ actionRegistry: momsHouseActions, save })
    await loop.resolvePlayerAction(byId('raid_fridge'))
    expect(save.listSaves()).toHaveLength(0)
  })
})
