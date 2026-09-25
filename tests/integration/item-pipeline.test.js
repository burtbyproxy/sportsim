/**
 * Integration: using what you carry, and learning by doing.
 *
 * Items, substances, voices, actions, and tables come from content/. Things
 * are bought, found, and used through the real store and the real game loop.
 *
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { createPinia, setActivePinia } from 'pinia'
import { useGameStore } from '../../src/stores/game.js'
import { playerCreate } from '../../src/models/player.js'
import { itemCreate } from '../../src/models/item.js'
import { locationCreate } from '../../src/models/location.js'
import { characterCreate } from '../../src/models/character.js'
import { useNarrative } from '../../src/composables/useNarrative.js'
import { useGameLoop } from '../../src/composables/useGameLoop.js'
import { simulationLocal } from '../../src/workers/simulation-local.js'
import { statEffective } from '../../src/engine/dice.js'
import { contentDir, contentFile, tuningContent, voiceLineOf } from '../helpers/content.js'
import { narrativeSettle } from '../helpers/narrative.js'

const tuning = tuningContent()

const items = contentDir({ dir: 'content/items' }).flat()
const substances = contentDir({ dir: 'content/substances' })
const conditions = contentDir({ dir: 'content/conditions' })
const voices = contentDir({ dir: 'content/voices' })
const tables = contentDir({ dir: 'content/scavenge' })
const locations = contentDir({ dir: 'content/maps/kenton/locations' })
const parkActions = contentFile({ path: 'content/maps/kenton/actions/park.json' })
const scavengeAction = contentFile({ path: 'content/maps/kenton/actions/scavenge.json' })[0]

const maurice = contentFile({ path: 'content/characters/maurice.json' })
// Whoever takes over when you are starving, as content says.
const hungerPersonaId = conditions.find((c) => c.source?.status === 'hunger').persona.id

function startGame({ at = 'moms_house' } = {}) {
  setActivePinia(createPinia())
  const game = useGameStore()
  game.tuningRegister({ tuning })
  for (const item of items) game.itemRegister({ item: itemCreate(item) })
  for (const substance of substances) game.substanceRegister({ substance })
  for (const condition of conditions) game.conditionRegister({ condition })
  for (const v of voices) game.voiceRegister({ voice: v })
  for (const table of tables) game.scavengeTableRegister({ table })
  for (const location of locations) game.locationRegister({ location: locationCreate(location) })
  game.runStart({ player: playerCreate({ name: 'Tester' }), locationId: at })
  return game
}

/** Put n of a real content item in the player's hands, the way an outcome does. */
function give({ game, itemId, n = 1 }) {
  for (let i = 0; i < n; i++) game.player.inventory.push({ ...game.itemGet({ itemId }) })
  // stackables arrive one at a time through inventoryAdd in play; collapse them the same way
  const first = game.player.inventory.find((i) => i.id === itemId)
  if (first.stackable) {
    first.quantity = n
    game.player.inventory = game.player.inventory.filter((i) => i.id !== itemId || i === first)
  }
}

describe('item pipeline', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('a tallboy can finally be drunk: beer in, mood up, one fewer, a tick gone, and a line', async () => {
    const game = startGame()
    give({ game, itemId: 'tallboy_oly', n: 2 })
    const narrative = useNarrative({ tuning })
    const loop = useGameLoop({ narrative })
    const moodBefore = game.player.status.mood

    await loop.useItem({ itemId: 'tallboy_oly' })
    const entries = await narrativeSettle({ narrative })

    expect(game.player.intoxications.beer).toBe(18) // 20 in, 2 off over the tick
    expect(game.player.status.sobriety).toBe(82)
    expect(game.player.status.mood).toBeGreaterThan(moodBefore)
    expect(game.playerInventory).toEqual([
      expect.objectContaining({ id: 'tallboy_oly', quantity: 1 }),
    ])
    expect(game.time.tick).toBe(1)
    expect(entries.at(-1)).toBe(
      voiceLineOf({ personaId: 'sober', code: 'item.used' }).replace(
        '{item}',
        game.itemGet({ itemId: 'tallboy_oly' }).name
      )
    )
  })

  it('the last one leaves the inventory', async () => {
    const game = startGame()
    give({ game, itemId: 'coffee_711' })
    const loop = useGameLoop()
    await loop.useItem({ itemId: 'coffee_711' })
    expect(game.playerInventory).toEqual([])
    expect(game.player.intoxications.caffeine).toBeGreaterThan(0)
  })

  it('cigarettes build the habit the blend later punishes', async () => {
    const game = startGame()
    give({ game, itemId: 'pack_cigarettes', n: 3 })
    const loop = useGameLoop()
    for (let n = 0; n < 3; n++) await loop.useItem({ itemId: 'pack_cigarettes' })
    expect(game.player.habituations.nicotine).toBeGreaterThanOrEqual(30)
    await loop.tick({ ticks: 8 })
    expect(game.player.blend.weights.map((w) => w.personaId)).toContain('train_wreck')
  })

  it('you cannot drink a sock, and trying costs nothing', async () => {
    const game = startGame()
    give({ game, itemId: 'single_sock' })
    const result = game.playerItemUse({ itemId: 'single_sock' })
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('ITEM_NOT_CONSUMABLE')
    expect(game.playerInventory).toHaveLength(1)

    const narrative = useNarrative({ tuning })
    const loop = useGameLoop({ narrative })
    await loop.useItem({ itemId: 'single_sock' })
    expect(game.time.tick).toBe(0)
    // Nobody wrote a line for it yet, so it shows as its code: seen, not swallowed.
    expect(await narrativeSettle({ narrative })).toContain('[ITEM_NOT_CONSUMABLE]')
  })

  it('using something you do not have is refused with a code', () => {
    const game = startGame()
    expect(game.playerItemUse({ itemId: 'tallboy_oly' }).error.code).toBe('ITEM_MISSING')
  })

  it('an effect that names a stat becomes a modifier the dice read, and it wears off', async () => {
    const game = startGame()
    game.itemRegister({
      item: itemCreate({
        id: 'test_tonic',
        name: 'Tonic',
        type: 'consumable',
        effects: [{ target: 'wits', value: 5, duration: 3 }],
      }),
    })
    give({ game, itemId: 'test_tonic' })
    const loop = useGameLoop()
    const witsBefore = statEffective({ player: game.player, statName: 'wits' })

    await loop.useItem({ itemId: 'test_tonic' }) // one tick passes in the using
    expect(statEffective({ player: game.player, statName: 'wits' })).toBe(witsBefore + 5)

    await loop.tick({ ticks: 1 })
    await loop.tick({ ticks: 1 })
    expect(statEffective({ player: game.player, statName: 'wits' })).toBe(witsBefore)
  })

  it('nothing can be used while an event is waiting on a choice', async () => {
    const game = startGame()
    give({ game, itemId: 'tallboy_oly' })
    game.eventActiveSet({ event: { id: 'someone', choices: [{ label: 'x', outcome: {} }] } })
    const loop = useGameLoop()
    await loop.useItem({ itemId: 'tallboy_oly' })
    expect(game.playerInventory[0].quantity).toBe(1)
    expect(game.player.intoxications).toEqual({})
  })
})

describe('learning by doing', () => {
  it('a rolled check trains the stat it rolled on: more for a pass, less for a miss', async () => {
    const look = parkActions.find((a) => a.id === 'look_for_change')
    const stat = look.check.stat

    const lucky = startGame({ at: 'columbia_park' })
    const pass = useGameLoop({ actionRegistry: parkActions, rng: () => 0.9 })
    await pass.resolvePlayerAction(look)
    expect(lucky.player.stats[stat].xp).toBe(tuning.stats.xpCheckSuccess)

    const unlucky = startGame({ at: 'columbia_park' })
    unlucky.player.stats[stat].base = 1
    const miss = useGameLoop({ actionRegistry: parkActions, rng: () => 0.05 })
    await miss.resolvePlayerAction(look)
    expect(unlucky.player.stats[stat].xp).toBe(tuning.stats.xpCheckFailure)
  })

  it('an action with no check trains nothing', async () => {
    const game = startGame()
    const before = JSON.stringify(game.player.stats)
    const fridge = contentFile({ path: 'content/maps/kenton/actions/moms_house.json' }).find(
      (a) => a.id === 'raid_fridge'
    )
    await useGameLoop({ actionRegistry: [fridge] }).resolvePlayerAction(fridge)
    expect(JSON.stringify(game.player.stats)).toBe(before)
  })

  it('looking around trains the stat the table rolls on', async () => {
    const game = startGame() // the basement rolls wits
    const loop = useGameLoop({ actionRegistry: [scavengeAction], rng: () => 0.7 })
    await loop.resolvePlayerAction(scavengeAction)
    expect(game.player.stats.wits.xp).toBe(tuning.stats.xpCheckSuccess)
  })

  it('enough practice raises the stat itself', () => {
    const game = startGame()
    game.player.stats.luck = { base: 10, modifiers: [], xp: 0 }
    const threshold = 10 + 10 * 2
    const result = game.playerStatXpApply({ statName: 'luck', amount: threshold })
    expect(result.data.leveledUp).toBe(true)
    expect(game.player.stats.luck.base).toBe(11)
  })

  it('training a stat that does not exist is refused with a code', () => {
    const game = startGame()
    expect(game.playerStatXpApply({ statName: 'swagger', amount: 5 }).error.code).toBe(
      'STAT_UNKNOWN'
    )
  })
})

describe('failures are shown in play, never swallowed', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('a simulation that falls over says so, and the world waits a tick', async () => {
    const game = startGame()
    game.characterRegister({ character: characterCreate(maurice) })
    const narrative = useNarrative({ tuning })
    const broken = {
      tick: () => {
        throw new Error('worker gone')
      },
    }
    const loop = useGameLoop({ narrative, simulation: broken })

    await loop.tick({ ticks: 1 })

    expect(await narrativeSettle({ narrative })).toContain('[SIMULATION_FAILED]')
    expect(game.time.tick).toBe(1)
  })

  it('a character whose blend cannot be worked out is reported by name, after the tick', async () => {
    const game = startGame()
    game.characterRegister({
      character: characterCreate({
        ...maurice,
        intoxications: Object.fromEntries([['moonshine_x', 40]]),
      }),
    })
    const narrative = useNarrative({ tuning })
    const loop = useGameLoop({ narrative, simulation: simulationLocal })

    await loop.tick({ ticks: 1 })

    expect(await narrativeSettle({ narrative })).toContain('[SUBSTANCE_UNKNOWN]')
    expect(game.faults).toEqual([])
  })

  it('the store keeps the fault, with who it was about, until the loop takes it', () => {
    const game = startGame()
    game.characterRegister({
      character: characterCreate({
        ...maurice,
        intoxications: Object.fromEntries([['moonshine_x', 40]]),
      }),
    })
    game.blendRefresh()
    expect(game.faults[0]).toMatchObject({
      code: 'SUBSTANCE_UNKNOWN',
      params: { subjectId: 'maurice' },
    })
    expect(game.faultsDrain()).toHaveLength(1)
    expect(game.faults).toEqual([])
  })

  it('wearing off counts as its own failure, beside working out the blend', () => {
    const game = startGame()
    game.characterRegister({
      character: characterCreate({
        ...maurice,
        intoxications: Object.fromEntries([['moonshine_x', 40]]),
      }),
    })
    game.faultsDrain()
    game.blendDecayApply({ ticksElapsed: 1 })
    // One from the decay, one from the blend it refreshes after.
    expect(game.faultsDrain()).toEqual([
      expect.objectContaining({
        code: 'SUBSTANCE_UNKNOWN',
        params: expect.objectContaining({ subjectId: 'maurice' }),
      }),
      expect.objectContaining({
        code: 'SUBSTANCE_UNKNOWN',
        params: expect.objectContaining({ subjectId: 'maurice' }),
      }),
    ])
  })

  it('an outcome that gives an item nobody defined names the item', async () => {
    startGame()
    const narrative = useNarrative({ tuning })
    const loop = useGameLoop({ narrative })
    const gift = {
      id: 'gift',
      locationId: 'any',
      timeCost: 0,
      requirements: {},
      check: null,
      success: { narrative: 'Here.', itemsGained: ['nothing_real'] },
      failure: null,
    }

    await loop.resolvePlayerAction(gift)

    expect(await narrativeSettle({ narrative })).toContain('[ITEM_UNKNOWN]')
  })
})

describe('the store keeps statuses in bounds', () => {
  it('clamps to 0 and 100 whatever an outcome asks for', () => {
    const game = startGame()
    game.playerStatusApply({ changes: { mood: 500, hunger: -500 } })
    expect(game.player.status.mood).toBe(100)
    expect(game.player.status.hunger).toBe(0)
  })

  it("a character's status follows the same rule as the player's, and their conditions follow it", () => {
    const game = startGame()
    game.characterRegister({ character: characterCreate(maurice) })
    const before = { ...game.characters.maurice.status }

    game.charactersUpdatesApply({
      updates: [{ id: 'maurice', statusChanges: { hunger: -500, sobriety: -50, mood: 500 } }],
    })

    const after = game.characters.maurice.status
    expect(after.hunger).toBe(0)
    expect(after.mood).toBe(100)
    expect(after.sobriety).toBe(before.sobriety)
    expect(game.characters.maurice.blend.weights.map((w) => w.personaId)).toContain(hungerPersonaId)
  })

  it('time passing works on the characters too, by the same rule: the day wears, the stop gives', async () => {
    const game = startGame()
    game.characterRegister({ character: characterCreate(maurice) })
    const before = { ...game.characters.maurice.status }
    const loop = useGameLoop({ simulation: simulationLocal })
    // Until ten Maurice has nowhere to be, so he is at the away stop: home.
    const home = tuning.simulation.stops[tuning.simulation.awayStopType]

    await loop.tick({ ticks: 7 })

    const after = game.characters.maurice.status
    expect(after.hunger).toBe(
      before.hunger + 7 * (tuning.decay.hunger.ratePerTick + home.statusChangesPerTick.hunger)
    )
    // What he drank wears off, the way it does for the player.
    expect(after.sobriety).toBeGreaterThan(before.sobriety)
  })

  it('arriving somewhere counts the visit', () => {
    const game = startGame()
    const before = game.locations.columbia_park.visitCount
    game.playerMove({ locationId: 'columbia_park' })
    game.playerMove({ locationId: 'moms_house' })
    game.playerMove({ locationId: 'columbia_park' })
    expect(game.locations.columbia_park.visitCount).toBe(before + 2)
  })
})
