/**
 * Integration: a character's day. The schedule stands in for the menu:
 * the day wears on them at the player's rates, the bar puts beer in them
 * and somebody else takes charge, home feeds and rests them, and by the
 * next morning they are fit to do it again. Driven through the real loop,
 * store, simulation and content.
 *
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useGameStore } from '../../src/stores/game.js'
import { playerCreate } from '../../src/models/player.js'
import { locationCreate } from '../../src/models/location.js'
import { characterCreate } from '../../src/models/character.js'
import { useGameLoop } from '../../src/composables/useGameLoop.js'
import { simulationTick } from '../../src/engine/simulation.js'
import { SOBER_PERSONA_ID } from '../../src/engine/blend.js'
import { contentDir, tuningContent } from '../helpers/content.js'

const tuning = tuningContent()
const locations = contentDir({ dir: 'content/maps/kenton/locations' })
const characters = contentDir({ dir: 'content/characters' })
const substances = contentDir({ dir: 'content/substances' })
const conditions = contentDir({ dir: 'content/conditions' })
const marks = contentDir({ dir: 'content/marks' })
const characterOf = (id) => characters.find((c) => c.id === id)
const ticksPerDay = 24 * tuning.clock.ticksPerHour

// Everyone turns up wherever their schedule says; no chance keeps anyone away.
const ALWAYS_THERE = 0
// The simulation on the loop's contract, with dice that always say present.
const everyoneThere = {
  tick: ({ tuning: numbers, gameTime, ticksElapsed, characters: people }) => ({
    characters: simulationTick({
      tuning: numbers,
      gameTime,
      ticksElapsed,
      characters: people,
      rng: () => ALWAYS_THERE,
    }),
  }),
}

function startGame({ at = 'moms_house', ids }) {
  setActivePinia(createPinia())
  const game = useGameStore()
  game.tuningRegister({ tuning })
  for (const location of locations) game.locationRegister({ location: locationCreate(location) })
  for (const substance of substances) game.substanceRegister({ substance })
  for (const condition of conditions) game.conditionRegister({ condition })
  for (const mark of marks) game.markRegister({ mark })
  game.runStart({ player: playerCreate({ name: 'Tester' }), locationId: at })
  for (const id of ids) {
    game.characterRegister({ character: characterCreate(characterOf(id)) })
  }
  const loop = useGameLoop({ rng: () => ALWAYS_THERE, simulation: everyoneThere })
  return { game, loop }
}

/** Tick the clock forward to a given hour today (the game starts at tuning.clock.startHour). */
async function until({ game, loop, hour }) {
  while (game.time.hour !== hour) await loop.tick({ ticks: 1 })
}

describe("Dennis's evening", () => {
  it('at the bar the beer goes in, and one of the guys takes charge', async () => {
    const { game, loop } = startGame({ ids: ['dennis'] })
    const dennis = game.characters.dennis
    const beer = substances.find((s) => s.id === 'beer')
    await until({ game, loop, hour: 17 })
    expect(dennis.currentLocationId).toBe('mocks_crest')
    expect(dennis.blend.dominantPersonaId).toBe(SOBER_PERSONA_ID)

    await loop.tick({ ticks: 4 * tuning.clock.ticksPerHour })

    expect(dennis.intoxications.beer).toBeGreaterThan(0)
    expect(dennis.status.sobriety).toBeLessThan(100)
    expect(dennis.blend.dominantPersonaId).toBe(beer.persona.id)
  })

  it('overnight at home he sobers up, sleeps it off and eats, and is himself by morning', async () => {
    const { game, loop } = startGame({ ids: ['dennis'] })
    const dennis = game.characters.dennis
    await until({ game, loop, hour: 22 })
    const drunk = { ...dennis.status }
    expect(dennis.currentLocationId).toBeNull()

    await until({ game, loop, hour: 8 })

    expect(dennis.status.sobriety).toBe(100)
    expect(dennis.status.energy).toBeGreaterThan(drunk.energy)
    expect(dennis.status.hunger).toBeGreaterThan(drunk.hunger)
    expect(dennis.blend.dominantPersonaId).toBe(SOBER_PERSONA_ID)
  })
})

describe('a day in the life, for everyone with a life', () => {
  const living = characters.filter((c) => c.simulation !== 'fixed')
  const needLine = Object.fromEntries(tuning.simulation.needs.map((n) => [n.status, n.below]))

  it('there are people who live', () => {
    expect(living.length).toBeGreaterThan(0)
  })

  for (const { id } of living) {
    it(`${id} gets through a week without starving or dropping: every morning is above every need`, async () => {
      const { game, loop } = startGame({ ids: [id] })
      const person = game.characters[id]
      for (let day = 0; day < 7; day++) {
        await loop.tick({ ticks: ticksPerDay })
        for (const [status, below] of Object.entries(needLine)) {
          expect(person.status[status], `${id} day ${day + 1} ${status}`).toBeGreaterThanOrEqual(
            below
          )
        }
      }
    })
  }
})
