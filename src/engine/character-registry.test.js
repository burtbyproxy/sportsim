import { describe, it, expect } from 'vitest'
import {
  buildCharacterRegistry,
  getCharactersAtLocation,
  getCharactersByTier,
  updateCharacterLocation,
} from './character-registry.js'

function makeCharacter(id, simulation = 'fixed', locationId = null) {
  return {
    id,
    simulation,
    currentLocationId: locationId,
    schedule: { entries: [] },
  }
}

describe('buildCharacterRegistry', () => {
  it('indexes characters by id', () => {
    const chars = [makeCharacter('carl'), makeCharacter('bartender')]
    const registry = buildCharacterRegistry(chars)
    expect(registry.byId['carl']).toBeDefined()
    expect(registry.byId['bartender']).toBeDefined()
  })

  it('groups characters by simulation tier', () => {
    const chars = [
      makeCharacter('a', 'fixed'),
      makeCharacter('b', 'fixed'),
      makeCharacter('c', 'routine'),
      makeCharacter('d', 'full'),
    ]
    const registry = buildCharacterRegistry(chars)
    expect(registry.byTier.fixed).toHaveLength(2)
    expect(registry.byTier.routine).toHaveLength(1)
    expect(registry.byTier.full).toHaveLength(1)
  })

  it('unknown tier falls into fixed', () => {
    const chars = [{ id: 'mystery', simulation: 'unknown', currentLocationId: null, schedule: { entries: [] } }]
    const registry = buildCharacterRegistry(chars)
    expect(registry.byTier.fixed).toHaveLength(1)
  })

  it('indexes characters by location', () => {
    const chars = [
      makeCharacter('a', 'fixed', 'blue_parrot'),
      makeCharacter('b', 'fixed', 'blue_parrot'),
      makeCharacter('c', 'fixed', 'mocks_crest'),
    ]
    const registry = buildCharacterRegistry(chars)
    expect(registry.byLocation['blue_parrot']).toHaveLength(2)
    expect(registry.byLocation['mocks_crest']).toHaveLength(1)
  })

  it('does not index characters with null location', () => {
    const chars = [makeCharacter('a', 'fixed', null)]
    const registry = buildCharacterRegistry(chars)
    expect(Object.keys(registry.byLocation)).toHaveLength(0)
  })

  it('handles empty input', () => {
    const registry = buildCharacterRegistry([])
    expect(Object.keys(registry.byId)).toHaveLength(0)
    expect(registry.byTier.fixed).toHaveLength(0)
  })
})

describe('getCharactersAtLocation', () => {
  it('returns characters at the given location', () => {
    const chars = [makeCharacter('a', 'fixed', 'bar'), makeCharacter('b', 'fixed', 'bar')]
    const registry = buildCharacterRegistry(chars)
    expect(getCharactersAtLocation(registry, 'bar')).toHaveLength(2)
  })

  it('returns empty array for location with no characters', () => {
    const registry = buildCharacterRegistry([])
    expect(getCharactersAtLocation(registry, 'nowhere')).toEqual([])
  })
})

describe('getCharactersByTier', () => {
  it('returns all characters of a given tier', () => {
    const chars = [makeCharacter('a', 'routine'), makeCharacter('b', 'fixed')]
    const registry = buildCharacterRegistry(chars)
    expect(getCharactersByTier(registry, 'routine')).toHaveLength(1)
    expect(getCharactersByTier(registry, 'fixed')).toHaveLength(1)
  })

  it('returns empty array for tier with no characters', () => {
    const registry = buildCharacterRegistry([])
    expect(getCharactersByTier(registry, 'full')).toEqual([])
  })

  it('returns empty array for unknown tier', () => {
    const registry = buildCharacterRegistry([])
    expect(getCharactersByTier(registry, 'nonexistent')).toEqual([])
  })
})

describe('updateCharacterLocation', () => {
  it('moves character to new location', () => {
    const chars = [makeCharacter('carl', 'fixed', 'bar')]
    const registry = buildCharacterRegistry(chars)
    const updated = updateCharacterLocation(registry, 'carl', 'home')
    expect(updated.byId['carl'].currentLocationId).toBe('home')
    expect(getCharactersAtLocation(updated, 'home')).toHaveLength(1)
    expect(getCharactersAtLocation(updated, 'bar')).toHaveLength(0)
  })

  it('moves character to null (off-map)', () => {
    const chars = [makeCharacter('carl', 'fixed', 'bar')]
    const registry = buildCharacterRegistry(chars)
    const updated = updateCharacterLocation(registry, 'carl', null)
    expect(updated.byId['carl'].currentLocationId).toBeNull()
    expect(getCharactersAtLocation(updated, 'bar')).toHaveLength(0)
  })

  it('does not mutate original registry', () => {
    const chars = [makeCharacter('carl', 'fixed', 'bar')]
    const registry = buildCharacterRegistry(chars)
    updateCharacterLocation(registry, 'carl', 'home')
    expect(registry.byId['carl'].currentLocationId).toBe('bar')
  })

  it('returns registry unchanged for unknown character', () => {
    const registry = buildCharacterRegistry([])
    const result = updateCharacterLocation(registry, 'ghost', 'bar')
    expect(result).toBe(registry)
  })
})
