/**
 * The content loader: what it merges, what it refuses, and the real content
 * under content/ loaded through it.
 *
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest'

import { contentMerge, contentLoad, CONTENT_KINDS, LOADER_ERROR_CODES } from '../src/data/loader.js'
import { contentIds } from './helpers/content.js'

describe('contentMerge', () => {
  it('keys entries by id, from files holding one entry or a list', () => {
    const merged = contentMerge({
      files: [
        { path: 'a.json', value: { id: 'beer' } },
        { path: 'b.json', value: [{ id: 'wine' }, { id: 'coffee' }] },
      ],
    })
    expect(Object.keys(merged.data).sort()).toEqual(['beer', 'coffee', 'wine'])
  })

  it('refuses an entry that is not an object, naming the file', () => {
    const merged = contentMerge({ files: [{ path: 'bad.json', value: ['just a string'] }] })
    expect(merged.error).toMatchObject({
      code: LOADER_ERROR_CODES.entryNotObject,
      params: { path: 'bad.json' },
    })
  })

  it('refuses an entry with no id, naming the file', () => {
    const merged = contentMerge({ files: [{ path: 'anon.json', value: { name: 'Nobody' } }] })
    expect(merged.error).toMatchObject({
      code: LOADER_ERROR_CODES.entryIdMissing,
      params: { path: 'anon.json' },
    })
  })

  it('refuses an id two entries share, instead of one quietly winning', () => {
    const merged = contentMerge({
      files: [
        { path: 'first.json', value: { id: 'dale', role: 'bartender' } },
        { path: 'second.json', value: { id: 'dale', role: 'impostor' } },
      ],
    })
    expect(merged.error).toMatchObject({
      code: LOADER_ERROR_CODES.entryIdDuplicate,
      params: { path: 'second.json', id: 'dale', pathFirst: 'first.json' },
    })
  })
})

describe('contentLoad — the real content', () => {
  it('loads every collection keyed by the ids its files declare', () => {
    for (const [kind, dir] of [
      [CONTENT_KINDS.characters, 'content/characters'],
      [CONTENT_KINDS.substances, 'content/substances'],
      [CONTENT_KINDS.conditions, 'content/conditions'],
      [CONTENT_KINDS.mediums, 'content/mediums'],
      [CONTENT_KINDS.voices, 'content/voices'],
      [CONTENT_KINDS.scavengeTables, 'content/scavenge'],
      [CONTENT_KINDS.acts, 'content/acts'],
      [CONTENT_KINDS.cures, 'content/cures'],
    ]) {
      const loaded = contentLoad({ kind })
      expect(loaded.ok, kind).toBe(true)
      expect(Object.keys(loaded.data).sort(), kind).toEqual(contentIds({ dir }))
    }
  })

  it('loads a map by its id, and nothing for a map that is not there', () => {
    const kenton = contentLoad({ kind: CONTENT_KINDS.locations, mapId: 'kenton' })
    expect(Object.keys(kenton.data).sort()).toEqual(
      contentIds({ dir: 'content/maps/kenton/locations' })
    )
    expect(
      contentLoad({ kind: CONTENT_KINDS.actions, mapId: 'kenton' }).data.raid_fridge
    ).toBeDefined()
    expect(contentLoad({ kind: CONTENT_KINDS.locations, mapId: 'atlantis' }).data).toEqual({})
  })

  it('hands back the game config and the vocabulary as themselves', () => {
    expect(contentLoad({ kind: CONTENT_KINDS.config }).data.mapId).toBe('kenton')
    expect(contentLoad({ kind: CONTENT_KINDS.vocabulary }).data.stats.length).toBeGreaterThan(0)
  })

  it('refuses a kind that does not exist', () => {
    expect(contentLoad({ kind: 'spells' }).error).toMatchObject({
      code: LOADER_ERROR_CODES.kindUnknown,
      params: { kind: 'spells' },
    })
  })
})
