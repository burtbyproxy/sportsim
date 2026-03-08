import { describe, it, expect } from 'vitest'
import {
  rollD20,
  rollCheck,
  rollContested,
  isCriticalSuccess,
  isCriticalFailure,
  calculateModifier,
} from './dice.js'
import { seededRandom } from '../utils/random.js'

// --- Helpers ---

function makePlayer(overrides = {}) {
  return {
    stats: {
      charm: { base: 10, modifiers: [], xp: 0 },
      wits: { base: 12, modifiers: [], xp: 0 },
      toughness: { base: 8, modifiers: [], xp: 0 },
      stamina: { base: 10, modifiers: [], xp: 0 },
      creativity: { base: 10, modifiers: [], xp: 0 },
      luck: { base: 5, modifiers: [], xp: 0 },
    },
    status: {
      hunger: 50,
      sobriety: 100,
      energy: 80,
      mood: 50,
      health: 100,
      money: 0,
    },
    psyche: { traumas: [], obsessions: [], insanities: [], abilities: [] },
    ...overrides,
  }
}

// --- rollD20 ---

describe('rollD20', () => {
  it('always returns 1-20', () => {
    const rng = seededRandom(1)
    for (let i = 0; i < 200; i++) {
      const v = rollD20(rng)
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(20)
    }
  })

  it('is reproducible with seeded RNG', () => {
    const r1 = Array.from({ length: 10 }, () => rollD20(seededRandom(42)))
    const r2 = Array.from({ length: 10 }, () => rollD20(seededRandom(42)))
    expect(r1).toEqual(r2)
  })
})

// --- isCriticalSuccess / isCriticalFailure ---

describe('isCriticalSuccess', () => {
  it('returns true only for 20', () => {
    expect(isCriticalSuccess(20)).toBe(true)
    expect(isCriticalSuccess(19)).toBe(false)
    expect(isCriticalSuccess(1)).toBe(false)
  })
})

describe('isCriticalFailure', () => {
  it('returns true only for 1', () => {
    expect(isCriticalFailure(1)).toBe(true)
    expect(isCriticalFailure(2)).toBe(false)
    expect(isCriticalFailure(20)).toBe(false)
  })
})

// --- calculateModifier ---

describe('calculateModifier', () => {
  it('returns base stat value for sober, healthy player', () => {
    const player = makePlayer()
    expect(calculateModifier(player, 'charm')).toBe(10)
  })

  it('includes active modifiers on the stat', () => {
    const player = makePlayer()
    player.stats.charm.modifiers = [{ source: 'test', value: 5, duration: null }]
    expect(calculateModifier(player, 'charm')).toBe(15)
  })

  it('includes negative modifiers', () => {
    const player = makePlayer()
    player.stats.charm.modifiers = [{ source: 'test', value: -3, duration: null }]
    expect(calculateModifier(player, 'charm')).toBe(7)
  })

  describe('altered state thresholds', () => {
    it('applies wits penalty when sobriety < 30', () => {
      const player = makePlayer({ status: { ...makePlayer().status, sobriety: 25 } })
      // wits base = 12, sobriety < 30 applies wits -5
      expect(calculateModifier(player, 'wits')).toBe(7)
    })

    it('applies charm bonus when sobriety < 30', () => {
      const player = makePlayer({ status: { ...makePlayer().status, sobriety: 25 } })
      // charm base = 10, sobriety < 30 applies charm +3
      expect(calculateModifier(player, 'charm')).toBe(13)
    })

    it('applies override thresholds when sobriety < 15 (wits -10, not -5)', () => {
      const player = makePlayer({ status: { ...makePlayer().status, sobriety: 10 } })
      // sobriety < 15 OVERRIDES: wits -10
      expect(calculateModifier(player, 'wits')).toBe(2)
    })

    it('applies toughness bonus when sobriety < 15', () => {
      const player = makePlayer({ status: { ...makePlayer().status, sobriety: 10 } })
      // sobriety < 15: toughness +5
      expect(calculateModifier(player, 'toughness')).toBe(13)
    })

    it('applies physical stat penalties when energy < 20', () => {
      const player = makePlayer({ status: { ...makePlayer().status, energy: 15 } })
      // stamina base 10, energy < 20: stamina -3
      expect(calculateModifier(player, 'stamina')).toBe(7)
    })

    it('applies mood bonuses when mood > 80', () => {
      const player = makePlayer({ status: { ...makePlayer().status, mood: 90 } })
      // charm base 10, mood > 80: charm +3
      expect(calculateModifier(player, 'charm')).toBe(13)
    })

    it('applies mood penalties when mood < 20 (charm down, creativity up)', () => {
      const player = makePlayer({ status: { ...makePlayer().status, mood: 15 } })
      expect(calculateModifier(player, 'charm')).toBe(5)   // 10 - 5
      expect(calculateModifier(player, 'creativity')).toBe(13) // 10 + 3
    })

    it('stacks multiple altered state effects', () => {
      const player = makePlayer({
        status: { ...makePlayer().status, sobriety: 25, energy: 15 },
      })
      // wits: base 12, sobriety<30 wits-5, energy<20 wits-3 = 4
      expect(calculateModifier(player, 'wits')).toBe(4)
    })
  })

  it('includes active ability dice modifiers', () => {
    const player = makePlayer()
    player.psyche.abilities = [
      {
        id: 'gut_feeling',
        active: true,
        effects: { diceModifiers: { luck: 5 } },
      },
    ]
    expect(calculateModifier(player, 'luck')).toBe(10) // 5 base + 5 ability
  })

  it('ignores inactive abilities', () => {
    const player = makePlayer()
    player.psyche.abilities = [
      {
        id: 'gut_feeling',
        active: false,
        effects: { diceModifiers: { luck: 5 } },
      },
    ]
    expect(calculateModifier(player, 'luck')).toBe(5)
  })

  it('includes trauma stat modifiers', () => {
    const player = makePlayer()
    player.psyche.traumas = [
      {
        id: 'mugged_in_park',
        effects: { statModifiers: { charm: -2 } },
      },
    ]
    expect(calculateModifier(player, 'charm')).toBe(8)
  })
})

// --- rollCheck ---

describe('rollCheck', () => {
  it('returns a DiceResult with all required fields', () => {
    const player = makePlayer()
    const result = rollCheck(player, 'charm', [], 15, seededRandom(1))
    expect(result).toHaveProperty('natural')
    expect(result).toHaveProperty('modifier')
    expect(result).toHaveProperty('total')
    expect(result).toHaveProperty('dc')
    expect(result).toHaveProperty('success')
    expect(result).toHaveProperty('criticalSuccess')
    expect(result).toHaveProperty('criticalFailure')
    expect(result).toHaveProperty('stat')
    expect(result.dc).toBe(15)
    expect(result.stat).toBe('charm')
  })

  it('success is true when total >= dc', () => {
    // Force a natural 20
    const alwaysMax = () => 0.999999
    const player = makePlayer()
    const result = rollCheck(player, 'charm', [], 30, alwaysMax)
    // natural 20 + charm 10 = 30 >= dc 30
    expect(result.success).toBe(true)
    expect(result.criticalSuccess).toBe(true)
  })

  it('failure is true when total < dc', () => {
    // Force a natural 1
    const alwaysMin = () => 0
    const player = makePlayer()
    const result = rollCheck(player, 'charm', [], 30, alwaysMin)
    expect(result.success).toBe(false)
    expect(result.criticalFailure).toBe(true)
  })

  it('adds extra modifiers to the total', () => {
    const alwaysMin = () => 0  // natural = 1
    const player = makePlayer()
    const result = rollCheck(player, 'charm', [5, 5], 1, alwaysMin)
    // natural 1 + charm 10 + extra 10 = 21
    expect(result.total).toBe(21)
    expect(result.success).toBe(true)
  })
})

// --- rollContested ---

describe('rollContested', () => {
  it('returns winner, result1, result2', () => {
    const player1 = makePlayer()
    const player2 = makePlayer()
    const result = rollContested(player1, [], 'charm', player2, [], 'charm', seededRandom(1))
    expect(result).toHaveProperty('winner')
    expect(result).toHaveProperty('result1')
    expect(result).toHaveProperty('result2')
  })

  it('winner 1 when player1 rolls higher', () => {
    // player1 always rolls 20, player2 always rolls 1
    let callCount = 0
    const rng = () => {
      callCount++
      return callCount === 1 ? 0.9999 : 0 // first call high, second low
    }
    const player1 = makePlayer()
    const player2 = makePlayer()
    const result = rollContested(player1, [], 'charm', player2, [], 'charm', rng)
    expect(result.winner).toBe(1)
  })

  it('winner 2 when player2 rolls higher', () => {
    let callCount = 0
    const rng = () => {
      callCount++
      return callCount === 1 ? 0 : 0.9999
    }
    const player1 = makePlayer()
    const player2 = makePlayer()
    const result = rollContested(player1, [], 'charm', player2, [], 'charm', rng)
    expect(result.winner).toBe(2)
  })

  it('tie when totals are equal', () => {
    const alwaysSame = () => 0.5  // same roll, same stat base
    const player1 = makePlayer()
    const player2 = makePlayer()
    const result = rollContested(player1, [], 'charm', player2, [], 'charm', alwaysSame)
    expect(result.winner).toBe('tie')
  })
})
