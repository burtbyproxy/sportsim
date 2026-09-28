// @vitest-environment node
// Content contract: content/tuning.json — the game's numbers.
import { describe, it, expect } from 'vitest'
import { contentFile, contentIds, tuningContent } from '../helpers/content.js'
import { validateDoses } from '../helpers/contentContracts.js'
import { listSortBy } from '../../src/utils/list.js'
import { DISTORTION_KINDS } from '../../src/engine/perception.js'

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
      'psyche',
      'perception',
      'simulation',
      'narrative',
      'fight',
      'display',
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

  it('every stop says what it does per tick, in vitals that exist and substances that exist, and off the map is a stop', () => {
    const { stops, awayStopType } = tuning.simulation
    const writable = vocabulary.statuses.filter((s) => s.writable).map((s) => s.id)
    const substanceIds = contentIds({ dir: 'content/substances' })
    expect(Object.keys(stops).length).toBeGreaterThan(0)
    expect(Object.keys(stops), 'awayStopType').toContain(awayStopType)
    for (const [type, stop] of Object.entries(stops)) {
      for (const [key, delta] of Object.entries(stop.statusChangesPerTick)) {
        expect(writable, `${type}.statusChangesPerTick.${key}`).toContain(key)
        expect(isNumber(delta), `${type}.statusChangesPerTick.${key}`).toBe(true)
      }
      validateDoses({ doses: stop.dosesPerTick, label: `stops.${type}.dosesPerTick` })
      for (const dose of stop.dosesPerTick) {
        expect(substanceIds, `${type}: dose '${dose.substanceId}'`).toContain(dose.substanceId)
      }
    }
  })

  it('a day at home makes up for a day out: the away stop restores faster than the day wears', () => {
    const away = tuning.simulation.stops[tuning.simulation.awayStopType]
    expect(away.statusChangesPerTick.hunger + tuning.decay.hunger.ratePerTick).toBeGreaterThan(0)
    expect(away.statusChangesPerTick.energy + tuning.decay.energy.ratePerTick).toBeGreaterThan(0)
  })

  it('confusion wears off, its bands climb, and every kind of distortion has a chance', () => {
    const { perception } = tuning
    expect(perception.dazedDecayPerTick).toBeGreaterThan(0)
    const floors = perception.bands.map((band) => band.atLeast)
    expect(floors.length).toBeGreaterThan(0)
    expect(listSortBy({ items: floors, keyOf: (n) => n })).toEqual(floors)
    expect(new Set(floors).size).toBe(floors.length)
    expect(floors[0]).toBeGreaterThan(0)
    expect(floors.at(-1)).toBeLessThanOrEqual(100)
    expect(Object.keys(perception.chancePerPoint).sort()).toEqual(
      Object.values(DISTORTION_KINDS).sort()
    )
    for (const [kind, chance] of Object.entries(perception.chancePerPoint)) {
      expect(chance, kind).toBeGreaterThanOrEqual(0)
      expect(
        chance * 100,
        `${kind}: at full confusion still a chance, not past certain`
      ).toBeLessThanOrEqual(1)
    }
  })

  it('a fight is fast, and boring, and the first swing is bad', () => {
    const { fight } = tuning
    const stats = vocabulary.stats.map((s) => s.id)
    const writable = vocabulary.statuses.filter((s) => s.writable).map((s) => s.id)
    expect(fight.roundTicks).toBeGreaterThanOrEqual(1)
    expect(fight.heatPerRound).toBeGreaterThan(0)
    expect(fight.crackAt).toBeGreaterThan(fight.heatPerRound)
    expect(fight.firstSwingModifier, 'throwing first is bad').toBeLessThan(0)
    expect(stats).toContain(fight.swing.stat)
    expect(stats).toContain(fight.ground.stat)
    expect(fight.swing.dazedOnHit).toBeGreaterThan(0)
    expect(fight.ground.dazedOnTop).toBeGreaterThan(0)
    expect(fight.knockoutAt).toBeGreaterThan(0)
    expect(fight.knockoutAt).toBeLessThanOrEqual(100)
    expect(fight.ground.onTopAt).toBeGreaterThanOrEqual(1)
    expect(fight.ground.pulledApartChancePerBystander).toBeGreaterThanOrEqual(0)
    expect(fight.ground.pulledApartChancePerBystander).toBeLessThanOrEqual(1)
    for (const side of ['winner', 'loser']) {
      for (const key of Object.keys(fight[side].statusChanges)) {
        expect(writable, `${side}.${key}`).toContain(key)
      }
    }
    expect(stats).toContain(fight.trauma.save.stat)
    expect(fight.trauma.save.dc).toBeGreaterThan(0)
    expect(typeof fight.trauma.tableId).toBe('string')
    expect(fight.knockout.hours).toBeGreaterThan(0)
    expect(Array.isArray(fight.barred.locationTypes)).toBe(true)
    expect(fight.barred.hours).toBeGreaterThan(0)
  })

  it('the verdict: judged on a stat that exists, bent by how the piece came out, with every reception an outcome', () => {
    const { display } = tuning
    const stats = vocabulary.stats.map((s) => s.id)
    const writable = vocabulary.statuses.filter((s) => s.writable).map((s) => s.id)
    expect(stats).toContain(display.stat)
    expect(display.ticks).toBeGreaterThanOrEqual(1)
    for (const tier of ['inspired', 'solid', 'rough']) {
      expect(isNumber(display.tierModifiers[tier]), `tierModifiers.${tier}`).toBe(true)
    }
    for (const reception of ['praised', 'ignored', 'mocked']) {
      expect(isNumber(display.legend[reception]), `legend.${reception}`).toBe(true)
      const outcome = display.receptions[reception]?.outcome
      expect(outcome, `receptions.${reception}.outcome`).toBeTruthy()
      for (const key of Object.keys(outcome.statusChanges ?? {})) {
        expect(writable, `${reception}.statusChanges.${key}`).toContain(key)
      }
      for (const key of Object.keys(outcome.statChanges ?? {})) {
        expect(stats, `${reception}.statChanges.${key}`).toContain(key)
      }
    }
    expect(display.legend.praised).toBeGreaterThan(display.legend.mocked)
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
