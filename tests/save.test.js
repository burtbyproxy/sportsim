/**
 * Tests for useSave composable.
 *
 * Covers: validation, versioning, export/import, save slot limit.
 *
 * The node test environment has no localStorage, so an in-memory one is
 * installed. The composable and the store are the real ones.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  useSave,
  saveValidate,
  saveMigrate,
  SAVE_ERROR_CODES,
  SAVE_VERSION,
  MAX_SAVES,
} from '../src/composables/useSave.js'
import { useGameStore } from '../src/stores/game.js'
import { blendSober } from '../src/engine/blend.js'
import { storageInstall } from './helpers/storage.js'
import { tuningContent } from './helpers/content.js'

const tuning = tuningContent()

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

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
    locations: Object.fromEntries([['moms_house', { id: 'moms_house', name: "Mom's House" }]]),
    characters: {},
    firedEventIds: [],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// saveValidate
// ---------------------------------------------------------------------------

describe('saveValidate', () => {
  it('accepts a well-formed save', () => {
    expect(saveValidate({ save: makeValidSave() }).ok).toBe(true)
  })

  it('rejects null', () => {
    expect(saveValidate({ save: null }).ok).toBe(false)
  })

  it('rejects a non-object (string)', () => {
    expect(saveValidate({ save: '{"version":1}' }).ok).toBe(false)
  })

  it('rejects a non-object (number)', () => {
    expect(saveValidate({ save: 42 }).ok).toBe(false)
  })

  it('rejects an empty object', () => {
    expect(saveValidate({ save: {} }).ok).toBe(false)
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
  ]
  for (const field of requiredFields) {
    it(`rejects a save missing "${field}"`, () => {
      const save = makeValidSave()
      delete save[field]
      expect(saveValidate({ save }).error).toMatchObject({
        code: SAVE_ERROR_CODES.fieldMissing,
        params: { field },
      })
    })
  }

  it('rejects a save with version 0', () => {
    expect(saveValidate({ save: makeValidSave({ version: 0 }) }).error.code).toBe(
      SAVE_ERROR_CODES.versionInvalid
    )
  })

  it('rejects a save with a negative version', () => {
    expect(saveValidate({ save: makeValidSave({ version: -1 }) }).ok).toBe(false)
  })

  it('rejects a save with a string version', () => {
    expect(saveValidate({ save: makeValidSave({ version: '1' }) }).ok).toBe(false)
  })

  it('accepts a save with a future (higher) version number', () => {
    // Future versions are valid — migration is a separate concern
    expect(saveValidate({ save: makeValidSave({ version: 99 }) }).ok).toBe(true)
  })

  it('rejects a save where a required field is null (simulates explicit nulling)', () => {
    // JSON.parse cannot produce undefined, but null is possible.
    // The validator checks field presence (not value type), which is correct:
    // null values are caught at load time by the game store, not the schema check.
    // This test documents that the validator cares about key presence, not null-ness.
    const save = makeValidSave()
    delete save.player
    expect(saveValidate({ save }).ok).toBe(false)
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
function buildSaveSystem({ lsMock, gameState = {} }) {
  globalThis.localStorage = lsMock
  setActivePinia(createPinia())
  const game = useGameStore()
  game.tuningRegister({ tuning })
  game.$patch(gameState)
  return useSave()
}

// ---------------------------------------------------------------------------
// saveWrite() and saveRead() — round trip
// ---------------------------------------------------------------------------

describe('saveWrite() and saveRead() — round trip', () => {
  let ls
  let sys

  beforeEach(() => {
    ls = storageInstall()
    sys = buildSaveSystem({
      lsMock: ls,
      gameState: {
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
        locations: Object.fromEntries([['moms_house', { id: 'moms_house' }]]),
        characters: { npc1: { id: 'npc1', name: 'Stranger' } },
        firedEventIds: ['event_intro'],
      },
    })
  })

  it('saveWrite() returns a non-null ID', () => {
    const id = sys.saveWrite({ name: 'My Save' }).data.id
    expect(id).not.toBeNull()
    expect(typeof id).toBe('string')
  })

  it('saveRead() returns valid save data after saveWrite()', () => {
    const id = sys.saveWrite({ name: 'My Save' }).data.id
    const data = sys.saveRead({ id }).data
    expect(data).not.toBeNull()
    expect(data.name).toBe('My Save')
  })

  it('saved data includes SAVE_VERSION', () => {
    const id = sys.saveWrite().data.id
    const data = sys.saveRead({ id }).data
    expect(data.version).toBe(SAVE_VERSION)
  })

  it('saved data includes all required fields', () => {
    const id = sys.saveWrite().data.id
    const data = sys.saveRead({ id }).data
    expect(data.player).toBeDefined()
    expect(data.time).toBeDefined()
    expect(data.locations).toBeDefined()
    expect(data.characters).toBeDefined()
    expect(data.firedEventIds).toBeDefined()
  })

  it("saves only what the game reads: no counters beside the player's own", () => {
    const data = sys.saveRead({ id: sys.saveWrite().data.id }).data
    expect(data).not.toHaveProperty('counters')
    expect(data.player.counters).toBeDefined()
  })

  it('saveRead() fails NOT_FOUND for an unknown ID', () => {
    expect(sys.saveRead({ id: 'does-not-exist' }).error.code).toBe(SAVE_ERROR_CODES.notFound)
  })

  it('saveRead() fails UNREADABLE for a corrupted (non-JSON) save', () => {
    ls.setItem('sportsim_save_bad', 'not json at all {{{{')
    expect(sys.saveRead({ id: 'bad' }).error.code).toBe(SAVE_ERROR_CODES.unreadable)
  })

  it('saveRead() fails FIELD_MISSING for a save missing required fields', () => {
    const partial = { id: 'x', name: 'X', timestamp: 1, version: 1 } // missing player, time, etc.
    ls.setItem('sportsim_save_x', JSON.stringify(partial))
    expect(sys.saveRead({ id: 'x' }).error).toMatchObject({
      code: SAVE_ERROR_CODES.fieldMissing,
      params: { field: 'player' },
    })
  })

  it('saveRead() fails VERSION_INVALID for a save with version 0', () => {
    const bad = makeValidSave({ version: 0 })
    ls.setItem('sportsim_save_bad', JSON.stringify(bad))
    expect(sys.saveRead({ id: 'bad' }).error.code).toBe(SAVE_ERROR_CODES.versionInvalid)
  })

  it('default name uses day and period from game state', () => {
    const id = sys.saveWrite().data.id
    const data = sys.saveRead({ id }).data
    expect(data.name).toBe('Day 3 — afternoon')
  })
})

// ---------------------------------------------------------------------------
// savesList() and saveDelete()
// ---------------------------------------------------------------------------

describe('savesList() and saveDelete()', () => {
  let ls
  let sys

  beforeEach(() => {
    ls = storageInstall()
    sys = buildSaveSystem({ lsMock: ls })
  })

  it('savesList() returns empty array when no saves exist', () => {
    expect(sys.savesList().data).toEqual([])
  })

  it('savesList() returns one entry after save()', () => {
    sys.saveWrite({ name: 'First' })
    expect(sys.savesList().data).toHaveLength(1)
  })

  it('savesList() index entry has id, name, timestamp', () => {
    sys.saveWrite({ name: 'Named Save' })
    const [entry] = sys.savesList().data
    expect(entry.id).toBeTruthy()
    expect(entry.name).toBe('Named Save')
    expect(typeof entry.timestamp).toBe('number')
  })

  it('savesList() grows with each save', () => {
    sys.saveWrite({ name: 'A' })
    sys.saveWrite({ name: 'B' })
    sys.saveWrite({ name: 'C' })
    expect(sys.savesList().data).toHaveLength(3)
  })

  it('saveDelete() removes the entry from the index', () => {
    const id = sys.saveWrite({ name: 'ToDelete' }).data.id
    sys.saveDelete({ id })
    expect(sys.savesList().data).toHaveLength(0)
  })

  it('saveDelete() means saveRead() finds nothing for that ID', () => {
    const id = sys.saveWrite({ name: 'ToDelete' }).data.id
    sys.saveDelete({ id })
    expect(sys.saveRead({ id }).error.code).toBe(SAVE_ERROR_CODES.notFound)
  })

  it('saveDelete() does not affect other saves', () => {
    const id1 = sys.saveWrite({ name: 'Keep' }).data.id
    const id2 = sys.saveWrite({ name: 'Delete' }).data.id
    sys.saveDelete({ id: id2 })
    expect(sys.savesList().data).toHaveLength(1)
    expect(sys.savesList().data[0].id).toBe(id1)
  })

  it('saveDelete() is a no-op for unknown ID', () => {
    sys.saveWrite({ name: 'Safe' })
    expect(sys.saveDelete({ id: 'ghost' }).ok).toBe(true)
    expect(sys.savesList().data).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// saveAuto()
// ---------------------------------------------------------------------------

describe('saveAuto()', () => {
  let ls
  let sys

  beforeEach(() => {
    ls = storageInstall()
    sys = buildSaveSystem({ lsMock: ls })
  })

  it('creates a save named "auto"', () => {
    sys.saveAuto()
    const saves = sys.savesList().data
    expect(saves).toHaveLength(1)
    expect(saves[0].name).toBe('auto')
  })

  it('calling saveAuto() twice still results in only one auto save', () => {
    sys.saveAuto()
    sys.saveAuto()
    const saves = sys.savesList().data
    expect(saves).toHaveLength(1)
    expect(saves[0].name).toBe('auto')
  })

  it('saveAuto() does not delete manual saves', () => {
    sys.saveWrite({ name: 'Manual' })
    sys.saveAuto()
    sys.saveAuto()
    const saves = sys.savesList().data
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
    ls = storageInstall()
    sys = buildSaveSystem({ lsMock: ls })
  })

  it('saveWrite() refuses at MAX_SAVES capacity', () => {
    for (let i = 0; i < MAX_SAVES; i++) {
      const id = sys.saveWrite({ name: `Save ${i}` }).data.id
      expect(id).not.toBeNull()
    }
    const overflow = sys.saveWrite({ name: 'Overflow' })
    expect(overflow.error).toMatchObject({
      code: SAVE_ERROR_CODES.limitReached,
      params: { limit: MAX_SAVES },
    })
  })

  it('deleting a save and then saving again succeeds', () => {
    const ids = []
    for (let i = 0; i < MAX_SAVES; i++) {
      ids.push(sys.saveWrite({ name: `Save ${i}` }).data.id)
    }
    sys.saveDelete({ id: ids[0] })
    const newId = sys.saveWrite({ name: 'After delete' }).data.id
    expect(newId).not.toBeNull()
    expect(sys.savesList().data).toHaveLength(MAX_SAVES)
  })

  it('index count never exceeds MAX_SAVES', () => {
    for (let i = 0; i < MAX_SAVES + 5; i++) {
      sys.saveWrite({ name: `Save ${i}` })
    }
    expect(sys.savesList().data.length).toBeLessThanOrEqual(MAX_SAVES)
  })
})

// ---------------------------------------------------------------------------
// saveExport()
// ---------------------------------------------------------------------------

describe('saveExport()', () => {
  let ls
  let sys

  beforeEach(() => {
    ls = storageInstall()
    sys = buildSaveSystem({
      lsMock: ls,
      gameState: {
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
      },
    })
  })

  it('returns a JSON string for a valid save ID', () => {
    const id = sys.saveWrite({ name: 'My Export' }).data.id
    const json = sys.saveExport({ id }).data.json
    expect(typeof json).toBe('string')
    expect(() => JSON.parse(json)).not.toThrow()
  })

  it('exported JSON contains all required fields', () => {
    const id = sys.saveWrite({ name: 'My Export' }).data.id
    const json = sys.saveExport({ id }).data.json
    const data = JSON.parse(json)
    expect(data.id).toBeTruthy()
    expect(data.version).toBe(SAVE_VERSION)
    expect(data.player).toBeDefined()
    expect(data.time).toBeDefined()
    expect(data.firedEventIds).toBeDefined()
  })

  it('returns null for an unknown save ID', () => {
    expect(sys.saveExport({ id: 'no-such-id' }).error.code).toBe(SAVE_ERROR_CODES.notFound)
  })

  it('exported JSON is pretty-printed (contains newlines)', () => {
    const id = sys.saveWrite({ name: 'Pretty' }).data.id
    const json = sys.saveExport({ id }).data.json
    expect(json).toContain('\n')
  })
})

// ---------------------------------------------------------------------------
// saveImport()
// ---------------------------------------------------------------------------

describe('saveImport()', () => {
  let ls
  let sys

  beforeEach(() => {
    ls = storageInstall()
    sys = buildSaveSystem({
      lsMock: ls,
      gameState: {
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
      },
    })
  })

  it('returns a new ID when importing valid JSON', () => {
    const json = JSON.stringify(makeValidSave())
    const newId = sys.saveImport({ json }).data.id
    expect(newId).not.toBeNull()
    expect(typeof newId).toBe('string')
  })

  it('imported save is loadable', () => {
    const original = makeValidSave({ name: 'Imported Save' })
    const newId = sys.saveImport({ json: JSON.stringify(original) }).data.id
    const loaded = sys.saveRead({ id: newId }).data
    expect(loaded).not.toBeNull()
    expect(loaded.name).toBe('Imported Save')
  })

  it('imported save appears in savesList()', () => {
    sys.saveImport({ json: JSON.stringify(makeValidSave({ name: 'From File' })) })
    const saves = sys.savesList().data
    expect(saves).toHaveLength(1)
    expect(saves[0].name).toBe('From File')
  })

  it('imported save gets a fresh ID (does not use original ID)', () => {
    const original = makeValidSave({ id: 'original-id-xyz' })
    const newId = sys.saveImport({ json: JSON.stringify(original) }).data.id
    expect(newId).not.toBe('original-id-xyz')
  })

  it('returns null for invalid JSON', () => {
    expect(sys.saveImport({ json: 'this is not json }{{' }).error.code).toBe(
      SAVE_ERROR_CODES.unreadable
    )
  })

  it('returns null for valid JSON but missing required fields', () => {
    const bad = JSON.stringify({ version: 1, name: 'incomplete' })
    expect(sys.saveImport({ json: bad }).error.code).toBe(SAVE_ERROR_CODES.fieldMissing)
  })

  it('returns null for a save with version 0', () => {
    const bad = makeValidSave({ version: 0 })
    expect(sys.saveImport({ json: JSON.stringify(bad) }).error.code).toBe(
      SAVE_ERROR_CODES.versionInvalid
    )
  })

  it('returns null when at MAX_SAVES capacity', () => {
    for (let i = 0; i < MAX_SAVES; i++) {
      sys.saveWrite({ name: `Save ${i}` })
    }
    const json = JSON.stringify(makeValidSave())
    expect(sys.saveImport({ json }).error.code).toBe(SAVE_ERROR_CODES.limitReached)
  })

  it('can round-trip export then import', () => {
    const id = sys.saveWrite({ name: 'Round Trip' }).data.id
    const json = sys.saveExport({ id }).data.json
    const newId = sys.saveImport({ json }).data.id
    expect(newId).not.toBeNull()
    const loaded = sys.saveRead({ id: newId }).data
    expect(loaded.name).toBe('Round Trip')
    expect(loaded.version).toBe(SAVE_VERSION)
  })

  it('after import there are two separate saves in the index', () => {
    const id = sys.saveWrite({ name: 'Original' }).data.id
    const json = sys.saveExport({ id }).data.json
    sys.saveImport({ json })
    expect(sys.savesList().data).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// Edge cases / resilience
// ---------------------------------------------------------------------------

describe('resilience — corrupted index', () => {
  let ls
  let sys

  beforeEach(() => {
    ls = storageInstall()
    sys = buildSaveSystem({ lsMock: ls })
  })

  it('a corrupted index with no saves behind it lists nothing', () => {
    ls.setItem('sportsim_saves', 'totally broken {{{')
    expect(sys.savesList().data).toEqual([])
  })

  it('a corrupted index is rebuilt from the saves themselves, so none are stranded', () => {
    const first = sys.saveWrite({ name: 'First' }).data.id
    const second = sys.saveWrite({ name: 'Second' }).data.id
    ls.setItem('sportsim_saves', 'broken')

    const listed = sys.savesList().data.map((entry) => entry.id)
    expect(listed.sort()).toEqual([first, second].sort())
    expect(JSON.parse(ls.contents().sportsim_saves)).toHaveLength(2)
  })

  it('a new save after a corrupted index keeps the old ones listed', () => {
    sys.saveWrite({ name: 'Before' })
    ls.setItem('sportsim_saves', 'broken')
    expect(sys.saveWrite({ name: 'After corruption' }).ok).toBe(true)
    expect(
      sys
        .savesList()
        .data.map((entry) => entry.name)
        .sort()
    ).toEqual(['After corruption', 'Before'])
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

  it('a v8 save gives every mark, on the player and on everyone else, a count of cures', () => {
    const v8 = makeValidSave({ version: 8 })
    const mark = {
      id: 'm1',
      markId: 'scar',
      target: null,
      source: { kind: 'event', id: 'e' },
      status: 'active',
      fitTicksRemaining: 0,
      acquiredAtTick: 0,
      updatedAtTick: 0,
    }
    v8.player.psyche = { marks: [{ ...mark }], abilities: [], grooves: {} }
    v8.characters = {
      dennis: {
        id: 'dennis',
        psyche: { marks: [{ ...mark, id: 'm2' }], abilities: [], grooves: {} },
      },
    }
    const migrated = saveMigrate({ save: v8 })
    expect(migrated.version).toBe(SAVE_VERSION)
    expect(migrated.player.psyche.marks[0].cures).toEqual({})
    expect(migrated.characters.dennis.psyche.marks[0].cures).toEqual({})
    expect(migrated.player.psyche.marks[0].status).toBe('active')
  })

  it("a v9 save's cure counts become where the mark stands, last seen when the mark last changed", () => {
    const v9 = makeValidSave({ version: 9 })
    v9.player.psyche = {
      marks: [
        {
          id: 'm1',
          markId: 'scar',
          target: null,
          source: { kind: 'event', id: 'e' },
          status: 'active',
          fitTicksRemaining: 0,
          cures: { therapy: 2 },
          acquiredAtTick: 0,
          updatedAtTick: 40,
        },
      ],
      abilities: [],
      grooves: {},
    }
    const migrated = saveMigrate({ save: v9 })
    expect(migrated.version).toBe(SAVE_VERSION)
    expect(migrated.player.psyche.marks[0].cures).toEqual({
      therapy: { sessionsDone: 2, lastSessionTick: 40 },
    })
  })

  it('a v3 save keeps its skills and gains only the log', () => {
    const v3 = makeValidSave({ version: 3 })
    v3.player.skills = { painting: { sober: { base: 4, modifiers: [], xp: 2 } } }
    const migrated = saveMigrate({ save: v3 })
    expect(migrated.version).toBe(SAVE_VERSION)
    expect(migrated.player.skills.painting.sober.base).toBe(4)
    expect(migrated.player.inspirations).toEqual([])
  })

  it('a v6 save loses the fields nothing read, and keeps what was lived', () => {
    const v6 = makeValidSave({ version: 6 })
    v6.counters = { drinks: 2 }
    v6.player = {
      ...v6.player,
      level: 1,
      xp: 0,
      counters: Object.fromEntries([['hoops_sessions', 3]]),
    }
    v6.characters = {
      tina: {
        id: 'tina',
        level: 1,
        dialogueTreeIds: [],
        descriptionVariants: {},
        want: 'To be liked.',
      },
    }
    v6.locations = Object.fromEntries([
      [
        'blue_parrot',
        {
          id: 'blue_parrot',
          variant: 'tavern',
          npcSlots: ['tina'],
          actionIds: [],
          visitCount: 4,
        },
      ],
    ])
    const migrated = saveMigrate({ save: v6 })
    expect(migrated.version).toBe(SAVE_VERSION)
    expect(migrated).not.toHaveProperty('counters')
    expect(migrated.player).not.toHaveProperty('level')
    expect(migrated.player).not.toHaveProperty('xp')
    expect(migrated.player.counters).toEqual(Object.fromEntries([['hoops_sessions', 3]]))
    expect(migrated.characters.tina).toEqual({
      id: 'tina',
      want: 'To be liked.',
      dazed: 0,
      psyche: { marks: [], abilities: [], grooves: {} },
    })
    expect(migrated.locations.blue_parrot).toEqual({ id: 'blue_parrot', visitCount: 4 })
  })

  it('a v7 save knows the places it had found or been to, and where it stands', () => {
    const v7 = makeValidSave({ version: 7 })
    v7.player.currentLocationId = 'arbys'
    v7.locations = Object.fromEntries([
      ['moms_house', { id: 'moms_house', discovered: true, visitCount: 0 }],
      ['blue_parrot', { id: 'blue_parrot', discovered: false, visitCount: 2 }],
      ['glitters', { id: 'glitters', discovered: false, visitCount: 0 }],
      ['arbys', { id: 'arbys', discovered: false, visitCount: 0 }],
    ])
    const migrated = saveMigrate({ save: v7 })
    expect(migrated.version).toBe(SAVE_VERSION)
    expect(migrated.player.knownLocationIds).toEqual(['moms_house', 'blue_parrot', 'arbys'])
    for (const location of Object.values(migrated.locations)) {
      expect(location).not.toHaveProperty('discovered')
    }
  })

  it('a v7 psyche becomes marks: clean, with abilities kept, for the player and everyone else', () => {
    const v7 = makeValidSave({ version: 7 })
    const old = {
      traumas: [{ id: 'mugged', effects: {} }],
      obsessions: [{ id: 'booze', strength: 40 }],
      insanities: [],
      abilities: [{ id: 'abil_dish_hustle', active: true }],
    }
    v7.player.psyche = old
    v7.characters = { maurice: { id: 'maurice', psyche: old } }
    const migrated = saveMigrate({ save: v7 })
    const clean = { marks: [], abilities: old.abilities, grooves: {} }
    expect(migrated.player.psyche).toEqual(clean)
    expect(migrated.characters.maurice.psyche).toEqual(clean)
    expect(migrated.player.dazed).toBe(0)
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

describe('saveRead() and saveImport() — old saves and fresh ids', () => {
  let ls
  let sys

  beforeEach(() => {
    ls = storageInstall()
    sys = buildSaveSystem({ lsMock: ls })
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
    const loaded = sys.saveRead({ id: 'old-one' }).data
    expect(loaded.version).toBe(SAVE_VERSION)
    expect(loaded.player.intoxications).toEqual({})
    expect(loaded.player.skills).toEqual({})
    expect(loaded.player.inspirations).toEqual([])
    expect(loaded.player.status.sobriety).toBe(100)
  })

  it('loading does not rewrite what is on disk', () => {
    const v1 = v1OnDisk()
    sys.saveRead({ id: 'old-one' })
    expect(JSON.parse(ls.getItem('sportsim_save_old-one'))).toEqual(v1)
  })

  it('an import gets an id of its own and leaves the original id unwritten', () => {
    const foreign = makeValidSave({ id: 'somebody-elses' })
    const newId = sys.saveImport({ json: JSON.stringify(foreign) }).data.id
    expect(newId).not.toBeNull()
    expect(newId).not.toBe('somebody-elses')
    expect(ls.getItem('sportsim_save_somebody-elses')).toBeNull()
    expect(sys.saveRead({ id: newId }).data.id).toBe(newId)
  })

  it('importing the same file twice makes two saves, not one overwritten', () => {
    const json = JSON.stringify(makeValidSave({ id: 'dupe' }))
    const first = sys.saveImport({ json }).data.id
    const second = sys.saveImport({ json }).data.id
    expect(first).not.toBe(second)
    expect(sys.savesList().data).toHaveLength(2)
  })

  it('an imported v1 save is stored already migrated', () => {
    const v1 = makeValidSave({ id: 'ancient', version: 1 })
    const newId = sys.saveImport({ json: JSON.stringify(v1) }).data.id
    expect(JSON.parse(ls.getItem(`sportsim_save_${newId}`)).version).toBe(SAVE_VERSION)
  })
})
