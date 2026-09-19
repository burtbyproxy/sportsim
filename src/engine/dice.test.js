import { describe, it, expect } from 'vitest'
import {
  diceD20,
  checkRoll,
  checkContestedRoll,
  CONTEST_WINNERS,
  diceCriticalSuccess,
  diceCriticalFailure,
  statEffective,
  statModifierItems,
  STAT_ITEM_SOURCES,
  checkModifier,
} from './dice.js'
import { randomSeeded } from '../utils/random.js'
import { blendSober } from './blend.js'
import { tuningContent } from '../../tests/helpers/content.js'

const tuning = tuningContent()

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
    intoxications: {},
    habituations: {},
    blend: blendSober(),
    ...overrides,
  }
}

/** A blend snapshot carrying only the given stat modifiers, attributed to one test persona. */
function withBlend({ player, modifiers }) {
  player.blend = {
    ...blendSober(),
    modifiers,
    modifierSources: Object.entries(modifiers).map(([stat, value]) => ({
      personaId: 'test_persona',
      source: 'substance',
      sourceId: 'test_substance',
      stat,
      value,
    })),
  }
  return player
}

// --- diceD20 ---

describe('diceD20', () => {
  it('always returns 1-20', () => {
    const rng = randomSeeded({ seed: 1 })
    for (let i = 0; i < 200; i++) {
      const v = diceD20({ rng })
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(20)
    }
  })

  it('is reproducible with seeded RNG', () => {
    const r1 = Array.from({ length: 10 }, () => diceD20({ rng: randomSeeded({ seed: 42 }) }))
    const r2 = Array.from({ length: 10 }, () => diceD20({ rng: randomSeeded({ seed: 42 }) }))
    expect(r1).toEqual(r2)
  })
})

// --- diceCriticalSuccess / diceCriticalFailure ---

describe('diceCriticalSuccess', () => {
  it('returns true only for 20', () => {
    expect(diceCriticalSuccess({ natural: 20 })).toBe(true)
    expect(diceCriticalSuccess({ natural: 19 })).toBe(false)
    expect(diceCriticalSuccess({ natural: 1 })).toBe(false)
  })
})

describe('diceCriticalFailure', () => {
  it('returns true only for 1', () => {
    expect(diceCriticalFailure({ natural: 1 })).toBe(true)
    expect(diceCriticalFailure({ natural: 2 })).toBe(false)
    expect(diceCriticalFailure({ natural: 20 })).toBe(false)
  })
})

// --- statEffective ---

describe('statEffective', () => {
  it('returns base stat value for sober, healthy player', () => {
    const player = makePlayer()
    expect(statEffective({ player: player, statName: 'charm' })).toBe(10)
  })

  it('includes active modifiers on the stat', () => {
    const player = makePlayer()
    player.stats.charm.modifiers = [{ source: 'test', value: 5, duration: null }]
    expect(statEffective({ player: player, statName: 'charm' })).toBe(15)
  })

  it('includes negative modifiers', () => {
    const player = makePlayer()
    player.stats.charm.modifiers = [{ source: 'test', value: -3, duration: null }]
    expect(statEffective({ player: player, statName: 'charm' })).toBe(7)
  })

  describe('blend modifiers', () => {
    it('applies a penalty carried by the blend snapshot', () => {
      const player = withBlend({ player: makePlayer(), modifiers: { wits: -5 } })
      expect(statEffective({ player, statName: 'wits' })).toBe(7)
    })

    it('applies a bonus carried by the blend snapshot', () => {
      const player = withBlend({ player: makePlayer(), modifiers: { charm: 3 } })
      expect(statEffective({ player, statName: 'charm' })).toBe(13)
    })

    it('leaves stats the blend does not name alone', () => {
      const player = withBlend({ player: makePlayer(), modifiers: { charm: 3 } })
      expect(statEffective({ player, statName: 'toughness' })).toBe(8)
    })

    it("stacks the blend with the stat's own modifiers", () => {
      const player = withBlend({ player: makePlayer(), modifiers: { wits: -5 } })
      player.stats.wits.modifiers = [{ source: 'test', value: -3, duration: null }]
      expect(statEffective({ player, statName: 'wits' })).toBe(4)
    })

    it('a player with no snapshot at all is sober', () => {
      const player = makePlayer()
      delete player.blend
      expect(statEffective({ player, statName: 'wits' })).toBe(12)
    })

    it('never reads status directly — the blend is the only door', () => {
      const player = makePlayer({ status: { ...makePlayer().status, sobriety: 5, energy: 5 } })
      expect(statEffective({ player, statName: 'wits' })).toBe(12)
    })
  })

  describe('statModifierItems', () => {
    it('itemizes base, each modifier, each persona, each ability, each trauma — no cap', () => {
      const player = withBlend({ player: makePlayer(), modifiers: { charm: 3 } })
      player.blend.modifierSources.push({
        personaId: 'hollow',
        source: 'condition',
        sourceId: 'starving',
        stat: 'charm',
        value: -1,
      })
      player.stats.charm.modifiers = [
        { source: 'clean_shirt', value: 2, duration: null },
        { source: 'black_eye', value: -4, duration: null },
      ]
      player.psyche.abilities = [
        { id: 'gift_of_gab', active: true, effects: { diceModifiers: { charm: 5 } } },
        { id: 'asleep', active: false, effects: { diceModifiers: { charm: 50 } } },
      ]
      player.psyche.traumas = [{ id: 'mugged_in_park', effects: { statModifiers: { charm: -2 } } }]

      const items = statModifierItems({ player, statName: 'charm' })
      expect(items).toEqual([
        { source: STAT_ITEM_SOURCES.base, sourceId: 'charm', value: 10 },
        { source: STAT_ITEM_SOURCES.modifier, sourceId: 'clean_shirt', value: 2 },
        { source: STAT_ITEM_SOURCES.modifier, sourceId: 'black_eye', value: -4 },
        { source: 'substance', sourceId: 'test_persona', value: 3 },
        { source: 'condition', sourceId: 'hollow', value: -1 },
        { source: STAT_ITEM_SOURCES.ability, sourceId: 'gift_of_gab', value: 5 },
        { source: STAT_ITEM_SOURCES.trauma, sourceId: 'mugged_in_park', value: -2 },
      ])
      expect(statEffective({ player, statName: 'charm' })).toBe(13)
    })

    it('an unknown stat has no items and an effective value of zero', () => {
      expect(statModifierItems({ player: makePlayer(), statName: 'swagger' })).toEqual([])
      expect(statEffective({ player: makePlayer(), statName: 'swagger' })).toBe(0)
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
    expect(statEffective({ player: player, statName: 'luck' })).toBe(10) // 5 base + 5 ability
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
    expect(statEffective({ player: player, statName: 'luck' })).toBe(5)
  })

  it('includes trauma stat modifiers', () => {
    const player = makePlayer()
    player.psyche.traumas = [
      {
        id: 'mugged_in_park',
        effects: { statModifiers: { charm: -2 } },
      },
    ]
    expect(statEffective({ player: player, statName: 'charm' })).toBe(8)
  })
})

// --- checkRoll ---

describe('checkRoll', () => {
  it('returns every modifier itemized, situational ones included', () => {
    const player = withBlend({ player: makePlayer(), modifiers: { charm: 3 } })
    const result = checkRoll({
      tuning,
      player,
      statName: 'charm',
      modifiers: [2, -1],
      dc: 10,
      rng: () => 0.5,
    })
    expect(result.modifierItems).toEqual([
      { source: STAT_ITEM_SOURCES.base, sourceId: 'charm', value: 10 },
      { source: 'substance', sourceId: 'test_persona', value: 3 },
      { source: 'situational', sourceId: null, value: 2 },
      { source: 'situational', sourceId: null, value: -1 },
    ])
    expect(result.modifier).toBe(1 + 2 - 1)
  })

  it('returns a DiceResult with all required fields', () => {
    const player = makePlayer()
    const result = checkRoll({
      tuning,
      player,
      statName: 'charm',
      modifiers: [],
      dc: 15,
      rng: randomSeeded({ seed: 1 }),
    })
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
    const result = checkRoll({
      tuning,
      player,
      statName: 'charm',
      modifiers: [],
      dc: 21,
      rng: alwaysMax,
    })
    // natural 20 + charm 10 → +1 = 21 >= dc 21
    expect(result.total).toBe(21)
    expect(result.success).toBe(true)
    expect(result.criticalSuccess).toBe(true)
  })

  it('failure is true when total < dc', () => {
    // Force a natural 1
    const alwaysMin = () => 0
    const player = makePlayer()
    const result = checkRoll({
      tuning,
      player,
      statName: 'charm',
      modifiers: [],
      dc: 30,
      rng: alwaysMin,
    })
    expect(result.success).toBe(false)
    expect(result.criticalFailure).toBe(true)
  })

  it('adds extra modifiers to the total', () => {
    const alwaysMin = () => 0 // natural = 1
    const player = makePlayer()
    const result = checkRoll({
      tuning,
      player,
      statName: 'charm',
      modifiers: [5, 5],
      dc: 1,
      rng: alwaysMin,
    })
    // natural 1 + charm 10 → +1, + extra 10 = 12
    expect(result.total).toBe(12)
    expect(result.success).toBe(true)
  })
})

// --- checkContestedRoll ---

describe('checkContestedRoll', () => {
  it('each side brings its own modifiers: the same roll, and the edge decides it', () => {
    const same = () => 0.5
    const result = checkContestedRoll({
      tuning,
      first: { player: makePlayer(), statName: 'charm' },
      second: { player: makePlayer(), statName: 'charm', modifiers: [3] },
      rng: same,
    })
    expect(result.winner).toBe(CONTEST_WINNERS.second)
    expect(result.second.total - result.first.total).toBe(3)
  })

  it('returns the winner and both rolls', () => {
    const player1 = makePlayer()
    const player2 = makePlayer()
    const result = checkContestedRoll({
      tuning,
      first: { player: player1, statName: 'charm' },
      second: { player: player2, statName: 'charm' },
      rng: randomSeeded({ seed: 1 }),
    })
    expect(result).toHaveProperty('winner')
    expect(result).toHaveProperty('first')
    expect(result).toHaveProperty('second')
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
    const result = checkContestedRoll({
      tuning,
      first: { player: player1, statName: 'charm' },
      second: { player: player2, statName: 'charm' },
      rng: rng,
    })
    expect(result.winner).toBe(CONTEST_WINNERS.first)
  })

  it('winner 2 when player2 rolls higher', () => {
    let callCount = 0
    const rng = () => {
      callCount++
      return callCount === 1 ? 0 : 0.9999
    }
    const player1 = makePlayer()
    const player2 = makePlayer()
    const result = checkContestedRoll({
      tuning,
      first: { player: player1, statName: 'charm' },
      second: { player: player2, statName: 'charm' },
      rng: rng,
    })
    expect(result.winner).toBe(CONTEST_WINNERS.second)
  })

  it('tie when totals are equal', () => {
    const alwaysSame = () => 0.5 // same roll, same stat base
    const player1 = makePlayer()
    const player2 = makePlayer()
    const result = checkContestedRoll({
      tuning,
      first: { player: player1, statName: 'charm' },
      second: { player: player2, statName: 'charm' },
      rng: alwaysSame,
    })
    expect(result.winner).toBe(CONTEST_WINNERS.tie)
  })
})

// --- checkModifier ---

describe('checkModifier', () => {
  const withCharm = (base) => makePlayer({ stats: { charm: { base, modifiers: [], xp: 0 } } })

  it('gives one point per ten points of stat', () => {
    expect(checkModifier({ tuning, player: withCharm(10), statName: 'charm' })).toBe(1)
    expect(checkModifier({ tuning, player: withCharm(19), statName: 'charm' })).toBe(1)
    expect(checkModifier({ tuning, player: withCharm(20), statName: 'charm' })).toBe(2)
    expect(checkModifier({ tuning, player: withCharm(50), statName: 'charm' })).toBe(5)
    expect(checkModifier({ tuning, player: withCharm(85), statName: 'charm' })).toBe(8)
    expect(checkModifier({ tuning, player: withCharm(100), statName: 'charm' })).toBe(10)
  })

  it('never drops below zero when penalties drag the stat under ten', () => {
    const player = withCharm(5)
    player.stats.charm.modifiers = [{ source: 'test', value: -20, duration: null }]
    expect(checkModifier({ tuning, player, statName: 'charm' })).toBe(0)
  })

  it('caps at ten', () => {
    const player = withCharm(100)
    player.stats.charm.modifiers = [{ source: 'test', value: 50, duration: null }]
    expect(checkModifier({ tuning, player, statName: 'charm' })).toBe(10)
  })

  it('the blend shifts the stat before conversion', () => {
    const player = withCharm(38)
    expect(checkModifier({ tuning, player, statName: 'charm' })).toBe(3)
    withBlend({ player, modifiers: { charm: 3 } }) // 41 → +4
    expect(checkModifier({ tuning, player, statName: 'charm' })).toBe(4)
  })

  it('a starting player passes an easy check more often than not', () => {
    const player = withCharm(15) // +1
    let passes = 0
    for (let n = 1; n <= 20; n++) {
      if (
        checkRoll({
          tuning,
          player,
          statName: 'charm',
          modifiers: [],
          dc: 10,
          rng: () => (n - 1) / 20,
        }).success
      )
        passes++
    }
    expect(passes).toBe(12) // 9..20 on the die
  })
})
