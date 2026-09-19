// @vitest-environment node
// Content contract: content/scavenge/*.json — Scavenge table contract.
import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import { join } from 'path'
import {
  CONTENT_ROOT,
  loadJsonFiles,
  getMapDirs,
  validateScavengeTable,
} from '../helpers/contentContracts.js'

describe('content/scavenge/*.json — Scavenge table contract', () => {
  const dir = join(CONTENT_ROOT, 'scavenge')
  const files = loadJsonFiles(dir)
  const itemsById = new Map(
    loadJsonFiles(join(CONTENT_ROOT, 'items')).flatMap(({ data }) =>
      (Array.isArray(data) ? data : Object.values(data)).map((i) => [i.id, i])
    )
  )
  const mediumIds = new Set(loadJsonFiles(join(CONTENT_ROOT, 'mediums')).map(({ data }) => data.id))

  it('content/scavenge/ directory exists', () => {
    expect(existsSync(dir)).toBe(true)
  })

  const ids = new Set()
  for (const { file, data } of files) {
    it(`${file} — valid scavenge table`, () => {
      validateScavengeTable({ data, file })
      expect(ids.has(data.id), `${file}: duplicate table id '${data.id}'`).toBe(false)
      ids.add(data.id)
      for (const entry of data.entries) {
        const item = itemsById.get(entry.itemId)
        expect(item, `${file}: entry '${entry.itemId}' is not an item`).toBeTruthy()
        expect(
          typeof item.foundAs,
          `${file}: '${entry.itemId}' can be found, so it needs a foundAs phrase for the prose`
        ).toBe('string')
        if (entry.inspiration?.mediumId) {
          expect(
            mediumIds.has(entry.inspiration.mediumId),
            `${file} '${entry.itemId}': unknown medium`
          ).toBe(true)
        }
      }
    })
  }

  // Every location names a table that exists (or null, for nothing to find)
  const tableIds = new Set(files.map(({ data }) => data.id))
  for (const mapDir of getMapDirs()) {
    for (const { file, data: location } of loadJsonFiles(join(mapDir, 'locations'))) {
      it(`${file}: scavengeTableId is declared and real`, () => {
        expect(
          location,
          `${file}: every location declares scavengeTableId (null for nothing)`
        ).toHaveProperty('scavengeTableId')
        if (location.scavengeTableId !== null) {
          expect(
            tableIds.has(location.scavengeTableId),
            `${file}: unknown scavenge table '${location.scavengeTableId}'`
          ).toBe(true)
        }
      })
    }
  }

  // Tools and surfaces name real mediums
  for (const [itemId, item] of itemsById) {
    for (const mediumId of item.mediumIds ?? []) {
      it(`item '${itemId}': medium '${mediumId}' exists in medium data`, () => {
        expect(mediumIds.has(mediumId), `Item '${itemId}' names unknown medium '${mediumId}'`).toBe(
          true
        )
      })
    }
  }
})
