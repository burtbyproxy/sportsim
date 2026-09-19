import { describe, it, expect } from 'vitest'
import { statusDecayChanges, statXpApply, DECAY_CONFIG, statusChangesApply } from './stats.js'

function makePlayer(overrides = {}) {
  return {
    stats: {
      charm: { base: 10, modifiers: [], xp: 0 },
      wits: { base: 15, modifiers: [], xp: 0 },
      toughness: { base: 5, modifiers: [], xp: 0 },
      stamina: { base: 8, modifiers: [], xp: 0 },
    },
    status: {
      hunger: 50,
      sobriety: 100,
      energy: 80,
      mood: 50,
      health: 100,
      money: 0,
    },
    archetypeScores: {},
    ...overrides,
  }
}

// --- statXpApply ---

describe('statXpApply', () => {
  it('adds xp below the threshold without levelling', () => {
    const { stat, leveledUp } = statXpApply({ stat: { base: 0, modifiers: [], xp: 0 }, amount: 9 })
    expect(stat).toEqual({ base: 0, modifiers: [], xp: 9 })
    expect(leveledUp).toBe(false)
  })

  it('levels as many times as the xp clears, carrying the remainder', () => {
    // thresholds: base 0 → 10, base 1 → 12, base 2 → 14
    const { stat, leveledUp } = statXpApply({ stat: { base: 0, modifiers: [], xp: 0 }, amount: 25 })
    expect(stat.base).toBe(2)
    expect(stat.xp).toBe(3)
    expect(leveledUp).toBe(true)
  })

  it('caps at 100 and drops surplus xp there', () => {
    const { stat } = statXpApply({ stat: { base: 99, modifiers: [], xp: 0 }, amount: 1000 })
    expect(stat.base).toBe(100)
    expect(stat.xp).toBe(0)
  })

  it('returns a new object and copies modifiers', () => {
    const input = { base: 5, modifiers: [{ source: 'x', value: 1 }], xp: 0 }
    const { stat } = statXpApply({ stat: input, amount: 1 })
    expect(stat).not.toBe(input)
    expect(stat.modifiers).not.toBe(input.modifiers)
    expect(input.xp).toBe(0)
  })
})

// --- DECAY_CONFIG ---

describe('DECAY_CONFIG', () => {
  it('exports a configurable decay config object', () => {
    expect(DECAY_CONFIG).toBeDefined()
    expect(DECAY_CONFIG.hunger.ratePerTick).toBe(-1)
    expect(DECAY_CONFIG.energy.ratePerTick).toBe(-0.5)
    expect(DECAY_CONFIG.sobriety).toBeUndefined() // derived; substances decay in the blend engine
    expect(DECAY_CONFIG.mood.ratePerTick).toBe(-0.25)
    expect(DECAY_CONFIG.mood.baseline).toBe(40)
  })
})

// --- statusDecayChanges ---

describe('statusDecayChanges', () => {
  it('reports clean cents, not floating-point dust, whatever the rates are', () => {
    const config = {
      hunger: { ratePerTick: -0.1, min: 0, max: 100 },
      energy: { ratePerTick: -0.1, min: 0, max: 100 },
      mood: { ratePerTick: -0.1, baseline: 40, min: 0, max: 100 },
    }
    const player = { status: { hunger: 50.3, energy: 50.3, mood: 40.3 } }
    expect(statusDecayChanges({ status: player.status, ticksElapsed: 1, config })).toEqual({
      hunger: -0.1,
      energy: -0.1,
      mood: -0.1,
    })
  })

  it('returns empty object for 0 ticks', () => {
    expect(statusDecayChanges({ status: makePlayer().status, ticksElapsed: 0 })).toEqual({})
  })

  it('decreases hunger each tick', () => {
    const player = makePlayer({
      status: { hunger: 50, sobriety: 80, energy: 80, mood: 40, health: 100, money: 0 },
    })
    const changes = statusDecayChanges({ status: player.status, ticksElapsed: 1 })
    expect(changes.hunger).toBe(-1)
  })

  it('decreases energy each tick (slower)', () => {
    const player = makePlayer({
      status: { hunger: 50, sobriety: 80, energy: 80, mood: 40, health: 100, money: 0 },
    })
    const changes = statusDecayChanges({ status: player.status, ticksElapsed: 2 })
    expect(changes.energy).toBe(-1) // -0.5 * 2
  })

  it('never lets hunger go below 0', () => {
    const player = makePlayer({
      status: { hunger: 1, sobriety: 80, energy: 80, mood: 40, health: 100, money: 0 },
    })
    const changes = statusDecayChanges({ status: player.status, ticksElapsed: 5 })
    expect(player.status.hunger + changes.hunger).toBeGreaterThanOrEqual(0)
  })

  it('never touches sobriety — it is derived from the blend', () => {
    const player = makePlayer({
      status: { hunger: 50, sobriety: 60, energy: 80, mood: 40, health: 100, money: 0 },
    })
    const changes = statusDecayChanges({ status: player.status, ticksElapsed: 10 })
    expect(changes.sobriety).toBeUndefined()
  })

  it('drifts mood down toward baseline (40) when above it', () => {
    const player = makePlayer({
      status: { hunger: 50, sobriety: 80, energy: 80, mood: 80, health: 100, money: 0 },
    })
    const changes = statusDecayChanges({ status: player.status, ticksElapsed: 4 })
    expect(changes.mood).toBe(-1) // -0.25 * 4
  })

  it('drifts mood up toward baseline (40) when below it', () => {
    const player = makePlayer({
      status: { hunger: 50, sobriety: 80, energy: 80, mood: 10, health: 100, money: 0 },
    })
    const changes = statusDecayChanges({ status: player.status, ticksElapsed: 4 })
    expect(changes.mood).toBe(1) // +0.25 * 4
  })

  it('does not change mood when already at baseline (40)', () => {
    const player = makePlayer({
      status: { hunger: 50, sobriety: 80, energy: 80, mood: 40, health: 100, money: 0 },
    })
    const changes = statusDecayChanges({ status: player.status, ticksElapsed: 1 })
    expect(changes.mood).toBeUndefined()
  })

  it('caps mood drift at baseline', () => {
    const player = makePlayer({
      status: { hunger: 50, sobriety: 80, energy: 80, mood: 41, health: 100, money: 0 },
    })
    const changes = statusDecayChanges({ status: player.status, ticksElapsed: 100 })
    expect(41 + (changes.mood ?? 0)).toBeGreaterThanOrEqual(40)
  })

  it('accepts custom config override', () => {
    const player = makePlayer({
      status: { hunger: 50, sobriety: 80, energy: 80, mood: 40, health: 100, money: 0 },
    })
    const customConfig = { ...DECAY_CONFIG, hunger: { ratePerTick: -2, min: 0, max: 100 } }
    const changes = statusDecayChanges({
      status: player.status,
      ticksElapsed: 1,
      config: customConfig,
    })
    expect(changes.hunger).toBe(-2)
  })
})

describe('statusChangesApply', () => {
  const status = { hunger: 50, energy: 90, mood: 40, health: 100, sobriety: 70, money: 3 }

  it('adds each change and holds the result to 0-100', () => {
    const next = statusChangesApply({ status, changes: { hunger: -60, energy: 30, mood: 5 } })
    expect(next).toMatchObject({ hunger: 0, energy: 100, mood: 45 })
  })

  it('never writes money or sobriety, which have their own doors', () => {
    const next = statusChangesApply({ status, changes: { money: 50, sobriety: -40 } })
    expect(next.money).toBe(3)
    expect(next.sobriety).toBe(70)
  })

  it('ignores a key the status does not have', () => {
    expect(statusChangesApply({ status, changes: { luck: 10 } })).not.toHaveProperty('luck')
  })

  it('returns a new status and leaves the old one alone', () => {
    const next = statusChangesApply({ status, changes: { hunger: -10 } })
    expect(next).not.toBe(status)
    expect(status.hunger).toBe(50)
  })
})
