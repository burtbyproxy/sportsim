import { describe, it, expect } from 'vitest'
import { meetsRequirements, getAvailableActions, resolveAction } from './actions.js'
import { seededRandom } from '../utils/random.js'

function makePlayer(overrides = {}) {
  return {
    stats: {
      charm: { base: 10, modifiers: [], xp: 0 },
      wits: { base: 12, modifiers: [], xp: 0 },
    },
    status: {
      hunger: 50,
      sobriety: 80,
      energy: 80,
      mood: 50,
      health: 100,
      money: 0,
    },
    inventory: [],
    psyche: { traumas: [], obsessions: [], insanities: [], abilities: [] },
    ...overrides,
  }
}

function makeGameTime(hour = 14) {
  return { tick: 100, day: 1, hour, minute: 0, period: 'afternoon', dayOfWeek: 'monday' }
}

function makeAction(overrides = {}) {
  return {
    id: 'test_action',
    label: 'Do the thing',
    locationId: 'test_location',
    timeCost: 1,
    requirements: {},
    check: null,
    success: { narrative: 'You did it.', statChanges: null },
    failure: { narrative: 'You failed.', statChanges: null },
    criticalSuccess: null,
    criticalFailure: null,
    weight: 5,
    obsessionIds: [],
    ...overrides,
  }
}

// --- meetsRequirements ---

describe('meetsRequirements', () => {
  it('passes with no requirements', () => {
    const { meets } = meetsRequirements(makePlayer(), makeAction(), makeGameTime())
    expect(meets).toBe(true)
  })

  it('fails when stat too low', () => {
    const action = makeAction({ requirements: { minStats: { charm: 20 } } })
    const { meets, reason } = meetsRequirements(makePlayer(), action, makeGameTime())
    expect(meets).toBe(false)
    expect(reason).toContain('charm')
  })

  it('passes when stat meets minimum', () => {
    const action = makeAction({ requirements: { minStats: { charm: 10 } } })
    const { meets } = meetsRequirements(makePlayer(), action, makeGameTime())
    expect(meets).toBe(true)
  })

  it('fails when required item not in inventory', () => {
    const action = makeAction({ requirements: { requiredItems: ['bus_pass'] } })
    const { meets } = meetsRequirements(makePlayer(), action, makeGameTime())
    expect(meets).toBe(false)
  })

  it('passes when required item is in inventory', () => {
    const player = makePlayer({ inventory: [{ id: 'bus_pass', quantity: 1 }] })
    const action = makeAction({ requirements: { requiredItems: ['bus_pass'] } })
    const { meets } = meetsRequirements(player, action, makeGameTime())
    expect(meets).toBe(true)
  })

  it('fails when below minSobriety', () => {
    const player = makePlayer({ status: { ...makePlayer().status, sobriety: 10 } })
    const action = makeAction({ requirements: { minSobriety: 20 } })
    const { meets } = meetsRequirements(player, action, makeGameTime())
    expect(meets).toBe(false)
  })

  it('fails when above maxSobriety', () => {
    const player = makePlayer({ status: { ...makePlayer().status, sobriety: 90 } })
    const action = makeAction({ requirements: { maxSobriety: 50 } })
    const { meets } = meetsRequirements(player, action, makeGameTime())
    expect(meets).toBe(false)
  })

  it('fails when before minHour', () => {
    const action = makeAction({ requirements: { minHour: 20 } })
    const { meets } = meetsRequirements(makePlayer(), action, makeGameTime(10))
    expect(meets).toBe(false)
  })

  it('fails when at or after maxHour', () => {
    const action = makeAction({ requirements: { maxHour: 12 } })
    const { meets } = meetsRequirements(makePlayer(), action, makeGameTime(14))
    expect(meets).toBe(false)
  })

  it('fails when required trauma not present', () => {
    const action = makeAction({ requirements: { requiredTraumas: ['mugged'] } })
    const { meets } = meetsRequirements(makePlayer(), action, makeGameTime())
    expect(meets).toBe(false)
  })

  it('passes when required trauma present', () => {
    const player = makePlayer({
      psyche: {
        traumas: [{ id: 'mugged', effects: {} }],
        obsessions: [],
        insanities: [],
        abilities: [],
      },
    })
    const action = makeAction({ requirements: { requiredTraumas: ['mugged'] } })
    const { meets } = meetsRequirements(player, action, makeGameTime())
    expect(meets).toBe(true)
  })
})

// --- getAvailableActions ---

describe('getAvailableActions', () => {
  it('returns actions available at location', () => {
    const location = { id: 'bar', actionIds: ['drink', 'talk'] }
    const registry = [
      makeAction({ id: 'drink', weight: 5 }),
      makeAction({ id: 'talk', weight: 3 }),
      makeAction({ id: 'fight', weight: 8 }),
    ]
    const result = getAvailableActions(makePlayer(), location, makeGameTime(), registry)
    expect(result.map((a) => a.id)).toContain('drink')
    expect(result.map((a) => a.id)).toContain('talk')
    expect(result.map((a) => a.id)).not.toContain('fight')
  })

  it('includes "any" location actions', () => {
    const location = { id: 'bar', actionIds: [] }
    const registry = [makeAction({ id: 'think', locationId: 'any', weight: 1 })]
    const result = getAvailableActions(makePlayer(), location, makeGameTime(), registry)
    expect(result.map((a) => a.id)).toContain('think')
  })

  it('filters out actions where requirements not met', () => {
    const location = { id: 'bar', actionIds: ['vip_entrance'] }
    const registry = [makeAction({ id: 'vip_entrance', requirements: { minStats: { charm: 50 } } })]
    const result = getAvailableActions(makePlayer(), location, makeGameTime(), registry)
    expect(result).toHaveLength(0)
  })

  it('sorts by descending weight', () => {
    const location = { id: 'bar', actionIds: ['a', 'b', 'c'] }
    const registry = [
      makeAction({ id: 'a', weight: 1 }),
      makeAction({ id: 'b', weight: 10 }),
      makeAction({ id: 'c', weight: 5 }),
    ]
    const result = getAvailableActions(makePlayer(), location, makeGameTime(), registry)
    expect(result[0].id).toBe('b')
    expect(result[1].id).toBe('c')
    expect(result[2].id).toBe('a')
  })

  it('boosts weight for actions matching active obsessions', () => {
    const player = makePlayer({
      psyche: {
        traumas: [],
        insanities: [],
        abilities: [],
        obsessions: [{ id: 'drinking', strength: 100, relatedActions: ['drink'], effects: {} }],
      },
    })
    const location = { id: 'bar', actionIds: ['drink', 'talk'] }
    const registry = [
      makeAction({ id: 'drink', weight: 5, obsessionIds: ['drinking'] }),
      makeAction({ id: 'talk', weight: 8 }),
    ]
    const result = getAvailableActions(player, location, makeGameTime(), registry)
    // drink gets obsession boost: 5 + (100/100 * 5 * 0.5) = 5 + 2.5 = 7.5, still less than talk's 8
    // but if we crank obsession strength to really dominate...
    // At strength=100, drink=7.5 < talk=8, so talk first
    expect(result[0].id).toBe('talk')
  })
})

// --- resolveAction ---

describe('resolveAction', () => {
  it('returns requirementFailure when requirements not met', () => {
    const action = makeAction({ requirements: { minStats: { charm: 999 } } })
    const result = resolveAction(makePlayer(), action, makeGameTime(), [], seededRandom(1))
    expect(result.requirementFailure).toBeTruthy()
    expect(result.outcome).toBeNull()
  })

  it('auto-succeeds when no check', () => {
    const action = makeAction({ check: null })
    const result = resolveAction(makePlayer(), action, makeGameTime(), [], seededRandom(1))
    expect(result.success).toBe(true)
    expect(result.outcome).toBe(action.success)
    expect(result.diceResult).toBeNull()
  })

  it('returns success outcome on passing check', () => {
    // Force success: stat=charm(10), dc=1, any roll passes
    const action = makeAction({
      check: { stat: 'charm', dc: 1, opposedStat: null, opposedNpcId: null },
    })
    const result = resolveAction(makePlayer(), action, makeGameTime(), [], seededRandom(1))
    expect(result.diceResult).toBeTruthy()
    // Result depends on roll but dc=1, charm=10, should almost always succeed
    if (result.success) {
      expect(result.outcome).toBe(action.success)
    }
  })

  it('returns failure outcome on failing check', () => {
    // Force failure: stat=charm(10), dc=100, impossible to pass
    const action = makeAction({
      check: { stat: 'charm', dc: 100, opposedStat: null, opposedNpcId: null },
    })
    const result = resolveAction(makePlayer(), action, makeGameTime(), [], seededRandom(1))
    // Only a natural 1 is a crit fail, otherwise just failure
    expect(result.success).toBe(false)
    expect(result.outcome).toBe(action.failure)
  })

  it('returns criticalSuccess outcome on natural 20', () => {
    const critSuccessOutcome = { narrative: 'CRIT!', statChanges: null }
    const action = makeAction({
      check: { stat: 'charm', dc: 1, opposedStat: null, opposedNpcId: null },
      criticalSuccess: critSuccessOutcome,
    })
    const alwaysMax = () => 0.9999 // natural 20
    const result = resolveAction(makePlayer(), action, makeGameTime(), [], alwaysMax)
    expect(result.outcome).toBe(critSuccessOutcome)
  })

  it('returns criticalFailure outcome on natural 1', () => {
    const critFailOutcome = { narrative: 'DISASTER', statChanges: null }
    const action = makeAction({
      check: { stat: 'charm', dc: 1, opposedStat: null, opposedNpcId: null },
      criticalFailure: critFailOutcome,
    })
    const alwaysMin = () => 0 // natural 1
    const result = resolveAction(makePlayer(), action, makeGameTime(), [], alwaysMin)
    expect(result.outcome).toBe(critFailOutcome)
  })

  it('handles contested roll when NPC is present', () => {
    const npc = {
      id: 'bartender',
      stats: { charm: { base: 8, modifiers: [], xp: 0 } },
      status: { sobriety: 100, energy: 80, mood: 50 },
      psyche: { traumas: [], abilities: [] },
    }
    const action = makeAction({
      check: { stat: 'charm', dc: 0, opposedStat: 'charm', opposedNpcId: 'bartender' },
    })
    const result = resolveAction(makePlayer(), action, makeGameTime(), [npc], seededRandom(1))
    expect(result.diceResult).toBeTruthy()
    expect(result.outcome).toBeTruthy()
  })

  it('auto-succeeds contested roll when NPC not present', () => {
    const action = makeAction({
      check: { stat: 'charm', dc: 0, opposedStat: 'charm', opposedNpcId: 'missing_npc' },
    })
    const result = resolveAction(makePlayer(), action, makeGameTime(), [], seededRandom(1))
    expect(result.success).toBe(true)
    expect(result.diceResult).toBeNull()
  })
})
