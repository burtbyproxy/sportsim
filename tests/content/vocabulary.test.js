// @vitest-environment node
// Content contract: content/vocabulary.json — the game's words.
import { describe, it, expect } from 'vitest'
import {
  VOCABULARY,
  VALID_STATS,
  VALID_STATUS_KEYS,
  VALID_SIMULATION_TIERS,
} from '../helpers/contentContracts.js'

describe("content/vocabulary.json — the game's words", () => {
  it('the screen has every word it shows, and none is blank', () => {
    const ui = VOCABULARY.ui
    const paths = [
      'menu.title',
      'menu.empty',
      'menu.emptyWith',
      'narrative.skipHint',
      'footer.idle',
      'footer.keys',
      'tabs.status',
      'tabs.inventory',
      'tabs.work',
      'sections.time',
      'sections.vitals',
      'sections.muse',
      'sections.funds',
      'sections.carrying',
      'sections.made',
      'nothing',
    ]
    for (const path of paths) {
      const word = path.split('.').reduce((node, key) => node?.[key], ui)
      expect(typeof word, `ui.${path}`).toBe('string')
      expect(word.length, `ui.${path}`).toBeGreaterThan(0)
    }
    expect(ui.menu.emptyWith, 'ui.menu.emptyWith names who').toContain('{name}')
  })

  it('every stat and vital has an id and reads as something', () => {
    for (const entry of [...VOCABULARY.stats, ...VOCABULARY.statuses]) {
      expect(typeof entry.id).toBe('string')
      expect(typeof entry.display).toBe('string')
      expect(entry.display.length).toBeGreaterThan(0)
    }
    const ids = [...VOCABULARY.stats, ...VOCABULARY.statuses].map((e) => e.id)
    expect(new Set(ids).size, 'ids are unique across stats and vitals').toBe(ids.length)
  })

  it('every vital says how it looks and where its bar turns', () => {
    for (const status of VOCABULARY.statuses) {
      expect(typeof status.icon, `${status.id}: icon`).toBe('string')
      expect(typeof status.writable, `${status.id}: writable`).toBe('boolean')
      expect(status.danger, `${status.id}: danger below warning`).toBeLessThan(status.warning)
      expect(status.warning).toBeLessThanOrEqual(100)
    }
  })

  it('the code fallbacks have not drifted from it', async () => {
    const defaults = await import('../../src/models/defaults.js')
    expect([...defaults.STAT_IDS_DEFAULT]).toEqual(VALID_STATS)
    expect([...defaults.STATUS_IDS_WRITABLE_DEFAULT].sort()).toEqual([...VALID_STATUS_KEYS].sort())
    expect([...defaults.SIMULATION_TIERS_DEFAULT]).toEqual(VALID_SIMULATION_TIERS)
  })
})
