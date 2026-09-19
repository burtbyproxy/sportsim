import { describe, it, expect } from 'vitest'
import { itemUseResolve, ITEM_ERROR_CODES, ITEM_EFFECT_STATUSES, inventoryHas } from './items.js'

const tallboy = {
  id: 'tallboy_oly',
  name: 'Tallboy (Olympia)',
  type: 'consumable',
  stackable: true,
  quantity: 2,
  effects: [{ target: 'mood', value: 8, duration: null }],
  doses: [{ substanceId: 'beer', value: 20 }],
}

function makePlayer(inventory) {
  return {
    stats: { wits: { base: 10, modifiers: [], xp: 0 } },
    status: { hunger: 50, energy: 50, mood: 50, health: 100 },
    inventory,
  }
}

describe('itemUseResolve', () => {
  it('rejects a missing player', () => {
    expect(itemUseResolve({ player: null, itemId: 'x' }).error.code).toBe(
      ITEM_ERROR_CODES.playerMissing
    )
  })

  it('rejects an item the player is not carrying', () => {
    const result = itemUseResolve({ player: makePlayer([]), itemId: 'tallboy_oly' })
    expect(result.error.code).toBe(ITEM_ERROR_CODES.itemMissing)
  })

  it('rejects an item with none left', () => {
    const player = makePlayer([{ ...tallboy, quantity: 0 }])
    expect(itemUseResolve({ player, itemId: 'tallboy_oly' }).error.code).toBe(
      ITEM_ERROR_CODES.itemMissing
    )
  })

  it('rejects something that is not used up: you cannot drink a sock', () => {
    const player = makePlayer([{ id: 'single_sock', name: 'A Sock', type: 'junk', quantity: 1 }])
    expect(itemUseResolve({ player, itemId: 'single_sock' }).error.code).toBe(
      ITEM_ERROR_CODES.itemNotConsumable
    )
  })

  it('status effects become status changes and doses pass through', () => {
    const { data } = itemUseResolve({ player: makePlayer([tallboy]), itemId: 'tallboy_oly' })
    expect(data.statusChanges).toEqual({ mood: 8 })
    expect(data.doses).toEqual([{ substanceId: 'beer', value: 20 }])
    expect(data.statModifiers).toEqual([])
    expect(data.item.id).toBe('tallboy_oly')
  })

  it('two effects on the same status add up', () => {
    const snack = {
      id: 'snack',
      name: 'Snack',
      type: 'consumable',
      quantity: 1,
      effects: [
        { target: 'hunger', value: 10, duration: null },
        { target: 'hunger', value: 5, duration: null },
        { target: 'health', value: -2, duration: null },
      ],
    }
    const { data } = itemUseResolve({ player: makePlayer([snack]), itemId: 'snack' })
    expect(data.statusChanges).toEqual({ hunger: 15, health: -2 })
  })

  it('an effect that names a stat becomes a timed modifier from the item', () => {
    const tonic = {
      id: 'tonic',
      name: 'Tonic',
      type: 'consumable',
      quantity: 1,
      effects: [{ target: 'wits', value: 3, duration: 8 }],
    }
    const { data } = itemUseResolve({ player: makePlayer([tonic]), itemId: 'tonic' })
    expect(data.statusChanges).toEqual({})
    expect(data.statModifiers).toEqual([
      { statName: 'wits', modifier: { source: 'tonic', value: 3, duration: 8 } },
    ])
  })

  it('an effect on something that is neither a status nor a stat is refused', () => {
    const cursed = {
      id: 'cursed',
      name: 'Cursed',
      type: 'consumable',
      quantity: 1,
      effects: [{ target: 'sobriety', value: -20, duration: null }],
    }
    expect(itemUseResolve({ player: makePlayer([cursed]), itemId: 'cursed' }).error.code).toBe(
      ITEM_ERROR_CODES.effectTargetUnknown
    )
  })

  it('sobriety is not an effect status: it is derived from doses', () => {
    expect(ITEM_EFFECT_STATUSES).not.toContain('sobriety')
  })

  it('does not mutate the player or the carried item', () => {
    const player = makePlayer([tallboy])
    const before = JSON.stringify(player)
    const { data } = itemUseResolve({ player, itemId: 'tallboy_oly' })
    data.doses[0].value = 999
    data.item.quantity = 0
    expect(JSON.stringify(player)).toBe(before)
  })
})

describe('inventoryHas', () => {
  it('holds an item it carries', () => {
    expect(inventoryHas({ inventory: [{ id: 'knife', quantity: 1 }], itemId: 'knife' })).toBe(true)
  })

  it('does not hold an item it lacks', () => {
    expect(inventoryHas({ inventory: [{ id: 'fork', quantity: 1 }], itemId: 'knife' })).toBe(false)
  })

  it('an emptied stack is not holding anything', () => {
    expect(inventoryHas({ inventory: [{ id: 'pabst', quantity: 0 }], itemId: 'pabst' })).toBe(false)
  })

  it('no inventory holds nothing', () => {
    expect(inventoryHas({ inventory: undefined, itemId: 'knife' })).toBe(false)
  })
})
