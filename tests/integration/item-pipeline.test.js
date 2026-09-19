/**
 * Integration: using what you carry, and learning by doing.
 *
 * Items, substances, voices, actions, and tables come from content/. Things
 * are bought, found, and used through the real store and the real game loop.
 *
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'
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
import { STAT_XP_CHECK_SUCCESS, STAT_XP_CHECK_FAILURE } from '../../src/engine/stats.js'

const loadDir = (dir) =>
  readdirSync(resolve(dir))
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(resolve(dir, f), 'utf-8')))
const loadFile = (path) => JSON.parse(readFileSync(resolve(path), 'utf-8'))

const items = loadDir('content/items').flat()
const substances = loadDir('content/substances')
const conditions = loadDir('content/conditions')
const voices = loadDir('content/voices')
const tables = loadDir('content/scavenge')
const locations = loadDir('content/maps/kenton/locations')
const parkActions = loadFile('content/maps/kenton/actions/park.json')
const scavengeAction = loadFile('content/maps/kenton/actions/scavenge.json')[0]

const maurice = loadFile('content/characters/maurice.json')
// Whoever takes over when you are starving, as content says.
const hungerPersonaId = conditions.find((c) => c.source?.status === 'hunger').persona.id

const voice = (personaId, code) => voices.find((v) => v.id === personaId).lines[code]

function startGame({ at = 'moms_house' } = {}) {
  setActivePinia(createPinia())
  const game = useGameStore()
  for (const item of items) game.registerItem(itemCreate(item))
  for (const substance of substances) game.registerSubstance({ substance })
  for (const condition of conditions) game.registerCondition({ condition })
  for (const v of voices) game.registerVoice({ voice: v })
  for (const table of tables) game.registerScavengeTable({ table })
  for (const location of locations) game.registerLocation(locationCreate(location))
  game.startNewGame(playerCreate({ name: 'Tester' }), at)
  return game
}

/** Put n of a real content item in the player's hands, the way an outcome does. */
function give(game, itemId, n = 1) {
  for (let i = 0; i < n; i++) game.player.inventory.push({ ...game.getItem(itemId) })
  // stackables arrive one at a time through inventoryAdd in play; collapse them the same way
  const first = game.player.inventory.find((i) => i.id === itemId)
  if (first.stackable) {
    first.quantity = n
    game.player.inventory = game.player.inventory.filter((i) => i.id !== itemId || i === first)
  }
}

async function settle(narrative) {
  await vi.advanceTimersByTimeAsync(60000)
  return narrative.log.value.map((entry) => entry.tokens.map((t) => t.rendered).join(''))
}

describe('item pipeline', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('a tallboy can finally be drunk: beer in, mood up, one fewer, a tick gone, and a line', async () => {
    const game = startGame()
    give(game, 'tallboy_oly', 2)
    const narrative = useNarrative()
    const loop = useGameLoop({ narrative })
    const moodBefore = game.player.status.mood

    await loop.useItem({ itemId: 'tallboy_oly' })
    const entries = await settle(narrative)

    expect(game.player.intoxications.beer).toBe(18) // 20 in, 2 off over the tick
    expect(game.player.status.sobriety).toBe(82)
    expect(game.player.status.mood).toBeGreaterThan(moodBefore)
    expect(game.playerInventory).toEqual([
      expect.objectContaining({ id: 'tallboy_oly', quantity: 1 }),
    ])
    expect(game.time.tick).toBe(1)
    expect(entries.at(-1)).toBe(
      voice('sober', 'item.used').replace('{item}', game.getItem('tallboy_oly').name)
    )
  })

  it('the last one leaves the inventory', async () => {
    const game = startGame()
    give(game, 'coffee_711')
    const loop = useGameLoop()
    await loop.useItem({ itemId: 'coffee_711' })
    expect(game.playerInventory).toEqual([])
    expect(game.player.intoxications.caffeine).toBeGreaterThan(0)
  })

  it('cigarettes build the habit the blend later punishes', async () => {
    const game = startGame()
    give(game, 'pack_cigarettes', 3)
    const loop = useGameLoop()
    for (let n = 0; n < 3; n++) await loop.useItem({ itemId: 'pack_cigarettes' })
    expect(game.player.habituations.nicotine).toBeGreaterThanOrEqual(30)
    await loop.tick(8)
    expect(game.player.blend.weights.map((w) => w.personaId)).toContain('train_wreck')
  })

  it('you cannot drink a sock, and trying costs nothing', async () => {
    const game = startGame()
    give(game, 'single_sock')
    const result = game.applyItemUse({ itemId: 'single_sock' })
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('ITEM_NOT_CONSUMABLE')
    expect(game.playerInventory).toHaveLength(1)

    const narrative = useNarrative()
    const loop = useGameLoop({ narrative })
    await loop.useItem({ itemId: 'single_sock' })
    expect(game.time.tick).toBe(0)
    // Nobody wrote a line for it yet, so it shows as its code: seen, not swallowed.
    expect(await settle(narrative)).toContain('[ITEM_NOT_CONSUMABLE]')
  })

  it('using something you do not have is refused with a code', () => {
    const game = startGame()
    expect(game.applyItemUse({ itemId: 'tallboy_oly' }).error.code).toBe('ITEM_MISSING')
  })

  it('an effect that names a stat becomes a modifier the dice read, and it wears off', async () => {
    const game = startGame()
    game.registerItem(
      itemCreate({
        id: 'test_tonic',
        name: 'Tonic',
        type: 'consumable',
        effects: [{ target: 'wits', value: 5, duration: 3 }],
      })
    )
    give(game, 'test_tonic')
    const loop = useGameLoop()
    const witsBefore = statEffective({ player: game.player, statName: 'wits' })

    await loop.useItem({ itemId: 'test_tonic' }) // one tick passes in the using
    expect(statEffective({ player: game.player, statName: 'wits' })).toBe(witsBefore + 5)

    await loop.tick(1)
    await loop.tick(1)
    expect(statEffective({ player: game.player, statName: 'wits' })).toBe(witsBefore)
  })

  it('nothing can be used while an event is waiting on a choice', async () => {
    const game = startGame()
    give(game, 'tallboy_oly')
    game.setActiveEvent({ id: 'someone', choices: [{ label: 'x', outcome: {} }] })
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
    expect(lucky.player.stats[stat].xp).toBe(STAT_XP_CHECK_SUCCESS)

    const unlucky = startGame({ at: 'columbia_park' })
    unlucky.player.stats[stat].base = 1
    const miss = useGameLoop({ actionRegistry: parkActions, rng: () => 0.05 })
    await miss.resolvePlayerAction(look)
    expect(unlucky.player.stats[stat].xp).toBe(STAT_XP_CHECK_FAILURE)
  })

  it('an action with no check trains nothing', async () => {
    const game = startGame()
    const before = JSON.stringify(game.player.stats)
    const fridge = loadFile('content/maps/kenton/actions/moms_house.json').find(
      (a) => a.id === 'raid_fridge'
    )
    await useGameLoop({ actionRegistry: [fridge] }).resolvePlayerAction(fridge)
    expect(JSON.stringify(game.player.stats)).toBe(before)
  })

  it('looking around trains the stat the table rolls on', async () => {
    const game = startGame() // the basement rolls wits
    const loop = useGameLoop({ actionRegistry: [scavengeAction], rng: () => 0.7 })
    await loop.resolvePlayerAction(scavengeAction)
    expect(game.player.stats.wits.xp).toBe(STAT_XP_CHECK_SUCCESS)
  })

  it('enough practice raises the stat itself', () => {
    const game = startGame()
    game.player.stats.luck = { base: 10, modifiers: [], xp: 0 }
    const threshold = 10 + 10 * 2
    const result = game.applyStatXp({ statName: 'luck', amount: threshold })
    expect(result.data.leveledUp).toBe(true)
    expect(game.player.stats.luck.base).toBe(11)
  })

  it('training a stat that does not exist is refused with a code', () => {
    const game = startGame()
    expect(game.applyStatXp({ statName: 'swagger', amount: 5 }).error.code).toBe('STAT_UNKNOWN')
  })
})

describe('failures are shown in play, never swallowed', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('a simulation that falls over says so, and the world waits a tick', async () => {
    const game = startGame()
    game.registerCharacter(characterCreate(maurice))
    const narrative = useNarrative()
    const broken = {
      tick: () => {
        throw new Error('worker gone')
      },
    }
    const loop = useGameLoop({ narrative, simulation: broken })

    await loop.tick(1)

    expect(await settle(narrative)).toContain('[SIMULATION_FAILED]')
    expect(game.time.tick).toBe(1)
  })

  it('a character whose blend cannot be worked out is reported by name, after the tick', async () => {
    const game = startGame()
    game.registerCharacter(characterCreate({ ...maurice, intoxications: { moonshine_x: 40 } }))
    const narrative = useNarrative()
    const loop = useGameLoop({ narrative, simulation: simulationLocal })

    await loop.tick(1)

    expect(await settle(narrative)).toContain('[SUBSTANCE_UNKNOWN]')
    expect(game.faults).toEqual([])
  })

  it('the store keeps the fault, with who it was about, until the loop takes it', () => {
    const game = startGame()
    game.registerCharacter(characterCreate({ ...maurice, intoxications: { moonshine_x: 40 } }))
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
    game.registerCharacter(characterCreate({ ...maurice, intoxications: { moonshine_x: 40 } }))
    game.faultsDrain()
    game.applyBlendDecay({ ticksElapsed: 1 })
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
    const narrative = useNarrative()
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

    expect(await settle(narrative)).toContain('[ITEM_UNKNOWN]')
  })
})

describe('the store keeps statuses in bounds', () => {
  it('clamps to 0 and 100 whatever an outcome asks for', () => {
    const game = startGame()
    game.applyStatusChanges({ mood: 500, hunger: -500 })
    expect(game.player.status.mood).toBe(100)
    expect(game.player.status.hunger).toBe(0)
  })

  it("a character's status follows the same rule as the player's, and their conditions follow it", () => {
    const game = startGame()
    game.registerCharacter(characterCreate(maurice))
    const before = { ...game.characters.maurice.status }

    game.charactersStatusApply({
      updates: [{ id: 'maurice', statusChanges: { hunger: -500, sobriety: -50, mood: 500 } }],
    })

    const after = game.characters.maurice.status
    expect(after.hunger).toBe(0)
    expect(after.mood).toBe(100)
    expect(after.sobriety).toBe(before.sobriety)
    expect(game.characters.maurice.blend.weights.map((w) => w.personaId)).toContain(hungerPersonaId)
  })

  it('time passing wears on the characters too, by the same rule', async () => {
    const game = startGame()
    game.registerCharacter(characterCreate(maurice))
    const before = { ...game.characters.maurice.status }
    const loop = useGameLoop({ simulation: simulationLocal })

    await loop.tick(8)

    const after = game.characters.maurice.status
    expect(after.hunger).toBeLessThan(before.hunger)
    // What he drank wears off, the way it does for the player.
    expect(after.sobriety).toBeGreaterThan(before.sobriety)
  })

  it('arriving somewhere counts the visit', () => {
    const game = startGame()
    const before = game.locations.columbia_park.visitCount
    game.moveTo('columbia_park')
    game.moveTo('moms_house')
    game.moveTo('columbia_park')
    expect(game.locations.columbia_park.visitCount).toBe(before + 2)
  })
})
