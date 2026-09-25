// @vitest-environment node
// Content contract: cross-reference validation.
import { describe, it, expect } from 'vitest'
import { join } from 'path'
import { CONTENT_ROOT, loadJsonFiles, getMapDirs, outcomesOf } from '../helpers/contentContracts.js'

describe('cross-reference validation', () => {
  // Collect all known location IDs from content/maps/*/locations/
  const mapDirs = getMapDirs()
  const locationFiles = mapDirs.flatMap((mapDir) => loadJsonFiles(join(mapDir, 'locations')))
  const knownLocationIds = new Set(locationFiles.map(({ data }) => data.id).filter(Boolean))

  // Collect all known character IDs from content/characters/
  const characterFiles = loadJsonFiles(join(CONTENT_ROOT, 'characters'))
  const knownCharacterIds = new Set(characterFiles.map(({ data }) => data.id).filter(Boolean))

  // Collect all known item IDs from content/items/
  const itemFiles = loadJsonFiles(join(CONTENT_ROOT, 'items'))
  const knownItemIds = new Set(
    itemFiles.flatMap(({ data }) => {
      const items = Array.isArray(data) ? data : Object.values(data)
      return items.map((i) => i.id).filter(Boolean)
    })
  )

  // Collect all known substance IDs from content/substances/
  const substanceFiles = loadJsonFiles(join(CONTENT_ROOT, 'substances'))
  const knownSubstanceIds = new Set(substanceFiles.map(({ data }) => data.id).filter(Boolean))

  // Character intoxications / habituations name real substances
  for (const { file, data: character } of characterFiles) {
    for (const field of ['intoxications', 'habituations']) {
      for (const substanceId of Object.keys(character[field] ?? {})) {
        it(`${file}: ${field} '${substanceId}' exists in substance data`, () => {
          expect(
            knownSubstanceIds.has(substanceId),
            `Character '${character.id}' ${field} references unknown substance '${substanceId}'`
          ).toBe(true)
        })
      }
    }
  }

  // Item doses name real substances
  for (const { file, data } of itemFiles) {
    const items = Array.isArray(data) ? data : Object.values(data)
    for (const item of items) {
      for (const dose of item.doses ?? []) {
        it(`${file} item '${item.id}': dose '${dose.substanceId}' exists in substance data`, () => {
          expect(
            knownSubstanceIds.has(dose.substanceId),
            `Item '${item.id}' doses unknown substance '${dose.substanceId}'`
          ).toBe(true)
        })
      }
    }
  }

  // Inspirations name real mediums
  const knownMediumIds = new Set(
    loadJsonFiles(join(CONTENT_ROOT, 'mediums'))
      .map(({ data }) => data.id)
      .filter(Boolean)
  )
  for (const { file, data } of [
    ...mapDirs.flatMap((mapDir) => loadJsonFiles(join(mapDir, 'actions'))),
    ...mapDirs.flatMap((mapDir) => loadJsonFiles(join(mapDir, 'events'))),
  ]) {
    const entries = Array.isArray(data) ? data : Object.values(data)
    for (const entry of entries) {
      for (const outcome of outcomesOf(entry)) {
        const mediumId = outcome.inspiration?.mediumId
        if (mediumId === undefined || mediumId === null) continue
        it(`${file} '${entry.id}': inspiration medium '${mediumId}' exists in medium data`, () => {
          expect(
            knownMediumIds.has(mediumId),
            `'${entry.id}' inspires unknown medium '${mediumId}'`
          ).toBe(true)
        })
      }
    }
  }

  // Action and event doses name real substances
  const eventFilesAll = mapDirs.flatMap((mapDir) => loadJsonFiles(join(mapDir, 'events')))
  const actionFilesAll = mapDirs.flatMap((mapDir) => loadJsonFiles(join(mapDir, 'actions')))
  for (const { file, data } of [...actionFilesAll, ...eventFilesAll]) {
    const entries = Array.isArray(data) ? data : Object.values(data)
    for (const entry of entries) {
      for (const outcome of outcomesOf(entry)) {
        for (const dose of outcome.doses ?? []) {
          it(`${file} '${entry.id}': dose '${dose.substanceId}' exists in substance data`, () => {
            expect(
              knownSubstanceIds.has(dose.substanceId),
              `'${entry.id}' doses unknown substance '${dose.substanceId}'`
            ).toBe(true)
          })
        }
      }
    }
  }

  // A habit shows wherever the person is, so it never names a place: somewhere the
  // player doesn't know would give its name away.
  const placeNames = locationFiles.flatMap(({ data }) =>
    [data.display, data.displayInline].map((name) => name.replace(/^the /i, ''))
  )
  for (const { file, data: character } of characterFiles) {
    it(`${file}: habit names no place`, () => {
      for (const name of placeNames) {
        expect(character.habit, `'${character.id}' habit names '${name}'`).not.toContain(name)
      }
    })
  }

  // Character schedule locationIds must exist in location data
  for (const { file, data: character } of characterFiles) {
    if (!character.schedule?.entries?.length) continue
    for (const entry of character.schedule.entries) {
      it(`${file}: schedule locationId '${entry.locationId}' exists in location data`, () => {
        expect(
          knownLocationIds.has(entry.locationId),
          `Character '${character.id}' schedule references unknown location '${entry.locationId}'`
        ).toBe(true)
      })
    }
  }

  // Action itemsGained references real item IDs (string[] per contract)
  const actionFiles = mapDirs.flatMap((mapDir) => loadJsonFiles(join(mapDir, 'actions')))

  // A cure action opens a cure that exists
  const knownCureIds = new Set(
    loadJsonFiles(join(CONTENT_ROOT, 'cures'))
      .map(({ data }) => data.id)
      .filter(Boolean)
  )
  for (const { file, data } of actionFiles) {
    const actions = Array.isArray(data) ? data : Object.values(data)
    for (const action of actions) {
      if (action.kind !== 'cure') continue
      it(`${file} action '${action.id}': cureId '${action.cureId}' exists in cure data`, () => {
        expect(knownCureIds.has(action.cureId)).toBe(true)
      })
    }
  }

  // Every action lives somewhere real, and anyone it involves exists
  for (const { file, data } of actionFiles) {
    const actions = Array.isArray(data) ? data : Object.values(data)
    for (const action of actions) {
      it(`${file} action '${action.id}': locationId '${action.locationId}' is 'any' or a real location`, () => {
        expect(
          action.locationId === 'any' || knownLocationIds.has(action.locationId),
          `Action '${action.id}' lives at unknown location '${action.locationId}'`
        ).toBe(true)
      })
      if (action.characterId === undefined || action.characterId === null) continue
      it(`${file} action '${action.id}': characterId '${action.characterId}' exists in character data`, () => {
        expect(
          knownCharacterIds.has(action.characterId),
          `Action '${action.id}' involves unknown character '${action.characterId}'`
        ).toBe(true)
      })
    }
  }
  for (const { file, data } of actionFiles) {
    const actions = Array.isArray(data) ? data : Object.values(data)
    for (const action of actions) {
      const outcomes = [
        action.success,
        action.failure,
        action.criticalSuccess,
        action.criticalFailure,
      ].filter(Boolean)
      for (const outcome of outcomes) {
        const gained = outcome.itemsGained ?? []
        const itemIds = Array.isArray(gained) ? gained.filter((i) => typeof i === 'string') : []
        for (const itemId of itemIds) {
          it(`${file} action '${action.id}': itemsGained '${itemId}' exists in item data`, () => {
            expect(
              knownItemIds.has(itemId),
              `Action '${action.id}' references unknown item '${itemId}'`
            ).toBe(true)
          })
        }
      }
    }
  }
})
