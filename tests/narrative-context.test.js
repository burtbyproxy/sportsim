/**
 * The narrative context decides which variant of a place the player reads.
 * Driven through the real generator with real content.
 *
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { generateLocationNarrative } from '../src/composables/useNarrative.js'
import { createLocation } from '../src/models/location.js'
import { createPlayer } from '../src/models/player.js'
import { blendSober } from '../src/engine/blend.js'

const momsHouse = JSON.parse(
  readFileSync(resolve('content/maps/kenton/locations/moms_house.json'), 'utf-8')
)
const morning = { period: 'morning', hour: 9 }
const read = (location, player, time = morning) =>
  generateLocationNarrative(location, player, time)
    .tokens.map((t) => t.text)
    .join('')

function fresh() {
  const player = createPlayer('Tester')
  player.status = { ...player.status, hunger: 50, energy: 70, mood: 40 }
  return player
}

describe('location narrative — which variant the player reads', () => {
  it('a sober first arrival reads the default', () => {
    expect(read(createLocation(momsHouse), fresh())).toBe(momsHouse.descriptions.default)
  })

  it('drunk begins below sobriety 30, not at it', () => {
    const player = fresh()
    player.status.sobriety = 30
    expect(read(createLocation(momsHouse), player)).toBe(momsHouse.descriptions.default)
    player.status.sobriety = 29
    expect(read(createLocation(momsHouse), player)).toBe(momsHouse.descriptions.drunk)
  })

  it('exhausted begins below energy 20', () => {
    const player = fresh()
    player.status.energy = 20
    expect(read(createLocation(momsHouse), player)).toBe(momsHouse.descriptions.default)
    player.status.energy = 19
    expect(read(createLocation(momsHouse), player)).toBe(momsHouse.descriptions.exhausted)
  })

  it('starving begins below hunger 15', () => {
    const player = fresh()
    player.status.hunger = 14
    expect(read(createLocation(momsHouse), player)).toBe(momsHouse.descriptions.starving)
  })

  it('night reads the night variant, a return visit reads the repeat', () => {
    expect(read(createLocation(momsHouse), fresh(), { period: 'night', hour: 23 })).toBe(
      momsHouse.descriptions.night
    )
    const visited = createLocation({ ...momsHouse, visitCount: 2 })
    expect(read(visited, fresh(), { period: 'afternoon', hour: 13 })).toBe(
      momsHouse.descriptions.repeat
    )
  })

  it('a persona in the blend is a variant key content can write to', () => {
    const player = fresh()
    player.blend = {
      ...blendSober(),
      weights: [{ personaId: 'telepath', weight: 0.6, source: 'substance', sourceId: 'weed' }],
      soberWeight: 0.4,
      dominantPersonaId: 'telepath',
    }
    const stonedBasement = createLocation({
      ...momsHouse,
      descriptions: { ...momsHouse.descriptions, telepath: 'Dave is thinking about you.' },
    })
    expect(read(stonedBasement, player)).toBe('Dave is thinking about you.')
    expect(read(stonedBasement, fresh())).toBe(momsHouse.descriptions.default)
  })
})
