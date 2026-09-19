import { randomSeeded } from '../src/utils/random.js'
import { describe, it, expect, beforeEach } from 'vitest'
import {
  playerCreate,
  modifiersTick,
  modifierAdd,
  inventoryAdd,
  inventoryRemove,
  moneyAdjust,
  archetypeScoreAdd,
  counterAdd,
} from '../src/models/player.js'

// ---------------------------------------------------------------------------
// playerCreate
// ---------------------------------------------------------------------------

describe('playerCreate', () => {
  it('rolls the same stats from the same seed, and different ones from another', () => {
    const rolled = (seed) => playerCreate({ name: 'X', rng: randomSeeded({ seed }) }).stats
    expect(rolled(3)).toEqual(rolled(3))
    expect(rolled(3)).not.toEqual(rolled(4))
  })

  it('returns an object with the given name', () => {
    const p = playerCreate({ name: 'Dirtbag' })
    expect(p.name).toBe('Dirtbag')
  })

  it('assigns a unique id', () => {
    const a = playerCreate({ name: 'A' })
    const b = playerCreate({ name: 'B' })
    expect(a.id).toBeTruthy()
    expect(b.id).toBeTruthy()
    expect(a.id).not.toBe(b.id)
  })

  it('starts at moms_house', () => {
    const p = playerCreate({ name: 'X' })
    expect(p.currentLocationId).toBe('moms_house')
  })

  it('has all 8 stats within 10-20 range', () => {
    // Run multiple times to catch randomization edge cases
    for (let i = 0; i < 20; i++) {
      const p = playerCreate({ name: 'Test' })
      for (const statName of [
        'stamina',
        'toughness',
        'wits',
        'creativity',
        'charm',
        'reputation',
        'luck',
        'karma',
      ]) {
        expect(p.stats[statName].base).toBeGreaterThanOrEqual(10)
        expect(p.stats[statName].base).toBeLessThanOrEqual(20)
      }
    }
  })

  it('starts with default status values', () => {
    const p = playerCreate({ name: 'X' })
    expect(p.status.hunger).toBe(50)
    expect(p.status.sobriety).toBe(100) // derived: nothing in the bloodstream yet
    expect(p.status.energy).toBe(70)
    expect(p.status.mood).toBe(40)
    expect(p.status.health).toBe(100)
    expect(p.status.money).toBe(2)
  })

  it('starts with empty inventory', () => {
    const p = playerCreate({ name: 'X' })
    expect(p.inventory).toEqual([])
  })

  it('starts with a clean psyche', () => {
    const p = playerCreate({ name: 'X' })
    expect(p.psyche).toEqual({ marks: [], abilities: [], grooves: {} })
  })

  it('serializes cleanly to JSON', () => {
    const p = playerCreate({ name: 'X' })
    const serialized = JSON.parse(JSON.stringify(p))
    expect(serialized.name).toBe('X')
    expect(serialized.stats.stamina.base).toBeGreaterThanOrEqual(10)
  })
})

// ---------------------------------------------------------------------------
// modifiersTick
// ---------------------------------------------------------------------------

describe('modifiersTick', () => {
  let player

  beforeEach(() => {
    player = playerCreate({ name: 'Test' })
  })

  it('decrements duration by 1', () => {
    player.stats.stamina.modifiers.push({ source: 'test', value: 5, duration: 3 })
    modifiersTick({ player })
    expect(player.stats.stamina.modifiers[0].duration).toBe(2)
  })

  it('removes modifiers at duration 0 after decrement', () => {
    player.stats.stamina.modifiers.push({ source: 'test', value: 5, duration: 1 })
    modifiersTick({ player })
    expect(player.stats.stamina.modifiers).toHaveLength(0)
  })

  it('does not remove permanent modifiers (duration null)', () => {
    player.stats.stamina.modifiers.push({ source: 'perm', value: 5, duration: null })
    modifiersTick({ player })
    expect(player.stats.stamina.modifiers).toHaveLength(1)
    expect(player.stats.stamina.modifiers[0].duration).toBe(null)
  })

  it('handles multiple stats simultaneously', () => {
    player.stats.stamina.modifiers.push({ source: 'a', value: 1, duration: 1 })
    player.stats.wits.modifiers.push({ source: 'b', value: 2, duration: 2 })
    modifiersTick({ player })
    expect(player.stats.stamina.modifiers).toHaveLength(0)
    expect(player.stats.wits.modifiers[0].duration).toBe(1)
  })

  it('handles player with no modifiers', () => {
    expect(() => modifiersTick({ player })).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// modifierAdd
// ---------------------------------------------------------------------------

describe('modifierAdd', () => {
  let player

  beforeEach(() => {
    player = playerCreate({ name: 'Test' })
    player.stats.charm.modifiers = []
  })

  it('adds a modifier to the stat', () => {
    modifierAdd({ player, statName: 'charm', modifier: { source: 'beer', value: 3, duration: 4 } })
    expect(player.stats.charm.modifiers).toHaveLength(1)
    expect(player.stats.charm.modifiers[0].value).toBe(3)
  })

  it('does not mutate the original modifier object', () => {
    const mod = { source: 'beer', value: 3, duration: 4 }
    modifierAdd({ player, statName: 'charm', modifier: mod })
    player.stats.charm.modifiers[0].value = 99
    expect(mod.value).toBe(3)
  })

  it('is a no-op for unknown stat', () => {
    expect(() =>
      modifierAdd({
        player,
        statName: 'fakestat',
        modifier: { source: 'x', value: 1, duration: 1 },
      })
    ).not.toThrow()
  })

  it('allows permanent modifiers (duration null)', () => {
    modifierAdd({
      player,
      statName: 'charm',
      modifier: { source: 'perk', value: 10, duration: null },
    })
    expect(player.stats.charm.modifiers[0].duration).toBe(null)
  })
})

// ---------------------------------------------------------------------------
// inventoryAdd / inventoryRemove
// ---------------------------------------------------------------------------

describe('inventoryAdd', () => {
  let player

  beforeEach(() => {
    player = playerCreate({ name: 'Test' })
  })

  it('adds a non-stackable item to inventory', () => {
    inventoryAdd({ player, item: { id: 'knife', name: 'Knife', stackable: false, quantity: 1 } })
    expect(player.inventory).toHaveLength(1)
    expect(player.inventory[0].id).toBe('knife')
  })

  it('stacks stackable items with same id', () => {
    inventoryAdd({ player, item: { id: 'beer', name: 'Beer', stackable: true, quantity: 1 } })
    inventoryAdd({ player, item: { id: 'beer', name: 'Beer', stackable: true, quantity: 2 } })
    expect(player.inventory).toHaveLength(1)
    expect(player.inventory[0].quantity).toBe(3)
  })

  it('adds separate entries for non-stackable duplicates', () => {
    inventoryAdd({ player, item: { id: 'rock', name: 'Rock', stackable: false, quantity: 1 } })
    inventoryAdd({ player, item: { id: 'rock', name: 'Rock', stackable: false, quantity: 1 } })
    expect(player.inventory).toHaveLength(2)
  })

  it('does not mutate the source item', () => {
    const item = { id: 'beer', name: 'Beer', stackable: true, quantity: 1 }
    inventoryAdd({ player, item })
    player.inventory[0].quantity = 99
    expect(item.quantity).toBe(1)
  })
})

describe('inventoryRemove', () => {
  let player

  beforeEach(() => {
    player = playerCreate({ name: 'Test' })
  })

  it('removes a non-stackable item', () => {
    inventoryAdd({ player, item: { id: 'knife', name: 'Knife', stackable: false, quantity: 1 } })
    inventoryRemove({ player, itemId: 'knife' })
    expect(player.inventory).toHaveLength(0)
  })

  it('decrements quantity for stackable items', () => {
    inventoryAdd({ player, item: { id: 'beer', name: 'Beer', stackable: true, quantity: 3 } })
    inventoryRemove({ player, itemId: 'beer' })
    expect(player.inventory[0].quantity).toBe(2)
  })

  it('removes stackable item when quantity hits 0', () => {
    inventoryAdd({ player, item: { id: 'beer', name: 'Beer', stackable: true, quantity: 1 } })
    inventoryRemove({ player, itemId: 'beer' })
    expect(player.inventory).toHaveLength(0)
  })

  it('is a no-op when item not in inventory', () => {
    expect(() => inventoryRemove({ player, itemId: 'ghost_item' })).not.toThrow()
    expect(player.inventory).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// moneyAdjust
// ---------------------------------------------------------------------------

describe('moneyAdjust', () => {
  let player

  beforeEach(() => {
    player = playerCreate({ name: 'Test' })
    player.status.money = 0
  })

  it('adds money', () => {
    moneyAdjust({ player, delta: 50 })
    expect(player.status.money).toBe(50)
  })

  it('goes negative (debt)', () => {
    moneyAdjust({ player, delta: -100 })
    expect(player.status.money).toBe(-100)
  })

  it('accumulates correctly', () => {
    moneyAdjust({ player, delta: 25 })
    moneyAdjust({ player, delta: -10 })
    expect(player.status.money).toBe(15)
  })
})

// ---------------------------------------------------------------------------
// archetypeScoreAdd
// ---------------------------------------------------------------------------

describe('archetypeScoreAdd', () => {
  let player

  beforeEach(() => {
    player = playerCreate({ name: 'Test' })
  })

  it('creates and increments a new archetype', () => {
    archetypeScoreAdd({ player, archetypeId: 'burnout', delta: 5 })
    expect(player.archetypeScores.burnout).toBe(5)
  })

  it('accumulates on existing archetype', () => {
    archetypeScoreAdd({ player, archetypeId: 'burnout', delta: 5 })
    archetypeScoreAdd({ player, archetypeId: 'burnout', delta: 3 })
    expect(player.archetypeScores.burnout).toBe(8)
  })

  it('handles negative delta', () => {
    archetypeScoreAdd({ player, archetypeId: 'burnout', delta: 10 })
    archetypeScoreAdd({ player, archetypeId: 'burnout', delta: -4 })
    expect(player.archetypeScores.burnout).toBe(6)
  })
})

// ---------------------------------------------------------------------------
// counterAdd
// ---------------------------------------------------------------------------

describe('counterAdd', () => {
  let player

  beforeEach(() => {
    player = playerCreate({ name: 'Test' })
  })

  it('creates a counter starting at delta', () => {
    counterAdd({ player, counterName: 'fights_won', delta: 1 })
    expect(player.counters.fights_won).toBe(1)
  })

  it('defaults delta to 1', () => {
    counterAdd({ player, counterName: 'fights_won' })
    expect(player.counters.fights_won).toBe(1)
  })

  it('accumulates', () => {
    counterAdd({ player, counterName: 'fights_won', delta: 3 })
    counterAdd({ player, counterName: 'fights_won', delta: 2 })
    expect(player.counters.fights_won).toBe(5)
  })

  it('handles multiple different counters independently', () => {
    counterAdd({ player, counterName: 'a', delta: 1 })
    counterAdd({ player, counterName: 'b', delta: 5 })
    expect(player.counters.a).toBe(1)
    expect(player.counters.b).toBe(5)
  })
})
