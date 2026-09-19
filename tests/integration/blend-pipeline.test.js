/**
 * Integration: the blend at the boundary.
 *
 * Substances and conditions come from content/. Doses go in through the store,
 * ticks go through the game loop, and the assertions are on what every other
 * module reads: derived sobriety, the blend snapshot, and the dice.
 *
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'
import { createPinia, setActivePinia } from 'pinia'
import { useGameStore } from '../../src/stores/game.js'
import { playerCreate } from '../../src/models/player.js'
import { characterCreate } from '../../src/models/character.js'
import { locationCreate } from '../../src/models/location.js'
import { useGameLoop } from '../../src/composables/useGameLoop.js'
import { statEffective } from '../../src/engine/dice.js'
import { SOBER_PERSONA_ID, PERSONA_SOURCES } from '../../src/engine/blend.js'

const loadDir = (dir) =>
  readdirSync(resolve(dir))
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(resolve(dir, f), 'utf-8')))

const substances = loadDir('content/substances')
const conditions = loadDir('content/conditions')
const momsHouse = JSON.parse(
  readFileSync(resolve('content/maps/kenton/locations/moms_house.json'), 'utf-8')
)
const blueParrot = JSON.parse(
  readFileSync(resolve('content/maps/kenton/locations/blue_parrot.json'), 'utf-8')
)
const barActions = JSON.parse(
  readFileSync(resolve('content/maps/kenton/actions/bars.json'), 'utf-8')
)
const maurice = JSON.parse(readFileSync(resolve('content/characters/maurice.json'), 'utf-8'))

function startGame({ at = 'moms_house' } = {}) {
  setActivePinia(createPinia())
  const game = useGameStore()
  for (const substance of substances) game.registerSubstance({ substance })
  for (const condition of conditions) game.registerCondition({ condition })
  game.registerLocation(locationCreate(momsHouse))
  game.registerLocation(locationCreate(blueParrot))
  game.startNewGame(playerCreate({ name: 'Tester' }), at)
  return game
}

const personaIds = (game) => game.player.blend.weights.map((w) => w.personaId)

describe('blend pipeline', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('a new player is sober with an empty blend', () => {
    const game = startGame()
    expect(game.player.intoxications).toEqual({})
    expect(game.player.status.sobriety).toBe(100)
    expect(game.player.blend.dominantPersonaId).toBe(SOBER_PERSONA_ID)
    expect(game.player.blend.soberWeight).toBe(1)
  })

  it('a dose lowers derived sobriety, weights the persona, and moves the dice', () => {
    const game = startGame()
    const charmBefore = statEffective({ player: game.player, statName: 'charm' })

    const result = game.applyDoses({ doses: [{ substanceId: 'beer', value: 40 }] })

    expect(result.ok).toBe(true)
    expect(game.player.intoxications).toEqual({ beer: 40 })
    expect(game.player.status.sobriety).toBe(60)
    expect(game.player.blend.weights).toEqual([
      {
        personaId: 'one_of_the_guys',
        weight: 0.4,
        source: PERSONA_SOURCES.SUBSTANCE,
        sourceId: 'beer',
      },
    ])
    expect(game.player.blend.families).toEqual({ alcohol: 0.4 })
    // beer band 15: charm +3, luck +1, stamina -2, wits -2
    expect(statEffective({ player: game.player, statName: 'charm' })).toBe(charmBefore + 3)
  })

  it('a real bar action doses through the game loop', async () => {
    const game = startGame({ at: 'blue_parrot' })
    game.player.status.money = 10
    const loop = useGameLoop({ actionRegistry: barActions })
    const order = barActions.find((a) => a.id === 'order_beer_parrot')

    await loop.tick(12) // 8:00 → 11:00, when the Parrot starts pouring
    await loop.resolvePlayerAction(order)

    // 15 in, 2 off over the action's tick
    expect(game.player.intoxications.beer).toBe(13)
    expect(game.player.status.sobriety).toBe(87)
    expect(game.player.status.money).toBe(7)
  })

  it('each substance wears off on its own clock as ticks pass', async () => {
    const game = startGame()
    const loop = useGameLoop()
    game.applyDoses({
      doses: [
        { substanceId: 'whiskey', value: 30 },
        { substanceId: 'weed', value: 30 },
      ],
    })

    await loop.tick(4)

    // whiskey 1.5/tick, weed 3/tick
    expect(game.player.intoxications).toEqual({ whiskey: 24, weed: 18 })
    expect(game.player.status.sobriety).toBe(58)
  })

  it('a substance fully worn off leaves no trace and sobriety returns to 100', async () => {
    const game = startGame()
    const loop = useGameLoop()
    game.applyDoses({ doses: [{ substanceId: 'weed', value: 20 }] })

    await loop.tick(10)

    expect(game.player.intoxications).toEqual({})
    expect(game.player.status.sobriety).toBe(100)
    expect(game.player.blend.dominantPersonaId).toBe(SOBER_PERSONA_ID)
  })

  it('forty whiskey, forty weed, twenty you', () => {
    const game = startGame()
    game.applyDoses({
      doses: [
        { substanceId: 'whiskey', value: 40 },
        { substanceId: 'weed', value: 40 },
      ],
    })
    expect(game.player.blend.soberWeight).toBe(0.2)
    expect(personaIds(game).sort()).toEqual(['priest', 'telepath'])
    expect(game.player.blend.dominantPersonaId).not.toBe(SOBER_PERSONA_ID)
  })

  it('a condition joins the blend when its status crosses the line', () => {
    const game = startGame()
    game.applyStatusChanges({ hunger: -45 }) // 50 → 5, starving below 15
    expect(personaIds(game)).toEqual(['hollow'])
    expect(game.player.blend.modifiers.creativity).toBe(3)

    game.applyStatusChanges({ hunger: 40 }) // fed
    expect(personaIds(game)).toEqual([])
  })

  it('habituation builds with doses and withdrawal arrives when the substance runs out', async () => {
    const game = startGame()
    const loop = useGameLoop()
    for (let n = 0; n < 3; n++) {
      game.applyDoses({ doses: [{ substanceId: 'nicotine', value: 25 }] })
    }
    expect(game.player.habituations.nicotine).toBe(37.5)
    expect(personaIds(game)).toEqual(['mr_cool'])

    await loop.tick(10) // 8/tick: gone

    expect(game.player.intoxications.nicotine).toBeUndefined()
    expect(game.player.blend.weights[0]).toMatchObject({
      personaId: 'train_wreck',
      source: PERSONA_SOURCES.WITHDRAWAL,
      sourceId: 'nicotine',
    })
    expect(game.player.blend.modifiers.charm).toBe(-5)
  })

  it('a hidden dose lands or not on the roll, and the outcome does not say which', () => {
    const laced = [
      { substanceId: 'weed', value: 30 },
      { substanceId: 'whiskey', value: 30, chance: 0.1 },
    ]
    const clean = startGame()
    clean.applyDoses({ doses: laced, rng: () => 0.95 })
    expect(Object.keys(clean.player.intoxications)).toEqual(['weed'])

    const unlucky = startGame()
    unlucky.applyDoses({ doses: laced, rng: () => 0.0 })
    expect(Object.keys(unlucky.player.intoxications).sort()).toEqual(['weed', 'whiskey'])
  })

  it('an outcome cannot write sobriety directly', () => {
    const game = startGame()
    game.applyStatusChanges({ sobriety: -50 })
    expect(game.player.status.sobriety).toBe(100)
  })

  it('a dose of nothing the city sells is refused with a code, and the player is untouched', () => {
    const game = startGame()
    const result = game.applyDoses({ doses: [{ substanceId: 'absinthe', value: 30 }] })
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('SUBSTANCE_UNKNOWN')
    expect(game.player.intoxications).toEqual({})
  })

  it('characters carry the same blend: Maurice arrives forty points into a beer and sobers up', async () => {
    const game = startGame()
    game.registerCharacter(characterCreate(maurice))
    game.blendRefresh()
    expect(game.characters.maurice.status.sobriety).toBe(60)
    expect(game.characters.maurice.blend.weights[0].personaId).toBe('one_of_the_guys')

    const loop = useGameLoop()
    await loop.tick(20)

    expect(game.characters.maurice.intoxications).toEqual({})
    expect(game.characters.maurice.status.sobriety).toBe(100)
  })
})
