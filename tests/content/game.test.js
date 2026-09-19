// @vitest-environment node
// Content contract: content/game.json — what a new game is.
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { CONTENT_ROOT, VALID_STATUS_KEYS, loadJsonFiles } from '../helpers/contentContracts.js'

describe('content/game.json — what a new game is', () => {
  const config = JSON.parse(readFileSync(join(CONTENT_ROOT, 'game.json'), 'utf-8'))

  it("has the title screen's words", () => {
    for (const field of ['title', 'tagline']) {
      expect(typeof config[field], `game.json: ${field} must be string`).toBe('string')
      expect(config[field].length).toBeGreaterThan(0)
    }
    expect(Array.isArray(config.bootLines)).toBe(true)
    expect(
      config.bootLines.some((line) => line.includes('{version}')),
      'a boot line shows {version}'
    ).toBe(true)
    expect(typeof config.menu?.new).toBe('string')
    expect(typeof config.menu?.load).toBe('string')
    expect(typeof config.menu?.loadFailed).toBe('string')
  })

  it('names a map that exists and starts the player somewhere on it', () => {
    const mapDir = join(CONTENT_ROOT, 'maps', config.mapId)
    expect(existsSync(mapDir), `game.json: no map '${config.mapId}'`).toBe(true)
    const locationIds = loadJsonFiles(join(mapDir, 'locations')).map(({ data }) => data.id)
    expect(
      locationIds,
      `game.json: start.locationId '${config.start.locationId}' is not on the map`
    ).toContain(config.start.locationId)
  })

  it('says which places the player already knows, starting with where they wake up', () => {
    const mapDir = join(CONTENT_ROOT, 'maps', config.mapId)
    const locationIds = loadJsonFiles(join(mapDir, 'locations')).map(({ data }) => data.id)
    const known = config.start.knownLocationIds
    expect(Array.isArray(known), 'game.json: start.knownLocationIds must be an array').toBe(true)
    for (const locationId of known) {
      expect(locationIds, `game.json: known place '${locationId}' is not on the map`).toContain(
        locationId
      )
    }
    expect(known, 'game.json: the player knows the place they wake up in').toContain(
      config.start.locationId
    )
  })

  it('says who the player is and what they start with', () => {
    const { start } = config
    expect(typeof start.playerName).toBe('string')
    expect(typeof start.money).toBe('number')
    expect(start.statRoll.min).toBeGreaterThanOrEqual(1)
    expect(start.statRoll.max).toBeGreaterThanOrEqual(start.statRoll.min)
    expect(start.statRoll.max).toBeLessThanOrEqual(100)
    for (const key of VALID_STATUS_KEYS) {
      expect(typeof start.status[key], `game.json: start.status.${key} must be number`).toBe(
        'number'
      )
      expect(start.status[key]).toBeGreaterThanOrEqual(0)
      expect(start.status[key]).toBeLessThanOrEqual(100)
    }
  })
})
