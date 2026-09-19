// @vitest-environment node
// Content contract: content/tuning.json — the game's numbers.
import { describe, it, expect } from 'vitest'
import { contentFile, tuningContent } from '../helpers/content.js'
import { listSortBy } from '../../src/utils/list.js'

const tuning = tuningContent()
const vocabulary = contentFile({ path: 'content/vocabulary.json' })
const isNumber = (value) => typeof value === 'number' && Number.isFinite(value)

describe('content/tuning.json — the game numbers', () => {
  it('has every section an engine reads', () => {
    for (const section of [
      'clock',
      'decay',
      'stats',
      'dice',
      'skills',
      'scavenge',
      'making',
      'obsession',
      'simulation',
      'narrative',
    ]) {
      expect(tuning, section).toHaveProperty(section)
    }
  })

  it('a tick is a whole number of minutes, and the periods of the day run in order from midnight', () => {
    expect(Number.isInteger(60 / tuning.clock.ticksPerHour)).toBe(true)
    expect(tuning.clock.startHour).toBeGreaterThanOrEqual(0)
    expect(tuning.clock.startHour).toBeLessThan(24)
    const starts = tuning.clock.periods.map((p) => p.fromHour)
    expect(starts[0]).toBe(0)
    expect(listSortBy({ items: starts, keyOf: (hour) => hour })).toEqual(starts)
  })

  it('every rate, threshold and amount is a number', () => {
    for (const [key, rule] of Object.entries(tuning.decay)) {
      expect(isNumber(rule.ratePerTick), `decay.${key}.ratePerTick`).toBe(true)
    }
    for (const [section, values] of Object.entries({
      stats: tuning.stats,
      dice: tuning.dice,
      skills: tuning.skills,
      scavenge: tuning.scavenge,
      making: tuning.making,
      obsession: tuning.obsession,
    })) {
      for (const [key, value] of Object.entries(values)) {
        expect(isNumber(value), `${section}.${key}`).toBe(true)
      }
    }
    expect(tuning.dice.statPointsPerModifier).toBeGreaterThan(0)
    expect(tuning.skills.pointsPerModifier).toBeGreaterThan(0)
    expect(tuning.stats.xpCheckSuccess).toBeGreaterThanOrEqual(tuning.stats.xpCheckFailure)
  })

  it('every need a character can feel is a vital that exists', () => {
    const vitals = vocabulary.statuses.map((s) => s.id)
    for (const need of tuning.simulation.needs) {
      expect(vitals, need.status).toContain(need.status)
      expect(isNumber(need.below), need.status).toBe(true)
    }
  })

  it('typing speeds and pauses are ranges, and every pause is one character', () => {
    for (const [speed, range] of Object.entries(tuning.narrative.speedsMs)) {
      expect(range.min, speed).toBeLessThanOrEqual(range.max)
    }
    expect(tuning.narrative.speedsMs).toHaveProperty('normal')
    for (const pause of tuning.narrative.punctuationPauseMs) {
      expect([...pause.char], pause.char).toHaveLength(1)
      expect(pause.min).toBeLessThanOrEqual(pause.max)
    }
  })
})
