import { describe, it, expect } from 'vitest'
import { STATUS_BAR_STATS, statusBarFillClass } from './statusBar.js'

const DANGER = 'status-stat__fill--danger'
const WARNING = 'status-stat__fill--warning'

describe('STATUS_BAR_STATS', () => {
  it('lists the five vitals in display order, in full words', () => {
    expect(STATUS_BAR_STATS.map((s) => s.label)).toEqual([
      'Health',
      'Energy',
      'Mood',
      'Sobriety',
      'Hunger',
    ])
  })

  it('keys each vital by the status field it reads', () => {
    expect(STATUS_BAR_STATS.map((s) => s.key)).toEqual([
      'health',
      'energy',
      'mood',
      'sobriety',
      'hunger',
    ])
  })

  it('cannot be edited by a component', () => {
    expect(() => STATUS_BAR_STATS.push({})).toThrow()
    expect(() => {
      STATUS_BAR_STATS[0].label = 'HP'
    }).toThrow()
  })
})

describe('statusBarFillClass', () => {
  for (const key of ['health', 'energy', 'mood', 'hunger']) {
    it(`${key}: danger at 20 and under, warning to 40, fine above`, () => {
      expect(statusBarFillClass({ key, value: 0 })).toBe(DANGER)
      expect(statusBarFillClass({ key, value: 20 })).toBe(DANGER)
      expect(statusBarFillClass({ key, value: 21 })).toBe(WARNING)
      expect(statusBarFillClass({ key, value: 40 })).toBe(WARNING)
      expect(statusBarFillClass({ key, value: 41 })).toBe('')
      expect(statusBarFillClass({ key, value: 100 })).toBe('')
    })
  }

  it('sobriety warns early: danger at 25 and under, warning to 50', () => {
    expect(statusBarFillClass({ key: 'sobriety', value: 25 })).toBe(DANGER)
    expect(statusBarFillClass({ key: 'sobriety', value: 26 })).toBe(WARNING)
    expect(statusBarFillClass({ key: 'sobriety', value: 50 })).toBe(WARNING)
    expect(statusBarFillClass({ key: 'sobriety', value: 51 })).toBe('')
  })

  it('a bar nobody configured uses the default thresholds', () => {
    expect(statusBarFillClass({ key: 'legend', value: 20 })).toBe(DANGER)
    expect(statusBarFillClass({ key: 'legend', value: 41 })).toBe('')
  })
})
