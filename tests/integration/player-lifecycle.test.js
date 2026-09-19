/**
 * Integration: Player lifecycle
 *
 * Tests the full pipeline:
 *   playerCreate() -> mutate via model functions -> serialize to JSON -> deserialize ->
 *   all model functions still work on the deserialized object.
 *
 * This validates the localStorage save/load contract.
 */

import { describe, it, expect } from 'vitest'
import {
  playerCreate,
  START_MONEY,
  modifierAdd,
  modifiersTick,
  inventoryAdd,
  inventoryRemove,
  moneyAdjust,
  obsessionFeed,
  archetypeScoreAdd,
  counterAdd,
} from '../../src/models/player.js'
import { statEffective } from '../../src/engine/dice.js'
import { inventoryHas } from '../../src/engine/items.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Round-trip a player through JSON serialization.
 * Simulates saving to and loading from localStorage.
 */
function saveAndLoad(player) {
  return JSON.parse(JSON.stringify(player))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('player lifecycle — create, mutate, serialize, restore', () => {
  it('player survives a full JSON round-trip', () => {
    const player = playerCreate({ name: 'Portland' })
    const loaded = saveAndLoad(player)

    expect(loaded.id).toBe(player.id)
    expect(loaded.name).toBe('Portland')
    expect(loaded.currentLocationId).toBe('moms_house')
  })

  it('stats survive round-trip with modifiers intact', () => {
    const player = playerCreate({ name: 'Test' })
    modifierAdd({ player, statName: 'charm', modifier: { source: 'beer', value: 5, duration: 3 } })

    const loaded = saveAndLoad(player)

    expect(loaded.stats.charm.modifiers).toHaveLength(1)
    expect(loaded.stats.charm.modifiers[0].value).toBe(5)
    expect(loaded.stats.charm.modifiers[0].duration).toBe(3)
  })

  it('the dice read a deserialized player the same way', () => {
    const player = playerCreate({ name: 'Test' })
    player.stats.wits.base = 15
    modifierAdd({ player, statName: 'wits', modifier: { source: 'test', value: -3, duration: 2 } })

    const loaded = saveAndLoad(player)
    expect(statEffective({ player: loaded, statName: 'wits' })).toBe(12)
  })

  it('modifiersTick works on deserialized player — expires correctly', () => {
    const player = playerCreate({ name: 'Test' })
    modifierAdd({ player, statName: 'luck', modifier: { source: 'coffee', value: 4, duration: 2 } })

    let loaded = saveAndLoad(player)
    modifiersTick({ player: loaded })
    expect(loaded.stats.luck.modifiers[0].duration).toBe(1)

    loaded = saveAndLoad(loaded)
    modifiersTick({ player: loaded })
    expect(loaded.stats.luck.modifiers).toHaveLength(0)
  })

  it('permanent modifiers survive round-trip and never expire', () => {
    const player = playerCreate({ name: 'Test' })
    modifierAdd({
      player,
      statName: 'karma',
      modifier: { source: 'scar', value: -2, duration: null },
    })

    const loaded = saveAndLoad(player)
    modifiersTick({ player: loaded })
    modifiersTick({ player: loaded })
    modifiersTick({ player: loaded })

    expect(loaded.stats.karma.modifiers).toHaveLength(1)
    expect(loaded.stats.karma.modifiers[0].duration).toBe(null)
  })

  it('inventory survives round-trip — inventoryHas and inventoryRemove work', () => {
    const player = playerCreate({ name: 'Test' })
    inventoryAdd({ player, item: { id: 'pabst', name: 'Pabst', stackable: true, quantity: 3 } })

    const loaded = saveAndLoad(player)
    expect(inventoryHas({ inventory: loaded.inventory, itemId: 'pabst' })).toBe(true)

    inventoryRemove({ player: loaded, itemId: 'pabst' })
    expect(loaded.inventory[0].quantity).toBe(2)
  })

  it('status adjustments survive round-trip', () => {
    const player = playerCreate({ name: 'Test' })
    player.status.hunger -= 20
    moneyAdjust({ player, delta: -50 })

    const loaded = saveAndLoad(player)
    expect(loaded.status.hunger).toBe(30)
    expect(loaded.status.money).toBe(START_MONEY - 50)
  })

  it('psyche state survives round-trip', () => {
    const player = playerCreate({ name: 'Test' })
    player.psyche.traumas.push({
      id: 'mugged',
      name: 'Mugged',
      description: 'X',
      source: 'Y',
      effects: {},
    })
    player.psyche.obsessions.push({
      id: 'booze',
      name: 'Booze',
      strength: 20,
      relatedActions: [],
      effects: {},
    })
    obsessionFeed({ player, obsessionId: 'booze', amount: 15 })

    const loaded = saveAndLoad(player)
    expect(loaded.psyche.traumas).toHaveLength(1)
    expect(loaded.psyche.traumas[0].id).toBe('mugged')
    expect(loaded.psyche.obsessions[0].strength).toBe(35)
  })

  it('archetype scores and counters survive round-trip', () => {
    const player = playerCreate({ name: 'Test' })
    archetypeScoreAdd({ player, archetypeId: 'burnout', delta: 10 })
    counterAdd({ player, counterName: 'drinks_consumed', delta: 5 })

    const loaded = saveAndLoad(player)
    expect(loaded.archetypeScores.burnout).toBe(10)
    expect(loaded.counters.drinks_consumed).toBe(5)

    // Can continue accumulating on the loaded player
    archetypeScoreAdd({ player: loaded, archetypeId: 'burnout', delta: 5 })
    counterAdd({ player: loaded, counterName: 'drinks_consumed', delta: 1 })
    expect(loaded.archetypeScores.burnout).toBe(15)
    expect(loaded.counters.drinks_consumed).toBe(6)
  })

  it('money can go deeply negative after round-trip (debt)', () => {
    const player = playerCreate({ name: 'Test' })
    moneyAdjust({ player, delta: -1000 })
    const loaded = saveAndLoad(player)

    expect(loaded.status.money).toBe(START_MONEY - 1000)
    moneyAdjust({ player: loaded, delta: -500 })
    expect(loaded.status.money).toBe(START_MONEY - 1500)
  })
})
