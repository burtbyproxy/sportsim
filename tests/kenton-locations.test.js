// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, resolve } from 'path'
import { locationCreate, locationOpen } from '../src/models/location.js'
import { playerCreate } from '../src/models/player.js'
import { narrativeLocation } from '../src/composables/useNarrative.js'
import { tuningContent } from './helpers/content.js'

const tuning = tuningContent()

// Load Kenton locations from content/ (keyed by ID)
const locDir = resolve('content/maps/kenton/locations')
const kentonLocations = existsSync(locDir)
  ? Object.fromEntries(
      readdirSync(locDir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => {
          const data = JSON.parse(readFileSync(join(locDir, f), 'utf-8'))
          return [data.id, data]
        })
    )
  : {}

const EXPECTED_IDS = [
  'moms_house',
  'blue_parrot',
  'mocks_crest',
  'columbia_park',
  'mouse_trap',
  'arbys',
  'toads_express',
  'ainsworth_plaid',
  'denver_711',
  'greeley_711',
  'greeley_plaid',
  'glitters',
  'dancin_bare',
  'liquor',
  'lombard_dental',
  'chief_joseph',
  'abundant_life',
]

// ---------------------------------------------------------------------------
// Data integrity — all 17 locations present
// ---------------------------------------------------------------------------

describe('kentonLocations data integrity', () => {
  it('contains exactly 17 locations', () => {
    expect(Object.keys(kentonLocations)).toHaveLength(17)
  })

  it('contains all expected location IDs', () => {
    for (const id of EXPECTED_IDS) {
      expect(kentonLocations).toHaveProperty(id)
    }
  })

  it('every location has required fields', () => {
    for (const id of EXPECTED_IDS) {
      const loc = kentonLocations[id]
      expect(loc.id, `${id}: missing id`).toBeTruthy()
      expect(loc.type, `${id}: missing type`).toBeTruthy()
      expect(loc.display, `${id}: missing display`).toBeTruthy()
      expect(loc.descriptions, `${id}: missing descriptions`).toBeDefined()
      expect(loc.descriptions.default, `${id}: missing default description`).toBeTruthy()
      expect(Array.isArray(loc.exits), `${id}: exits must be array`).toBe(true)
      expect(loc.availability, `${id}: missing availability`).toBeDefined()
      expect(typeof loc.availability.openHour, `${id}: openHour must be number`).toBe('number')
      expect(typeof loc.availability.closeHour, `${id}: closeHour must be number`).toBe('number')
    }
  })

  it('every exit has required fields', () => {
    for (const id of EXPECTED_IDS) {
      const loc = kentonLocations[id]
      for (const exit of loc.exits) {
        expect(exit.locationId, `${id} exit: missing locationId`).toBeTruthy()
        expect(exit.label, `${id} exit: missing label`).toBeTruthy()
        expect(typeof exit.travelTime, `${id} exit: travelTime must be number`).toBe('number')
        expect(exit.travelTime, `${id} exit: travelTime must be >= 1`).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('exits reference valid location IDs within kenton (or are acknowledged cross-neighborhood)', () => {
    // All exits within Kenton should reference a real Kenton location ID.
    // This catches typos.
    for (const id of EXPECTED_IDS) {
      const loc = kentonLocations[id]
      for (const exit of loc.exits) {
        expect(EXPECTED_IDS, `${id} has exit to unknown location: ${exit.locationId}`).toContain(
          exit.locationId
        )
      }
    }
  })

  it('availability hours are valid (0-23)', () => {
    for (const id of EXPECTED_IDS) {
      const loc = kentonLocations[id]
      expect(loc.availability.openHour).toBeGreaterThanOrEqual(0)
      expect(loc.availability.openHour).toBeLessThanOrEqual(23)
      expect(loc.availability.closeHour).toBeGreaterThanOrEqual(0)
      expect(loc.availability.closeHour).toBeLessThanOrEqual(23)
    }
  })

  it('moms_house is always open', () => {
    const loc = kentonLocations['moms_house']
    expect(loc.availability.openHour).toBe(0)
    expect(loc.availability.closeHour).toBe(23)
  })

  it('columbia_park is always open', () => {
    const loc = kentonLocations['columbia_park']
    expect(loc.availability.openHour).toBe(0)
    expect(loc.availability.closeHour).toBe(23)
  })

  it('bars are not open at 6am', () => {
    const bars = ['blue_parrot', 'mocks_crest', 'mouse_trap', 'dancin_bare']
    for (const id of bars) {
      const loc = locationCreate(kentonLocations[id])
      expect(locationOpen({ location: loc, hour: 6 }), `${id} should be closed at 6am`).toBe(false)
    }
  })

  it('chief_joseph is accessible (open 24h)', () => {
    // School grounds are accessible; building is closed but the zone is walkable
    const loc = kentonLocations['chief_joseph']
    // availability should be 0-23 (always accessible as a zone)
    expect(loc.availability.openHour).toBe(0)
    expect(loc.availability.closeHour).toBe(23)
  })

  it('all locations serialize cleanly through locationCreate', () => {
    for (const id of EXPECTED_IDS) {
      const loc = locationCreate(kentonLocations[id])
      const serialized = JSON.parse(JSON.stringify(loc))
      expect(serialized.id).toBe(id)
    }
  })

  it('every location narrates its own default description to a fresh arrival', () => {
    const player = playerCreate({ name: 'Test' })
    const morning = { period: 'morning', hour: 9 }
    for (const id of EXPECTED_IDS) {
      const loc = locationCreate(kentonLocations[id])
      const text = narrativeLocation({ tuning, location: loc, player, gameTime: morning })
        .tokens.map((t) => t.text)
        .join('')
      expect(text, `${id}: narrated description`).toContain(
        kentonLocations[id].descriptions.default.slice(0, 40)
      )
    }
  })
})
