import { describe, it, expect } from 'vitest'
import {
  locationCreate,
  locationOpen,
  exitRequirementsMeet,
  locationVisitAdd,
} from '../src/models/location.js'

// ---------------------------------------------------------------------------
// locationCreate
// ---------------------------------------------------------------------------

describe('locationCreate', () => {
  const raw = {
    id: 'blue_parrot',
    type: 'bar',
    display: 'The Blue Parrot',
    displayInline: 'the Blue Parrot',
    appearance: {
      display: 'A bar with a neon bird',
      displayInline: 'a bar with a neon bird in the window',
      descriptions: { default: 'A low bar.' },
    },
    descriptions: { default: 'A dive bar.' },
    exits: [{ locationId: 'moms_house', label: 'Home', travelTime: 1, requirements: null }],
    availability: { openHour: 11, closeHour: 2, closedMessage: 'Closed.' },
    visitCount: 3,
  }

  it('maps all fields correctly', () => {
    const loc = locationCreate(raw)
    expect(loc.id).toBe('blue_parrot')
    expect(loc.type).toBe('bar')
    expect(loc.display).toBe('The Blue Parrot')
    expect(loc.descriptions.default).toBe('A dive bar.')
    expect(loc.exits).toHaveLength(1)
    expect(loc.displayInline).toBe('the Blue Parrot')
    expect(loc.appearance).toEqual(raw.appearance)
    expect(loc.availability.openHour).toBe(11)
    expect(loc.visitCount).toBe(3)
  })

  it('applies defaults for missing optional fields', () => {
    const loc = locationCreate({ id: 'x', type: 'park', display: 'X' })
    expect(loc.descriptions).toEqual({ default: '' })
    expect(loc.exits).toEqual([])
    expect(loc.displayInline).toBe('X')
    expect(loc.appearance).toBeNull()
    expect(loc.availability.openHour).toBe(0)
    expect(loc.availability.closeHour).toBe(23)
    expect(loc.visitCount).toBe(0)
  })

  it('does not share references with source data', () => {
    const loc = locationCreate(raw)
    loc.exits[0].label = 'MODIFIED'
    loc.appearance.descriptions.default = 'MODIFIED'
    expect(raw.exits[0].label).toBe('Home')
    expect(raw.appearance.descriptions.default).toBe('A low bar.')
  })

  it('serializes cleanly to JSON', () => {
    const loc = locationCreate(raw)
    const serialized = JSON.parse(JSON.stringify(loc))
    expect(serialized.id).toBe('blue_parrot')
  })
})

// ---------------------------------------------------------------------------
// locationOpen
// ---------------------------------------------------------------------------

describe('locationOpen', () => {
  it('always open when openHour=0 and closeHour=23', () => {
    const loc = locationCreate({
      id: 'x',
      type: 'park',
      display: 'X',
      availability: { openHour: 0, closeHour: 23, closedMessage: null },
    })
    for (let h = 0; h <= 23; h++) {
      expect(locationOpen({ location: loc, hour: h })).toBe(true)
    }
  })

  it('correct for normal daytime window', () => {
    const loc = locationCreate({
      id: 'x',
      type: 'bar',
      display: 'X',
      availability: { openHour: 11, closeHour: 22, closedMessage: null },
    })
    expect(locationOpen({ location: loc, hour: 10 })).toBe(false)
    expect(locationOpen({ location: loc, hour: 11 })).toBe(true)
    expect(locationOpen({ location: loc, hour: 15 })).toBe(true)
    expect(locationOpen({ location: loc, hour: 22 })).toBe(true)
    expect(locationOpen({ location: loc, hour: 23 })).toBe(false)
  })

  it('correct for overnight window (bar: 11pm to 2am)', () => {
    const loc = locationCreate({
      id: 'x',
      type: 'bar',
      display: 'X',
      availability: { openHour: 23, closeHour: 2, closedMessage: null },
    })
    expect(locationOpen({ location: loc, hour: 23 })).toBe(true)
    expect(locationOpen({ location: loc, hour: 0 })).toBe(true)
    expect(locationOpen({ location: loc, hour: 1 })).toBe(true)
    expect(locationOpen({ location: loc, hour: 2 })).toBe(true)
    expect(locationOpen({ location: loc, hour: 3 })).toBe(false)
    expect(locationOpen({ location: loc, hour: 22 })).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// locationVisitAdd
// ---------------------------------------------------------------------------

describe('locationVisitAdd', () => {
  it('increments from 0 to 1', () => {
    const loc = locationCreate({ id: 'x', type: 'park', display: 'X' })
    locationVisitAdd({ location: loc })
    expect(loc.visitCount).toBe(1)
  })

  it('increments repeatedly', () => {
    const loc = locationCreate({ id: 'x', type: 'park', display: 'X' })
    locationVisitAdd({ location: loc })
    locationVisitAdd({ location: loc })
    locationVisitAdd({ location: loc })
    expect(loc.visitCount).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// exitRequirementsMeet
// ---------------------------------------------------------------------------

describe('exitRequirementsMeet', () => {
  const gameTime = { hour: 14 }
  const player = {
    stats: { charisma: { base: 3 } },
    status: { sobriety: 80 },
    inventory: [{ id: 'bus_pass', quantity: 1 }],
    psyche: { marks: [], abilities: [], grooves: {} },
  }

  it('an exit with no requirements is always open', () => {
    const exit = { locationId: 'park', requirements: null }
    expect(exitRequirementsMeet({ exit, player, gameTime })).toEqual({
      meets: true,
      reasonCode: null,
      reasonParams: {},
    })
  })

  it('an item requirement the player satisfies passes', () => {
    const exit = { locationId: 'downtown', requirements: { requiredItems: ['bus_pass'] } }
    expect(exitRequirementsMeet({ exit, player, gameTime }).meets).toBe(true)
  })

  it('an item requirement the player lacks fails with a reason', () => {
    const exit = { locationId: 'downtown', requirements: { requiredItems: ['car_keys'] } }
    const result = exitRequirementsMeet({ exit, player, gameTime })
    expect(result.meets).toBe(false)
    expect(result.reasonCode).toBe('requirement.item')
    expect(result.reasonParams).toEqual({ itemId: 'car_keys' })
  })

  it('a stat requirement is judged against the base stat', () => {
    const tooHigh = { locationId: 'gallery', requirements: { minStats: { charisma: 5 } } }
    const justRight = { locationId: 'gallery', requirements: { minStats: { charisma: 3 } } }
    expect(exitRequirementsMeet({ exit: tooHigh, player, gameTime }).meets).toBe(false)
    expect(exitRequirementsMeet({ exit: justRight, player, gameTime }).meets).toBe(true)
  })

  it('a time-of-day window is honoured', () => {
    const nightOnly = { locationId: 'club', requirements: { minHour: 21 } }
    expect(exitRequirementsMeet({ exit: nightOnly, player, gameTime }).meets).toBe(false)
    expect(exitRequirementsMeet({ exit: nightOnly, player, gameTime: { hour: 22 } }).meets).toBe(
      true
    )
  })

  it('a visits requirement counts visits to the place the exit leads out of', () => {
    const exit = { locationId: 'back_room', requirements: { minVisits: 3 } }
    const here = (visitCount) => ({ id: 'bar', visitCount })
    expect(exitRequirementsMeet({ exit, player, gameTime, location: here(2) })).toEqual({
      meets: false,
      reasonCode: 'requirement.visits',
      reasonParams: {},
    })
    expect(exitRequirementsMeet({ exit, player, gameTime, location: here(3) }).meets).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// scavenge fields
// ---------------------------------------------------------------------------

describe('locationCreate — scavenge', () => {
  const base = { id: 'lot', type: 'fuel', display: 'The Lot' }

  it('carries the table the place draws from', () => {
    expect(locationCreate({ ...base, scavengeTableId: 'lot' }).scavengeTableId).toBe('lot')
  })

  it('a place with no table has nothing to find', () => {
    expect(locationCreate(base).scavengeTableId).toBeNull()
  })

  it('starts unworked, and copies saved wear', () => {
    expect(locationCreate(base).scavenge).toEqual({ depletion: 0, updatedAtTick: 0 })
    const saved = { depletion: 3, updatedAtTick: 40 }
    const location = locationCreate({ ...base, scavenge: saved })
    expect(location.scavenge).toEqual(saved)
    expect(location.scavenge).not.toBe(saved)
  })
})
