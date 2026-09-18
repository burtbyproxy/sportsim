import { describe, it, expect } from 'vitest'
import { evaluateCondition, evaluateTrigger, evaluateUnlocks } from './unlocks.js'

function makeGameState(overrides = {}) {
  return {
    player: {
      stats: {
        charm: { base: 15, modifiers: [], xp: 0 },
        wits: { base: 8, modifiers: [], xp: 0 },
      },
      counters: { fights_won: 3 },
    },
    counters: {},
    firedEventIds: ['bar_fight_event'],
    locations: {
      mock_crest: { id: 'mock_crest', discovered: true },
      secret_spot: { id: 'secret_spot', discovered: false },
    },
    ...overrides,
  }
}

function makeMetaState(overrides = {}) {
  return {
    unlockedIds: [],
    completedRuns: [],
    globalCounters: {},
    ...overrides,
  }
}

// --- evaluateCondition ---

describe('evaluateCondition', () => {
  it('evaluates stat >= condition', () => {
    const gs = makeGameState()
    expect(evaluateCondition({ type: 'stat', key: 'charm', op: '>=', value: 10 }, gs)).toBe(true)
    expect(evaluateCondition({ type: 'stat', key: 'charm', op: '>=', value: 20 }, gs)).toBe(false)
  })

  it('evaluates stat <= condition', () => {
    const gs = makeGameState()
    expect(evaluateCondition({ type: 'stat', key: 'wits', op: '<=', value: 10 }, gs)).toBe(true)
    expect(evaluateCondition({ type: 'stat', key: 'wits', op: '<=', value: 5 }, gs)).toBe(false)
  })

  it('evaluates stat == condition', () => {
    const gs = makeGameState()
    expect(evaluateCondition({ type: 'stat', key: 'charm', op: '==', value: 15 }, gs)).toBe(true)
    expect(evaluateCondition({ type: 'stat', key: 'charm', op: '==', value: 16 }, gs)).toBe(false)
  })

  it('evaluates counter condition', () => {
    const gs = makeGameState()
    expect(evaluateCondition({ type: 'counter', key: 'fights_won', op: '>=', value: 3 }, gs)).toBe(
      true
    )
    expect(evaluateCondition({ type: 'counter', key: 'fights_won', op: '>=', value: 5 }, gs)).toBe(
      false
    )
  })

  it('evaluates event_completed condition', () => {
    const gs = makeGameState()
    expect(
      evaluateCondition(
        { type: 'event_completed', key: 'bar_fight_event', op: '==', value: true },
        gs
      )
    ).toBe(true)
    expect(
      evaluateCondition(
        { type: 'event_completed', key: 'missing_event', op: '==', value: true },
        gs
      )
    ).toBe(false)
  })

  it('evaluates location_discovered condition', () => {
    const gs = makeGameState()
    expect(
      evaluateCondition(
        { type: 'location_discovered', key: 'mock_crest', op: '==', value: true },
        gs
      )
    ).toBe(true)
    expect(
      evaluateCondition(
        { type: 'location_discovered', key: 'secret_spot', op: '==', value: true },
        gs
      )
    ).toBe(false)
  })

  it('evaluates death_by condition', () => {
    const gs = makeGameState()
    const meta = makeMetaState({
      completedRuns: [
        { endType: 'arrest', daysPlayed: 5, dominantArchetype: 'drunk', timestamp: 1 },
      ],
    })
    expect(
      evaluateCondition({ type: 'death_by', key: 'arrest', op: '==', value: true }, gs, meta)
    ).toBe(true)
    expect(
      evaluateCondition({ type: 'death_by', key: 'fame', op: '==', value: true }, gs, meta)
    ).toBe(false)
  })

  it('evaluates run_completed condition', () => {
    const gs = makeGameState()
    const meta = makeMetaState({
      completedRuns: [
        { endType: 'death', daysPlayed: 3 },
        { endType: 'arrest', daysPlayed: 7 },
      ],
    })
    expect(
      evaluateCondition({ type: 'run_completed', key: 'runs', op: '>=', value: 2 }, gs, meta)
    ).toBe(true)
    expect(
      evaluateCondition({ type: 'run_completed', key: 'runs', op: '>=', value: 5 }, gs, meta)
    ).toBe(false)
  })

  it('returns false for unknown condition type', () => {
    const gs = makeGameState()
    expect(evaluateCondition({ type: 'unknown_type', key: 'x', op: '>=', value: 0 }, gs)).toBe(
      false
    )
  })
})

// --- evaluateTrigger ---

describe('evaluateTrigger', () => {
  it('returns false for empty conditions', () => {
    expect(evaluateTrigger({ type: 'all', conditions: [] }, makeGameState())).toBe(false)
  })

  it('AND trigger: all conditions must pass', () => {
    const trigger = {
      type: 'all',
      conditions: [
        { type: 'stat', key: 'charm', op: '>=', value: 10 },
        { type: 'stat', key: 'wits', op: '>=', value: 5 },
      ],
    }
    expect(evaluateTrigger(trigger, makeGameState())).toBe(true)
  })

  it('AND trigger: fails if one condition fails', () => {
    const trigger = {
      type: 'all',
      conditions: [
        { type: 'stat', key: 'charm', op: '>=', value: 10 },
        { type: 'stat', key: 'wits', op: '>=', value: 100 }, // fails
      ],
    }
    expect(evaluateTrigger(trigger, makeGameState())).toBe(false)
  })

  it('OR trigger: passes if any condition passes', () => {
    const trigger = {
      type: 'any',
      conditions: [
        { type: 'stat', key: 'charm', op: '>=', value: 100 }, // fails
        { type: 'stat', key: 'charm', op: '>=', value: 10 }, // passes
      ],
    }
    expect(evaluateTrigger(trigger, makeGameState())).toBe(true)
  })

  it('OR trigger: fails if all conditions fail', () => {
    const trigger = {
      type: 'any',
      conditions: [
        { type: 'stat', key: 'charm', op: '>=', value: 100 },
        { type: 'stat', key: 'wits', op: '>=', value: 100 },
      ],
    }
    expect(evaluateTrigger(trigger, makeGameState())).toBe(false)
  })
})

// --- evaluateUnlocks ---

describe('evaluateUnlocks', () => {
  const unlockDefs = [
    {
      id: 'charmer_archetype',
      trigger: {
        type: 'all',
        conditions: [{ type: 'stat', key: 'charm', op: '>=', value: 10 }],
      },
    },
    {
      id: 'genius_archetype',
      trigger: {
        type: 'all',
        conditions: [{ type: 'stat', key: 'wits', op: '>=', value: 50 }],
      },
    },
  ]

  it('returns newly unlocked IDs', () => {
    const result = evaluateUnlocks(makeGameState(), makeMetaState(), unlockDefs)
    expect(result).toContain('charmer_archetype')
    expect(result).not.toContain('genius_archetype')
  })

  it('does not return already-unlocked IDs', () => {
    const meta = makeMetaState({ unlockedIds: ['charmer_archetype'] })
    const result = evaluateUnlocks(makeGameState(), meta, unlockDefs)
    expect(result).not.toContain('charmer_archetype')
  })

  it('returns empty array when nothing qualifies', () => {
    const meta = makeMetaState({ unlockedIds: ['charmer_archetype'] })
    const result = evaluateUnlocks(makeGameState(), meta, unlockDefs)
    expect(result).toHaveLength(0)
  })
})
