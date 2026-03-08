import { describe, it, expect } from 'vitest'
import { gainStatXP, calculateLevel, checkArchetypeThresholds, getStatDecayEffects } from './stats.js'

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

// --- gainStatXP ---

describe('gainStatXP', () => {
  it('adds XP to stat', () => {
    const player = makePlayer()
    const { updatedStat, leveledUp } = gainStatXP(player, 'charm', 5)
    expect(updatedStat.xp).toBe(5)
    expect(leveledUp).toBe(false)
  })

  it('levels up stat when XP crosses threshold', () => {
    const player = makePlayer()
    // base=10, threshold = 10 + 10*2 = 30
    const { updatedStat, leveledUp } = gainStatXP(player, 'charm', 30)
    expect(leveledUp).toBe(true)
    expect(updatedStat.base).toBe(11)
    expect(updatedStat.xp).toBe(0)
  })

  it('carries over excess XP after level up', () => {
    const player = makePlayer()
    // threshold at base=10 is 30, give 35 xp
    const { updatedStat } = gainStatXP(player, 'charm', 35)
    expect(updatedStat.xp).toBe(5)
    expect(updatedStat.base).toBe(11)
  })

  it('caps base stat at 100', () => {
    const player = makePlayer()
    player.stats.charm.base = 100
    player.stats.charm.xp = 0
    // threshold at base=100: 10 + 100*2 = 210
    const { updatedStat, leveledUp } = gainStatXP(player, 'charm', 210)
    expect(leveledUp).toBe(true)
    expect(updatedStat.base).toBe(100) // capped
  })

  it('returns null updatedStat for unknown stat', () => {
    const player = makePlayer()
    const { updatedStat, leveledUp } = gainStatXP(player, 'nonexistent', 10)
    expect(updatedStat).toBeNull()
    expect(leveledUp).toBe(false)
  })

  it('does not mutate the original stat', () => {
    const player = makePlayer()
    const original = player.stats.charm.xp
    gainStatXP(player, 'charm', 5)
    expect(player.stats.charm.xp).toBe(original)
  })
})

// --- calculateLevel ---

describe('calculateLevel', () => {
  it('returns average of all stat bases, floored', () => {
    const player = makePlayer()
    // bases: charm=10, wits=15, toughness=5, stamina=8 -> avg = 38/4 = 9.5 -> floor = 9
    expect(calculateLevel(player)).toBe(9)
  })

  it('returns 1 when no stats', () => {
    expect(calculateLevel({ stats: {} })).toBe(1)
  })

  it('returns minimum of 1', () => {
    const player = makePlayer()
    player.stats = { charm: { base: 1, modifiers: [], xp: 0 } }
    expect(calculateLevel(player)).toBeGreaterThanOrEqual(1)
  })
})

// --- checkArchetypeThresholds ---

describe('checkArchetypeThresholds', () => {
  const archetypes = [
    { id: 'drunk', thresholds: [10, 25, 50] },
    { id: 'artist', thresholds: [20, 40] },
  ]

  it('returns empty array when no thresholds crossed', () => {
    const player = makePlayer({ archetypeScores: { drunk: 5, artist: 5 } })
    const result = checkArchetypeThresholds(player, archetypes)
    expect(result).toHaveLength(0)
  })

  it('detects newly crossed threshold', () => {
    const player = makePlayer({ archetypeScores: { drunk: 12, artist: 5 } })
    const result = checkArchetypeThresholds(player, archetypes)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ archetypeId: 'drunk', threshold: 10 })
  })

  it('detects multiple crossed thresholds', () => {
    const player = makePlayer({ archetypeScores: { drunk: 30, artist: 45 } })
    const result = checkArchetypeThresholds(player, archetypes)
    // drunk: crossed 10 and 25. artist: crossed 20 and 40
    expect(result).toHaveLength(4)
  })

  it('ignores already-crossed thresholds', () => {
    const player = makePlayer({ archetypeScores: { drunk: 30 } })
    const previouslyCrossed = { drunk: 25 }
    const result = checkArchetypeThresholds(player, archetypes, previouslyCrossed)
    // 10 and 25 already crossed, only new ones should return
    expect(result).toHaveLength(0)
  })
})

// --- getStatDecayEffects ---

describe('getStatDecayEffects', () => {
  it('returns empty object for 0 ticks', () => {
    expect(getStatDecayEffects(makePlayer(), 0)).toEqual({})
  })

  it('decreases hunger each tick', () => {
    const player = makePlayer({ status: { hunger: 50, sobriety: 100, energy: 80, mood: 50, health: 100, money: 0 } })
    const changes = getStatDecayEffects(player, 1)
    expect(changes.hunger).toBe(-1)
  })

  it('decreases energy each tick (slower)', () => {
    const player = makePlayer()
    const changes = getStatDecayEffects(player, 2)
    expect(changes.energy).toBe(-1) // -0.5 * 2
  })

  it('never lets hunger go below 0', () => {
    const player = makePlayer({ status: { hunger: 1, sobriety: 100, energy: 80, mood: 50, health: 100, money: 0 } })
    const changes = getStatDecayEffects(player, 5)
    // hunger was 1, change would be -5, capped at 0: change = 0 - 1 = -1
    expect(player.status.hunger + changes.hunger).toBeGreaterThanOrEqual(0)
  })

  it('increases sobriety when below 100', () => {
    const player = makePlayer({ status: { hunger: 50, sobriety: 60, energy: 80, mood: 50, health: 100, money: 0 } })
    const changes = getStatDecayEffects(player, 1)
    expect(changes.sobriety).toBe(2)
  })

  it('does not change sobriety when already at 100', () => {
    const player = makePlayer({ status: { hunger: 50, sobriety: 100, energy: 80, mood: 50, health: 100, money: 0 } })
    const changes = getStatDecayEffects(player, 1)
    expect(changes.sobriety).toBeUndefined()
  })

  it('caps sobriety at 100', () => {
    const player = makePlayer({ status: { hunger: 50, sobriety: 99, energy: 80, mood: 50, health: 100, money: 0 } })
    const changes = getStatDecayEffects(player, 5) // +10, but capped at 100
    expect(99 + changes.sobriety).toBeLessThanOrEqual(100)
  })
})
