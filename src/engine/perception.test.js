import { describe, it, expect } from 'vitest'
import {
  PERCEPTION_ERROR_CODES,
  locationKnown,
  locationLearn,
  perceptionView,
} from './perception.js'

const locations = {
  bar: { id: 'bar', exits: [{ locationId: 'dentist' }, { locationId: 'home' }] },
  dentist: { id: 'dentist', exits: [{ locationId: 'bar' }] },
  home: { id: 'home', exits: [{ locationId: 'bar' }] },
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
  const view = ({ known = [], at = 'bar', characters = [] } = {}) =>
    perceptionView({
      player: { knownLocationIds: known },
      location: locations[at],
      locations,
      characters,
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

  it('refuses a place that is not in the world', () => {
    const result = perceptionView({
      player: { knownLocationIds: [] },
      location: { id: 'moon' },
      locations,
      characters: [],
    })
    expect(result.error.code).toBe(PERCEPTION_ERROR_CODES.locationUnknown)
  })

  it('refuses without a player', () => {
    const result = perceptionView({
      player: null,
      location: locations.bar,
      locations,
      characters: [],
    })
    expect(result.error.code).toBe(PERCEPTION_ERROR_CODES.playerMissing)
  })
})
