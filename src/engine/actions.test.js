import { describe, it, expect } from 'vitest'
import { requirementsMeet, actionsAvailable, actionResolve, actionApplies } from './actions.js'
import { randomSeeded } from '../utils/random.js'

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

// --- requirementsMeet ---

describe('requirementsMeet', () => {
  it('passes with no requirements', () => {
    const { meets } = requirementsMeet({
      player: makePlayer(),
      action: makeAction(),
      gameTime: makeGameTime(),
    })
    expect(meets).toBe(true)
  })

  it('fails when stat too low', () => {
    const action = makeAction({ requirements: { minStats: { charm: 20 } } })
    const { meets, reasonCode, reasonParams } = requirementsMeet({
      player: makePlayer(),
      action,
      gameTime: makeGameTime(),
    })
    expect(meets).toBe(false)
    // A code and what it is about. The sentence is content's, not the engine's.
    expect(reasonCode).toBe('requirement.stat')
    expect(reasonParams).toEqual({ stat: 'charm' })
  })

  it('passes when stat meets minimum', () => {
    const action = makeAction({ requirements: { minStats: { charm: 10 } } })
    const { meets } = requirementsMeet({ player: makePlayer(), action, gameTime: makeGameTime() })
    expect(meets).toBe(true)
  })

  it('fails when required item not in inventory', () => {
    const action = makeAction({ requirements: { requiredItems: ['bus_pass'] } })
    const { meets } = requirementsMeet({ player: makePlayer(), action, gameTime: makeGameTime() })
    expect(meets).toBe(false)
  })

  it('passes when required item is in inventory', () => {
    const player = makePlayer({ inventory: [{ id: 'bus_pass', quantity: 1 }] })
    const action = makeAction({ requirements: { requiredItems: ['bus_pass'] } })
    const { meets } = requirementsMeet({ player, action, gameTime: makeGameTime() })
    expect(meets).toBe(true)
  })

  it('fails when below minSobriety', () => {
    const player = makePlayer({ status: { ...makePlayer().status, sobriety: 10 } })
    const action = makeAction({ requirements: { minSobriety: 20 } })
    const { meets } = requirementsMeet({ player, action, gameTime: makeGameTime() })
    expect(meets).toBe(false)
  })

  it('fails when above maxSobriety', () => {
    const player = makePlayer({ status: { ...makePlayer().status, sobriety: 90 } })
    const action = makeAction({ requirements: { maxSobriety: 50 } })
    const { meets } = requirementsMeet({ player, action, gameTime: makeGameTime() })
    expect(meets).toBe(false)
  })

  it('fails when before minHour', () => {
    const action = makeAction({ requirements: { minHour: 20 } })
    const { meets } = requirementsMeet({ player: makePlayer(), action, gameTime: makeGameTime(10) })
    expect(meets).toBe(false)
  })

  it('fails when at or after maxHour', () => {
    const action = makeAction({ requirements: { maxHour: 12 } })
    const { meets } = requirementsMeet({ player: makePlayer(), action, gameTime: makeGameTime(14) })
    expect(meets).toBe(false)
  })

  it('fails when required trauma not present', () => {
    const action = makeAction({ requirements: { requiredTraumas: ['mugged'] } })
    const { meets } = requirementsMeet({ player: makePlayer(), action, gameTime: makeGameTime() })
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
    const { meets } = requirementsMeet({ player, action, gameTime: makeGameTime() })
    expect(meets).toBe(true)
  })
})

// --- actionsAvailable ---

describe('requirementsMeet — minVisits', () => {
  const action = makeAction({ requirements: { minVisits: 2 } })
  const gameTime = makeGameTime()

  it('refuses with the visits code until the player has been here often enough', () => {
    const result = requirementsMeet({
      player: makePlayer(),
      action,
      gameTime,
      location: { visitCount: 1 },
    })
    expect(result).toEqual({ meets: false, reasonCode: 'requirement.visits', reasonParams: {} })
  })

  it('meets once the location has been visited enough', () => {
    expect(
      requirementsMeet({ player: makePlayer(), action, gameTime, location: { visitCount: 2 } })
        .meets
    ).toBe(true)
  })

  it('counts no visits when no location is given', () => {
    expect(requirementsMeet({ player: makePlayer(), action, gameTime }).meets).toBe(false)
  })

  it('reads the count from the location, not from the player', () => {
    const player = makePlayer(Object.fromEntries([['_locationData', { visitCount: 9 }]]))
    expect(requirementsMeet({ player, action, gameTime, location: { visitCount: 0 } }).meets).toBe(
      false
    )
  })

  it('actionsAvailable and actionResolve both pass the location through', () => {
    const location = { id: 'test_location', visitCount: 2 }
    const player = makePlayer()
    expect(
      actionsAvailable({ player, location, characters: [], gameTime, actionRegistry: [action] })
    ).toHaveLength(1)
    expect(actionResolve({ player, action, gameTime, location }).requirementFailure).toBeNull()
  })
})

describe('actionsAvailable', () => {
  it('returns actions available at location', () => {
    const location = { id: 'bar' }
    const registry = [
      makeAction({ id: 'drink', locationId: 'bar', weight: 5 }),
      makeAction({ id: 'talk', locationId: 'bar', weight: 3 }),
      makeAction({ id: 'fight', locationId: 'alley', weight: 8 }),
    ]
    const result = actionsAvailable({
      player: makePlayer(),
      location,
      characters: [],
      gameTime: makeGameTime(),
      actionRegistry: registry,
    })
    expect(result.map((a) => a.id)).toContain('drink')
    expect(result.map((a) => a.id)).toContain('talk')
    expect(result.map((a) => a.id)).not.toContain('fight')
  })

  it('includes "any" location actions', () => {
    const location = { id: 'bar' }
    const registry = [makeAction({ id: 'think', locationId: 'any', weight: 1 })]
    const result = actionsAvailable({
      player: makePlayer(),
      location,
      characters: [],
      gameTime: makeGameTime(),
      actionRegistry: registry,
    })
    expect(result.map((a) => a.id)).toContain('think')
  })

  it('filters out actions where requirements not met', () => {
    const location = { id: 'bar' }
    const registry = [
      makeAction({
        id: 'vip_entrance',
        locationId: 'bar',
        requirements: { minStats: { charm: 50 } },
      }),
    ]
    const result = actionsAvailable({
      player: makePlayer(),
      location,
      characters: [],
      gameTime: makeGameTime(),
      actionRegistry: registry,
    })
    expect(result).toHaveLength(0)
  })

  it('sorts by descending weight', () => {
    const location = { id: 'bar' }
    const registry = [
      makeAction({ id: 'a', locationId: 'bar', weight: 1 }),
      makeAction({ id: 'b', locationId: 'bar', weight: 10 }),
      makeAction({ id: 'c', locationId: 'bar', weight: 5 }),
    ]
    const result = actionsAvailable({
      player: makePlayer(),
      location,
      characters: [],
      gameTime: makeGameTime(),
      actionRegistry: registry,
    })
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
    const location = { id: 'bar' }
    const registry = [
      makeAction({ id: 'drink', locationId: 'bar', weight: 5, obsessionIds: ['drinking'] }),
      makeAction({ id: 'talk', locationId: 'bar', weight: 8 }),
    ]
    const result = actionsAvailable({
      player,
      location,
      characters: [],
      gameTime: makeGameTime(),
      actionRegistry: registry,
    })
    // drink gets obsession boost: 5 + (100/100 * 5 * 0.5) = 5 + 2.5 = 7.5, still less than talk's 8
    // but if we crank obsession strength to really dominate...
    // At strength=100, drink=7.5 < talk=8, so talk first
    expect(result[0].id).toBe('talk')
  })
})

// --- actionResolve ---

describe('actionResolve', () => {
  it('returns requirementFailure when requirements not met', () => {
    const action = makeAction({ requirements: { minStats: { charm: 999 } } })
    const result = actionResolve({
      player: makePlayer(),
      action,
      gameTime: makeGameTime(),
      characters: [],
      rng: randomSeeded({ seed: 1 }),
    })
    expect(result.requirementFailure).toBeTruthy()
    expect(result.outcome).toBeNull()
  })

  it('auto-succeeds when no check', () => {
    const action = makeAction({ check: null })
    const result = actionResolve({
      player: makePlayer(),
      action,
      gameTime: makeGameTime(),
      characters: [],
      rng: randomSeeded({ seed: 1 }),
    })
    expect(result.success).toBe(true)
    expect(result.outcome).toBe(action.success)
    expect(result.diceResult).toBeNull()
  })

  it('returns success outcome on passing check', () => {
    // Force success: stat=charm(10), dc=1, any roll passes
    const action = makeAction({
      check: { stat: 'charm', dc: 1, opposedStat: null, opposedNpcId: null },
    })
    const result = actionResolve({
      player: makePlayer(),
      action,
      gameTime: makeGameTime(),
      characters: [],
      rng: randomSeeded({ seed: 1 }),
    })
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
    const result = actionResolve({
      player: makePlayer(),
      action,
      gameTime: makeGameTime(),
      characters: [],
      rng: randomSeeded({ seed: 1 }),
    })
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
    const result = actionResolve({
      player: makePlayer(),
      action,
      gameTime: makeGameTime(),
      characters: [],
      rng: alwaysMax,
    })
    expect(result.outcome).toBe(critSuccessOutcome)
  })

  it('returns criticalFailure outcome on natural 1', () => {
    const critFailOutcome = { narrative: 'DISASTER', statChanges: null }
    const action = makeAction({
      check: { stat: 'charm', dc: 1, opposedStat: null, opposedNpcId: null },
      criticalFailure: critFailOutcome,
    })
    const alwaysMin = () => 0 // natural 1
    const result = actionResolve({
      player: makePlayer(),
      action,
      gameTime: makeGameTime(),
      characters: [],
      rng: alwaysMin,
    })
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
    const result = actionResolve({
      player: makePlayer(),
      action,
      gameTime: makeGameTime(),
      characters: [npc],
      rng: randomSeeded({ seed: 1 }),
    })
    expect(result.diceResult).toBeTruthy()
    expect(result.outcome).toBeTruthy()
  })

  it('auto-succeeds contested roll when NPC not present', () => {
    const action = makeAction({
      check: { stat: 'charm', dc: 0, opposedStat: 'charm', opposedNpcId: 'missing_npc' },
    })
    const result = actionResolve({
      player: makePlayer(),
      action,
      gameTime: makeGameTime(),
      characters: [],
      rng: randomSeeded({ seed: 1 }),
    })
    expect(result.success).toBe(true)
    expect(result.diceResult).toBeNull()
  })
})

describe('requirementsMeet — money floor', () => {
  const gameTime = { hour: 14 }
  const action = (minMoney) => ({ requirements: { minMoney } })
  const playerWith = (money) => ({ status: { money, sobriety: 100 }, stats: {}, inventory: [] })

  it('a player with at least the floor passes', () => {
    expect(requirementsMeet({ player: playerWith(3), action: action(3), gameTime }).meets).toBe(
      true
    )
    expect(requirementsMeet({ player: playerWith(10), action: action(3), gameTime }).meets).toBe(
      true
    )
  })

  it('a broke player is refused and told the price', () => {
    const result = requirementsMeet({ player: playerWith(1.5), action: action(3), gameTime })
    expect(result.meets).toBe(false)
    expect(result.reasonCode).toBe('requirement.money')
    expect(result.reasonParams).toEqual({ cost: '$3.00', money: '$1.50' })
  })

  it('a null floor costs nothing', () => {
    expect(requirementsMeet({ player: playerWith(0), action: action(null), gameTime }).meets).toBe(
      true
    )
  })
})

// --- requiresInspiration ---

describe('requirementsMeet — requiresInspiration', () => {
  const action = { id: 'make_something', requirements: { requiresInspiration: true } }
  const time = { hour: 14 }
  const record = (status) => ({
    id: 'i1',
    status,
    personaSnapshot: {},
    endedBy: null,
  })

  it('refuses a player nothing is moving', () => {
    const result = requirementsMeet({
      player: { status: {}, inspirations: [] },
      action,
      gameTime: time,
    })
    expect(result).toEqual({
      meets: false,
      reasonCode: 'requirement.inspiration',
      reasonParams: {},
    })
  })

  it('refuses a player whose inspiration already ended', () => {
    const player = { status: {}, inspirations: [record('expired'), record('interrupted')] }
    expect(requirementsMeet({ player, action, gameTime: time }).meets).toBe(false)
  })

  it('allows an inspired player', () => {
    const player = { status: {}, inspirations: [record('expired'), record('active')] }
    expect(requirementsMeet({ player, action, gameTime: time }).meets).toBe(true)
  })

  it('ignores the field when it is null or false', () => {
    for (const requiresInspiration of [null, false, undefined]) {
      const cold = { id: 'x', requirements: { requiresInspiration } }
      expect(
        requirementsMeet({ player: { status: {}, inspirations: [] }, action: cold, gameTime: time })
          .meets
      ).toBe(true)
    }
  })
})

// --- actionApplies ---

describe('actionApplies', () => {
  const place = { id: 'bar', scavengeTableId: 'bar_back' }
  const applies = ({ action, location = place, characters = [] }) =>
    actionApplies({ action, location, characters })

  it('an action that lives here applies', () => {
    expect(applies({ action: { id: 'order_beer', locationId: 'bar' } })).toBe(true)
  })

  it('an action that lives somewhere else does not', () => {
    expect(applies({ action: { id: 'pray', locationId: 'church' } })).toBe(false)
  })

  it('an "any" action applies everywhere', () => {
    expect(applies({ action: { id: 'loiter', locationId: 'any' } })).toBe(true)
  })

  it('looking around applies only where there is a table to draw from', () => {
    const scavenge = { id: 'scavenge', locationId: 'any', kind: 'scavenge' }
    expect(applies({ action: scavenge })).toBe(true)
    expect(applies({ action: scavenge, location: { ...place, scavengeTableId: null } })).toBe(false)
  })

  it('an action with someone applies only while they are here', () => {
    const talk = { id: 'talk_to_dale', locationId: 'bar', characterId: 'dale' }
    expect(applies({ action: talk, characters: [{ id: 'dale' }] })).toBe(true)
    expect(applies({ action: talk, characters: [{ id: 'tina' }] })).toBe(false)
    expect(applies({ action: talk })).toBe(false)
  })

  it('an "any" action with someone follows them, and only them', () => {
    const talk = { id: 'talk_to_maurice', locationId: 'any', characterId: 'maurice' }
    expect(applies({ action: talk, characters: [{ id: 'maurice' }] })).toBe(true)
    expect(applies({ action: talk })).toBe(false)
  })
})

// --- obsessions reorder the menu ---

describe('actionsAvailable — obsessions', () => {
  const location = { id: 'bar' }
  const registry = [
    { id: 'sensible', locationId: 'bar', weight: 50, obsessionIds: [] },
    { id: 'compulsion', locationId: 'bar', weight: 40, obsessionIds: ['booze'] },
  ]
  const time = { hour: 14 }
  const order = (player) =>
    actionsAvailable({
      player,
      location,
      characters: [],
      gameTime: time,
      actionRegistry: registry,
    }).map((a) => a.id)

  it('without the obsession the heavier action leads', () => {
    expect(order({ status: {}, psyche: { obsessions: [] } })).toEqual(['sensible', 'compulsion'])
  })

  it('a full-strength obsession adds half again to its action and takes the lead', () => {
    const player = { status: {}, psyche: { obsessions: [{ id: 'booze', strength: 100 }] } }
    expect(order(player)).toEqual(['compulsion', 'sensible'])
  })

  it('a weak obsession is not enough', () => {
    const player = { status: {}, psyche: { obsessions: [{ id: 'booze', strength: 20 }] } }
    expect(order(player)).toEqual(['sensible', 'compulsion'])
  })
})
