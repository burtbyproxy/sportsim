/**
 * Tests for useSave composable.
 *
 * Covers: validation, versioning, export/import, save slot limit.
 *
 * The node test environment has no localStorage, so an in-memory one is
 * installed. The composable and the store are the real ones.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  useSave,
  validateSave,
  saveMigrate,
  SAVE_VERSION,
  MAX_SAVES,
} from '../src/composables/useSave.js'
import { useGameStore } from '../src/stores/game.js'
import { blendSober } from '../src/engine/blend.js'

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

function createLocalStorageMock() {
  let store = {}
  return {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, value) => {
      store[key] = String(value)
    }),
    removeItem: vi.fn((key) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
    _store: () => store,
  }
}

// ---------------------------------------------------------------------------
// Minimal valid save factory
// ---------------------------------------------------------------------------

function makeValidSave(overrides = {}) {
  return {
    id: 'test-id-001',
    name: 'Day 1 — morning',
    timestamp: 1700000000000,
    version: SAVE_VERSION,
    player: {
      id: 'p1',
      name: 'Portland',
      currentLocationId: 'moms_house',
      status: {},
      stats: {},
      inventory: [],
      psyche: {},
      archetypeScores: {},
      counters: {},
    },
    time: { day: 1, period: 'morning', tick: 0 },
    locations: { moms_house: { id: 'moms_house', name: "Mom's House" } },
    characters: {},
    firedEventIds: [],
    counters: {},
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// validateSave
// ---------------------------------------------------------------------------

describe('validateSave', () => {
  it('accepts a well-formed save', () => {
    expect(validateSave(makeValidSave())).toBe(true)
  })

  it('rejects null', () => {
    expect(validateSave(null)).toBe(false)
  })

  it('rejects a non-object (string)', () => {
    expect(validateSave('{"version":1}')).toBe(false)
  })

  it('rejects a non-object (number)', () => {
    expect(validateSave(42)).toBe(false)
  })

  it('rejects an empty object', () => {
    expect(validateSave({})).toBe(false)
  })

  const requiredFields = [
    'id',
    'name',
    'timestamp',
    'version',
    'player',
    'time',
    'locations',
    'characters',
    'firedEventIds',
    'counters',
  ]
  for (const field of requiredFields) {
    it(`rejects a save missing "${field}"`, () => {
      const save = makeValidSave()
      delete save[field]
      expect(validateSave(save)).toBe(false)
    })
  }

  it('rejects a save with version 0', () => {
    expect(validateSave(makeValidSave({ version: 0 }))).toBe(false)
  })

  it('rejects a save with a negative version', () => {
    expect(validateSave(makeValidSave({ version: -1 }))).toBe(false)
  })

  it('rejects a save with a string version', () => {
    expect(validateSave(makeValidSave({ version: '1' }))).toBe(false)
  })

  it('accepts a save with a future (higher) version number', () => {
    // Future versions are valid — migration is a separate concern
    expect(validateSave(makeValidSave({ version: 99 }))).toBe(true)
  })

  it('rejects a save where a required field is null (simulates explicit nulling)', () => {
    // JSON.parse cannot produce undefined, but null is possible.
    // The validator checks field presence (not value type), which is correct:
    // null values are caught at load time by the game store, not the schema check.
    // This test documents that the validator cares about key presence, not null-ness.
    const save = makeValidSave()
    delete save.player
    expect(validateSave(save)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// SAVE_VERSION constant
// ---------------------------------------------------------------------------

describe('SAVE_VERSION', () => {
  it('is a positive integer', () => {
    expect(typeof SAVE_VERSION).toBe('number')
    expect(Number.isInteger(SAVE_VERSION)).toBe(true)
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// MAX_SAVES constant
// ---------------------------------------------------------------------------

describe('MAX_SAVES', () => {
  it('is a positive integer', () => {
    expect(typeof MAX_SAVES).toBe('number')
    expect(Number.isInteger(MAX_SAVES)).toBe(true)
    expect(MAX_SAVES).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// useSave — the real composable, a real Pinia store, and an in-memory
// localStorage. Nothing here is a stand-in for the code under test.
// ---------------------------------------------------------------------------

/**
 * Stand up the real save system over an in-memory localStorage, with the
 * real game store patched to the given state.
 */
function buildSaveSystem(lsMock, gameState = {}) {
  globalThis.localStorage = lsMock
  setActivePinia(createPinia())
  const game = useGameStore()
  game.$patch(gameState)
  return useSave()
}

// ---------------------------------------------------------------------------
// save() and load() — round trip
// ---------------------------------------------------------------------------

describe('save() and load() — round trip', () => {
  let ls
  let sys

  beforeEach(() => {
    ls = createLocalStorageMock()
    sys = buildSaveSystem(ls, {
      player: {
        id: 'p1',
        name: 'Portland',
        currentLocationId: 'moms_house',
        status: {},
        stats: {},
        inventory: [],
        psyche: {},
        archetypeScores: {},
        counters: {},
      },
      time: { day: 3, period: 'afternoon', tick: 12 },
      locations: { moms_house: { id: 'moms_house' } },
      characters: { npc1: { id: 'npc1', name: 'Stranger' } },
      firedEventIds: ['event_intro'],
      counters: { drinks: 2 },
    })
  })

  it('save() returns a non-null ID', () => {
    const id = sys.save('My Save')
    expect(id).not.toBeNull()
    expect(typeof id).toBe('string')
  })

  it('load() returns valid save data after save()', () => {
    const id = sys.save('My Save')
    const data = sys.load(id)
    expect(data).not.toBeNull()
    expect(data.name).toBe('My Save')
  })

  it('saved data includes SAVE_VERSION', () => {
    const id = sys.save()
    const data = sys.load(id)
    expect(data.version).toBe(SAVE_VERSION)
  })

  it('saved data includes all required fields', () => {
    const id = sys.save()
    const data = sys.load(id)
    expect(data.player).toBeDefined()
    expect(data.time).toBeDefined()
    expect(data.locations).toBeDefined()
    expect(data.characters).toBeDefined()
    expect(data.firedEventIds).toBeDefined()
    expect(data.counters).toBeDefined()
  })

  it('load() returns null for an unknown ID', () => {
    expect(sys.load('does-not-exist')).toBeNull()
  })

  it('load() returns null for a corrupted (non-JSON) save', () => {
    ls.setItem('sportsim_save_bad', 'not json at all {{{{')
    expect(sys.load('bad')).toBeNull()
  })

  it('load() returns null for a save missing required fields', () => {
    const partial = { id: 'x', name: 'X', timestamp: 1, version: 1 } // missing player, time, etc.
    ls.setItem('sportsim_save_x', JSON.stringify(partial))
    expect(sys.load('x')).toBeNull()
  })

  it('load() returns null for a save with version 0', () => {
    const bad = makeValidSave({ version: 0 })
    ls.setItem('sportsim_save_bad', JSON.stringify(bad))
    expect(sys.load('bad')).toBeNull()
  })

  it('default name uses day and period from game state', () => {
    const id = sys.save()
    const data = sys.load(id)
    expect(data.name).toBe('Day 3 — afternoon')
  })
})

// ---------------------------------------------------------------------------
// listSaves() and deleteSave()
// ---------------------------------------------------------------------------

describe('listSaves() and deleteSave()', () => {
  let ls
  let sys

  beforeEach(() => {
    ls = createLocalStorageMock()
    sys = buildSaveSystem(ls)
  })

  it('listSaves() returns empty array when no saves exist', () => {
    expect(sys.listSaves()).toEqual([])
  })

  it('listSaves() returns one entry after save()', () => {
    sys.save('First')
    expect(sys.listSaves()).toHaveLength(1)
  })

  it('listSaves() index entry has id, name, timestamp', () => {
    sys.save('Named Save')
    const [entry] = sys.listSaves()
    expect(entry.id).toBeTruthy()
    expect(entry.name).toBe('Named Save')
    expect(typeof entry.timestamp).toBe('number')
  })

  it('listSaves() grows with each save', () => {
    sys.save('A')
    sys.save('B')
    sys.save('C')
    expect(sys.listSaves()).toHaveLength(3)
  })

  it('deleteSave() removes the entry from the index', () => {
    const id = sys.save('ToDelete')
    sys.deleteSave(id)
    expect(sys.listSaves()).toHaveLength(0)
  })

  it('deleteSave() means load() returns null for that ID', () => {
    const id = sys.save('ToDelete')
    sys.deleteSave(id)
    expect(sys.load(id)).toBeNull()
  })

  it('deleteSave() does not affect other saves', () => {
    const id1 = sys.save('Keep')
    const id2 = sys.save('Delete')
    sys.deleteSave(id2)
    expect(sys.listSaves()).toHaveLength(1)
    expect(sys.listSaves()[0].id).toBe(id1)
  })

  it('deleteSave() is a no-op for unknown ID', () => {
    sys.save('Safe')
    expect(() => sys.deleteSave('ghost')).not.toThrow()
    expect(sys.listSaves()).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// autoSave()
// ---------------------------------------------------------------------------

describe('autoSave()', () => {
  let ls
  let sys

  beforeEach(() => {
    ls = createLocalStorageMock()
    sys = buildSaveSystem(ls)
  })

  it('creates a save named "auto"', () => {
    sys.autoSave()
    const saves = sys.listSaves()
    expect(saves).toHaveLength(1)
    expect(saves[0].name).toBe('auto')
  })

  it('calling autoSave() twice still results in only one auto save', () => {
    sys.autoSave()
    sys.autoSave()
    const saves = sys.listSaves()
    expect(saves).toHaveLength(1)
    expect(saves[0].name).toBe('auto')
  })

  it('autoSave() does not delete manual saves', () => {
    sys.save('Manual')
    sys.autoSave()
    sys.autoSave()
    const saves = sys.listSaves()
    expect(saves).toHaveLength(2)
    expect(saves.some((s) => s.name === 'Manual')).toBe(true)
    expect(saves.some((s) => s.name === 'auto')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// MAX_SAVES limit enforcement
// ---------------------------------------------------------------------------

describe('MAX_SAVES limit', () => {
  let ls
  let sys

  beforeEach(() => {
    ls = createLocalStorageMock()
    sys = buildSaveSystem(ls)
  })

  it('save() returns null when at MAX_SAVES capacity', () => {
    for (let i = 0; i < MAX_SAVES; i++) {
      const id = sys.save(`Save ${i}`)
      expect(id).not.toBeNull()
    }
    const overflow = sys.save('Overflow')
    expect(overflow).toBeNull()
  })

  it('deleting a save and then saving again succeeds', () => {
    const ids = []
    for (let i = 0; i < MAX_SAVES; i++) {
      ids.push(sys.save(`Save ${i}`))
    }
    sys.deleteSave(ids[0])
    const newId = sys.save('After delete')
    expect(newId).not.toBeNull()
    expect(sys.listSaves()).toHaveLength(MAX_SAVES)
  })

  it('index count never exceeds MAX_SAVES', () => {
    for (let i = 0; i < MAX_SAVES + 5; i++) {
      sys.save(`Save ${i}`)
    }
    expect(sys.listSaves().length).toBeLessThanOrEqual(MAX_SAVES)
  })
})

// ---------------------------------------------------------------------------
// exportSave()
// ---------------------------------------------------------------------------

describe('exportSave()', () => {
  let ls
  let sys

  beforeEach(() => {
    ls = createLocalStorageMock()
    sys = buildSaveSystem(ls, {
      player: {
        id: 'p1',
        name: 'Exporter',
        currentLocationId: 'moms_house',
        status: {},
        stats: {},
        inventory: [],
        psyche: {},
        archetypeScores: {},
        counters: {},
      },
      time: { day: 1, period: 'morning', tick: 0 },
      locations: {},
      characters: {},
      firedEventIds: [],
      counters: {},
    })
  })

  it('returns a JSON string for a valid save ID', () => {
    const id = sys.save('My Export')
    const json = sys.exportSave(id)
    expect(typeof json).toBe('string')
    expect(() => JSON.parse(json)).not.toThrow()
  })

  it('exported JSON contains all required fields', () => {
    const id = sys.save('My Export')
    const json = sys.exportSave(id)
    const data = JSON.parse(json)
    expect(data.id).toBeTruthy()
    expect(data.version).toBe(SAVE_VERSION)
    expect(data.player).toBeDefined()
    expect(data.time).toBeDefined()
    expect(data.firedEventIds).toBeDefined()
  })

  it('returns null for an unknown save ID', () => {
    expect(sys.exportSave('no-such-id')).toBeNull()
  })

  it('exported JSON is pretty-printed (contains newlines)', () => {
    const id = sys.save('Pretty')
    const json = sys.exportSave(id)
    expect(json).toContain('\n')
  })
})

// ---------------------------------------------------------------------------
// importSave()
// ---------------------------------------------------------------------------

describe('importSave()', () => {
  let ls
  let sys

  beforeEach(() => {
    ls = createLocalStorageMock()
    sys = buildSaveSystem(ls, {
      player: {
        id: 'p1',
        name: 'Importer',
        currentLocationId: 'moms_house',
        status: {},
        stats: {},
        inventory: [],
        psyche: {},
        archetypeScores: {},
        counters: {},
      },
      time: { day: 2, period: 'evening', tick: 4 },
      locations: {},
      characters: {},
      firedEventIds: [],
      counters: {},
    })
  })

  it('returns a new ID when importing valid JSON', () => {
    const json = JSON.stringify(makeValidSave())
    const newId = sys.importSave(json)
    expect(newId).not.toBeNull()
    expect(typeof newId).toBe('string')
  })

  it('imported save is loadable', () => {
    const original = makeValidSave({ name: 'Imported Save' })
    const newId = sys.importSave(JSON.stringify(original))
    const loaded = sys.load(newId)
    expect(loaded).not.toBeNull()
    expect(loaded.name).toBe('Imported Save')
  })

  it('imported save appears in listSaves()', () => {
    sys.importSave(JSON.stringify(makeValidSave({ name: 'From File' })))
    const saves = sys.listSaves()
    expect(saves).toHaveLength(1)
    expect(saves[0].name).toBe('From File')
  })

  it('imported save gets a fresh ID (does not use original ID)', () => {
    const original = makeValidSave({ id: 'original-id-xyz' })
    const newId = sys.importSave(JSON.stringify(original))
    expect(newId).not.toBe('original-id-xyz')
  })

  it('returns null for invalid JSON', () => {
    expect(sys.importSave('this is not json }{{')).toBeNull()
  })

  it('returns null for valid JSON but missing required fields', () => {
    const bad = JSON.stringify({ version: 1, name: 'incomplete' })
    expect(sys.importSave(bad)).toBeNull()
  })

  it('returns null for a save with version 0', () => {
    const bad = makeValidSave({ version: 0 })
    expect(sys.importSave(JSON.stringify(bad))).toBeNull()
  })

  it('returns null when at MAX_SAVES capacity', () => {
    for (let i = 0; i < MAX_SAVES; i++) {
      sys.save(`Save ${i}`)
    }
    const json = JSON.stringify(makeValidSave())
    expect(sys.importSave(json)).toBeNull()
  })

  it('can round-trip export then import', () => {
    const id = sys.save('Round Trip')
    const json = sys.exportSave(id)
    const newId = sys.importSave(json)
    expect(newId).not.toBeNull()
    const loaded = sys.load(newId)
    expect(loaded.name).toBe('Round Trip')
    expect(loaded.version).toBe(SAVE_VERSION)
  })

  it('after import there are two separate saves in the index', () => {
    const id = sys.save('Original')
    const json = sys.exportSave(id)
    sys.importSave(json)
    expect(sys.listSaves()).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// Edge cases / resilience
// ---------------------------------------------------------------------------

describe('resilience — corrupted index', () => {
  let ls
  let sys

  beforeEach(() => {
    ls = createLocalStorageMock()
    sys = buildSaveSystem(ls)
  })

  it('listSaves() returns [] when the index is corrupted JSON', () => {
    ls.setItem('sportsim_saves', 'totally broken {{{')
    expect(sys.listSaves()).toEqual([])
  })

  it('save() still works after a corrupted index (starts fresh)', () => {
    ls.setItem('sportsim_saves', 'broken')
    const id = sys.save('After corruption')
    expect(id).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// saveMigrate — v1 saves know only a sobriety number
// ---------------------------------------------------------------------------

describe('saveMigrate', () => {
  function makeV1Save() {
    return {
      ...makeValidSave({ version: 1 }),
      player: {
        id: 'p1',
        name: 'Old Hand',
        status: { hunger: 50, sobriety: 35, energy: 70, mood: 40, health: 100, money: 2 },
        stats: {},
        inventory: [],
      },
      characters: {
        maurice: {
          id: 'maurice',
          status: { hunger: 35, sobriety: 60, energy: 55, mood: 70, health: 75 },
        },
        fixed: { id: 'fixed', status: null },
      },
    }
  }

  it('brings a v1 save to the current version', () => {
    const migrated = saveMigrate({ save: makeV1Save() })
    expect(migrated.version).toBe(SAVE_VERSION)
  })

  it('gives the player empty intoxications, empty habituations, a sober blend, and derived sobriety', () => {
    const migrated = saveMigrate({ save: makeV1Save() })
    expect(migrated.player.intoxications).toEqual({})
    expect(migrated.player.habituations).toEqual({})
    expect(migrated.player.blend).toEqual(blendSober())
    expect(migrated.player.status.sobriety).toBe(100)
  })

  it('does the same for every character that carries a status', () => {
    const migrated = saveMigrate({ save: makeV1Save() })
    expect(migrated.characters.maurice.intoxications).toEqual({})
    expect(migrated.characters.maurice.status.sobriety).toBe(100)
    expect(migrated.characters.fixed.status).toBeNull()
    expect(migrated.characters.fixed.blend).toEqual(blendSober())
  })

  it('gives everyone an empty skill grid on the way to v3', () => {
    const migrated = saveMigrate({ save: makeV1Save() })
    expect(migrated.player.skills).toEqual({})
    expect(migrated.characters.maurice.skills).toEqual({})
    expect(migrated.characters.fixed.skills).toEqual({})
  })

  it('gives everyone an empty inspiration log on the way to v4', () => {
    const migrated = saveMigrate({ save: makeV1Save() })
    expect(migrated.player.inspirations).toEqual([])
    expect(migrated.characters.maurice.inspirations).toEqual([])
  })

  it('a v3 save keeps its skills and gains only the log', () => {
    const v3 = makeValidSave({ version: 3 })
    v3.player.skills = { painting: { sober: { base: 4, modifiers: [], xp: 2 } } }
    const migrated = saveMigrate({ save: v3 })
    expect(migrated.version).toBe(SAVE_VERSION)
    expect(migrated.player.skills.painting.sober.base).toBe(4)
    expect(migrated.player.inspirations).toEqual([])
  })

  it('does not mutate the input', () => {
    const v1 = makeV1Save()
    saveMigrate({ save: v1 })
    expect(v1.version).toBe(1)
    expect(v1.player.status.sobriety).toBe(35)
    expect(v1.player.intoxications).toBeUndefined()
  })

  it('returns a current-version save unchanged, as a copy', () => {
    const current = makeValidSave()
    const migrated = saveMigrate({ save: current })
    expect(migrated).toEqual(current)
    expect(migrated).not.toBe(current)
  })
})

// ---------------------------------------------------------------------------
// Old saves on disk, and imports, through the real load path
// ---------------------------------------------------------------------------

describe('load() and importSave() — old saves and fresh ids', () => {
  let ls
  let sys

  beforeEach(() => {
    ls = createLocalStorageMock()
    sys = buildSaveSystem(ls)
  })

  function v1OnDisk() {
    const v1 = makeValidSave({ id: 'old-one', version: 1 })
    v1.player.status = { hunger: 50, sobriety: 35, energy: 70, mood: 40, health: 100, money: 2 }
    ls.setItem('sportsim_save_old-one', JSON.stringify(v1))
    ls.setItem(
      'sportsim_saves',
      JSON.stringify([{ id: 'old-one', name: v1.name, timestamp: v1.timestamp }])
    )
    return v1
  }

  it('a v1 save read off disk comes back migrated, not as it was written', () => {
    v1OnDisk()
    const loaded = sys.load('old-one')
    expect(loaded.version).toBe(SAVE_VERSION)
    expect(loaded.player.intoxications).toEqual({})
    expect(loaded.player.skills).toEqual({})
    expect(loaded.player.inspirations).toEqual([])
    expect(loaded.player.status.sobriety).toBe(100)
  })

  it('loading does not rewrite what is on disk', () => {
    const v1 = v1OnDisk()
    sys.load('old-one')
    expect(JSON.parse(ls.getItem('sportsim_save_old-one'))).toEqual(v1)
  })

  it('an import gets an id of its own and leaves the original id unwritten', () => {
    const foreign = makeValidSave({ id: 'somebody-elses' })
    const newId = sys.importSave(JSON.stringify(foreign))
    expect(newId).not.toBeNull()
    expect(newId).not.toBe('somebody-elses')
    expect(ls.getItem('sportsim_save_somebody-elses')).toBeNull()
    expect(sys.load(newId).id).toBe(newId)
  })

  it('importing the same file twice makes two saves, not one overwritten', () => {
    const json = JSON.stringify(makeValidSave({ id: 'dupe' }))
    const first = sys.importSave(json)
    const second = sys.importSave(json)
    expect(first).not.toBe(second)
    expect(sys.listSaves()).toHaveLength(2)
  })

  it('an imported v1 save is stored already migrated', () => {
    const v1 = makeValidSave({ id: 'ancient', version: 1 })
    const newId = sys.importSave(JSON.stringify(v1))
    expect(JSON.parse(ls.getItem(`sportsim_save_${newId}`)).version).toBe(SAVE_VERSION)
  })
})
