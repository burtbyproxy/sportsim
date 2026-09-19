import { describe, it, expect } from 'vitest'
import {
  DISTORTION_KINDS,
  PERCEPTION_ERROR_CODES,
  actionMisperceived,
  confusionBand,
  confusionDerive,
  dazedDecay,
  locationKnown,
  locationLearn,
  perceptionRoll,
  perceptionView,
} from './perception.js'
import { tuningContent } from '../../tests/helpers/content.js'
import { rngSequence } from '../../tests/helpers/rng.js'

const tuning = tuningContent()

const locations = {
  bar: { id: 'bar', exits: [{ locationId: 'dentist' }, { locationId: 'home' }] },
  dentist: { id: 'dentist', exits: [{ locationId: 'bar' }, { locationId: 'church' }] },
  home: { id: 'home', exits: [{ locationId: 'bar' }] },
  church: { id: 'church', exits: [{ locationId: 'dentist' }] },
}

describe('locationKnown', () => {
  it('knows what the player knows, and nothing else', () => {
    const player = { knownLocationIds: ['home'] }
    expect(locationKnown({ player, locationId: 'home' })).toBe(true)
    expect(locationKnown({ player, locationId: 'bar' })).toBe(false)
  })
})

describe('locationLearn', () => {
  it('adds the place, and says it was news', () => {
    const player = { knownLocationIds: ['home'] }
    const result = locationLearn({ player, locations, locationId: 'bar' })
    expect(result.data).toEqual({ knownLocationIds: ['home', 'bar'], learned: true })
    expect(player.knownLocationIds).toEqual(['home'])
  })

  it('knowing a place twice changes nothing', () => {
    const result = locationLearn({
      player: { knownLocationIds: ['home'] },
      locations,
      locationId: 'home',
    })
    expect(result.data).toEqual({ knownLocationIds: ['home'], learned: false })
  })

  it('refuses a place that does not exist', () => {
    const result = locationLearn({
      player: { knownLocationIds: [] },
      locations,
      locationId: 'moon',
    })
    expect(result.error.code).toBe(PERCEPTION_ERROR_CODES.locationUnknown)
    expect(result.error.params).toEqual({ locationId: 'moon' })
  })

  it('refuses without a player', () => {
    const result = locationLearn({ player: null, locations, locationId: 'bar' })
    expect(result.error.code).toBe(PERCEPTION_ERROR_CODES.playerMissing)
  })
})

describe('perceptionView', () => {
  const view = ({ known = [], at = 'bar', characters = [], distortions = [] } = {}) =>
    perceptionView({
      player: { knownLocationIds: known },
      location: locations[at],
      locations,
      characters,
      distortions,
    })

  it('an unknown place is perceived as itself, unknown, and so is its menu', () => {
    const { data } = view()
    expect(data.place).toEqual({ locationId: 'bar', known: false })
    expect(data.menu).toEqual({ locationId: 'bar', known: false })
  })

  it('a known place is known', () => {
    expect(view({ known: ['bar'] }).data.place.known).toBe(true)
  })

  it('each way out says whether the player knows where it leads', () => {
    expect(view({ known: ['home'] }).data.exits).toEqual([
      { locationId: 'dentist', perceivedLocationId: 'dentist', known: false },
      { locationId: 'home', perceivedLocationId: 'home', known: true },
    ])
  })

  it('the people here are taken for who they are', () => {
    expect(view({ characters: [{ id: 'dale' }] }).data.people).toEqual([
      { characterId: 'dale', realId: 'dale' },
    ])
  })

  it('a place taken for another is named, known or not, and does business, as the other', () => {
    const { data } = view({
      known: ['dentist'],
      distortions: [{ kind: DISTORTION_KINDS.place, realId: 'bar', perceivedId: 'dentist' }],
    })
    expect(data.place).toEqual({ locationId: 'dentist', known: true })
    expect(data.menu).toEqual({ locationId: 'dentist', known: true })
  })

  it('a menu taken for another is only the menu: the place is still itself', () => {
    const { data } = view({
      distortions: [{ kind: DISTORTION_KINDS.menu, realId: 'bar', perceivedId: 'home' }],
    })
    expect(data.place).toEqual({ locationId: 'bar', known: false })
    expect(data.menu).toEqual({ locationId: 'home', known: false })
  })

  it('a face taken for another is the other, and remembers who it really is', () => {
    const { data } = view({
      characters: [{ id: 'dale' }, { id: 'tina' }],
      distortions: [{ kind: DISTORTION_KINDS.person, realId: 'dale', perceivedId: 'dennis' }],
    })
    expect(data.people).toEqual([
      { characterId: 'dennis', realId: 'dale' },
      { characterId: 'tina', realId: 'tina' },
    ])
  })

  it('a way out taken to lead elsewhere is named for elsewhere, and still goes where it goes', () => {
    const { data } = view({
      known: ['church'],
      distortions: [{ kind: DISTORTION_KINDS.exit, realId: 'dentist', perceivedId: 'church' }],
    })
    expect(data.exits[0]).toEqual({
      locationId: 'dentist',
      perceivedLocationId: 'church',
      known: true,
    })
  })

  it('a distortion about somebody who has left is moot', () => {
    const { data } = view({
      distortions: [{ kind: DISTORTION_KINDS.person, realId: 'dale', perceivedId: 'dennis' }],
    })
    expect(data.people).toEqual([])
  })

  it('refuses a place that is not in the world', () => {
    const result = perceptionView({
      player: { knownLocationIds: [] },
      location: { id: 'moon' },
      locations,
      characters: [],
      distortions: [],
    })

    expect(result.error.code).toBe(PERCEPTION_ERROR_CODES.locationUnknown)
  })

  it('refuses without a player', () => {
    const result = perceptionView({
      player: null,
      location: locations.bar,
      locations,
      characters: [],
      distortions: [],
    })
    expect(result.error.code).toBe(PERCEPTION_ERROR_CODES.playerMissing)
  })
})

describe('confusionDerive', () => {
  it('is the blend plus the knock to the head, 0 to 100', () => {
    expect(confusionDerive({ blend: { confusion: 30 }, dazed: 15 })).toBe(45)
    expect(confusionDerive({ blend: { confusion: 80 }, dazed: 40 })).toBe(100)
  })
})

describe('confusionBand', () => {
  const floors = tuning.perception.bands.map((b) => b.atLeast)

  it('is 0 below the first band, and one more at each band reached', () => {
    expect(confusionBand({ tuning, confusion: floors[0] - 0.01 })).toBe(0)
    expect(confusionBand({ tuning, confusion: floors[0] })).toBe(1)
    expect(confusionBand({ tuning, confusion: 100 })).toBe(floors.length)
  })
})

describe('dazedDecay', () => {
  const rate = tuning.perception.dazedDecayPerTick

  it('wears off by the tuned rate, and never below nothing', () => {
    expect(dazedDecay({ tuning, dazed: 10, ticksElapsed: 2 }).data.dazed).toBe(10 - 2 * rate)
    expect(dazedDecay({ tuning, dazed: 1, ticksElapsed: 100 }).data.dazed).toBe(0)
  })

  it('refuses time running backwards', () => {
    const result = dazedDecay({ tuning, dazed: 10, ticksElapsed: -1 })
    expect(result.error.code).toBe(PERCEPTION_ERROR_CODES.ticksInvalid)
  })
})

describe('perceptionRoll', () => {
  const roster = { dale: { id: 'dale' }, dennis: { id: 'dennis' }, tina: { id: 'tina' } }
  const roll = ({ confusion, values, characters = [] }) =>
    perceptionRoll({
      tuning,
      confusion,
      location: locations.bar,
      locations,
      characters,
      roster,
      rng: rngSequence({ values }),
    })
  const below = tuning.perception.bands[0].atLeast - 1

  it('below the first band nothing is wrong, and nothing is rolled', () => {
    let calls = 0
    const result = perceptionRoll({
      tuning,
      confusion: below,
      location: locations.bar,
      locations,
      characters: [{ id: 'dale' }],
      roster,
      rng: () => {
        calls++
        return 0
      },
    })
    expect(result.data.distortions).toEqual([])
    expect(calls).toBe(0)
  })

  it('the place becomes a neighbour, a face somebody not here, a way out somewhere past it', () => {
    // Every chance lands (0), and every pick is the first candidate (0).
    const result = roll({ confusion: 100, values: [0], characters: [{ id: 'dale' }] })
    expect(result.data.distortions).toEqual([
      { kind: DISTORTION_KINDS.place, realId: 'bar', perceivedId: 'dentist' },
      { kind: DISTORTION_KINDS.person, realId: 'dale', perceivedId: 'dennis' },
      { kind: DISTORTION_KINDS.exit, realId: 'dentist', perceivedId: 'church' },
    ])
  })

  it('when the place holds, the menu can still go', () => {
    // The place misses (0.99), the menu lands (0) on the last neighbour (0.99), nothing else lands.
    const result = roll({ confusion: 100, values: [0.99, 0, 0.99, 0.99, 0.99] })
    expect(result.data.distortions).toEqual([
      { kind: DISTORTION_KINDS.menu, realId: 'bar', perceivedId: 'home' },
    ])
  })

  it('a way out with nowhere past it stays true', () => {
    // Place and menu miss; the way to the dentist misses; the way home lands, and home goes nowhere past.
    const result = roll({ confusion: 100, values: [0.99, 0.99, 0.99, 0] })
    expect(result.data.distortions).toEqual([])
  })

  it('the odds climb with confusion', () => {
    // One roll that lands at full confusion and misses just past the first band.
    const odds = (confusion) =>
      Math.min(1, confusion * tuning.perception.chancePerPoint[DISTORTION_KINDS.place])
    const roll01 = (odds(100) + odds(below + 1)) / 2
    expect(odds(100)).toBeGreaterThan(roll01)
    expect(odds(below + 1)).toBeLessThan(roll01)
    const high = roll({ confusion: 100, values: [roll01, 0] })
    const low = roll({ confusion: below + 1, values: [roll01, 0] })
    expect(high.data.distortions.some((d) => d.kind === DISTORTION_KINDS.place)).toBe(true)
    expect(low.data.distortions.some((d) => d.kind === DISTORTION_KINDS.place)).toBe(false)
  })

  it('refuses a place that is not in the world', () => {
    const result = perceptionRoll({
      tuning,
      confusion: 100,
      location: { id: 'moon' },
      locations,
      characters: [],
      roster,
      rng: () => 0,
    })
    expect(result.error.code).toBe(PERCEPTION_ERROR_CODES.locationUnknown)
  })
})

describe('actionMisperceived', () => {
  const here = { location: locations.bar, characters: [{ id: 'dale' }] }

  it('what belongs here, or anywhere, or to somebody here, is real', () => {
    expect(actionMisperceived({ ...here, action: { locationId: 'bar' } })).toBe(false)
    expect(actionMisperceived({ ...here, action: { locationId: 'any' } })).toBe(false)
    expect(
      actionMisperceived({ ...here, action: { locationId: 'bar', characterId: 'dale' } })
    ).toBe(false)
  })

  it("somewhere else's business, or somebody who isn't here, is not", () => {
    expect(actionMisperceived({ ...here, action: { locationId: 'dentist' } })).toBe(true)
    expect(
      actionMisperceived({ ...here, action: { locationId: 'any', characterId: 'dennis' } })
    ).toBe(true)
  })
})
