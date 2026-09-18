import { describe, it, expect } from 'vitest'
import { createItem, applyEffects } from '../src/models/item.js'

// ---------------------------------------------------------------------------
// createItem
// ---------------------------------------------------------------------------

describe('createItem', () => {
  const raw = {
    id: 'pabst',
    name: 'Pabst Blue Ribbon',
    description: 'A can of PBR. Cold. Technically.',
    type: 'consumable',
    value: 1,
    stackable: true,
    quantity: 6,
    effects: [{ target: 'mood', value: 5, duration: null }],
    doses: [{ substanceId: 'beer', value: 10 }],
  }

  it('maps all fields correctly', () => {
    const item = createItem(raw)
    expect(item.id).toBe('pabst')
    expect(item.name).toBe('Pabst Blue Ribbon')
    expect(item.description).toBe('A can of PBR. Cold. Technically.')
    expect(item.type).toBe('consumable')
    expect(item.value).toBe(1)
    expect(item.stackable).toBe(true)
    expect(item.quantity).toBe(6)
    expect(item.effects).toHaveLength(1)
    expect(item.doses).toEqual([{ substanceId: 'beer', value: 10 }])
  })

  it('defaults doses to an empty array', () => {
    const item = createItem({ id: 'rock', name: 'Rock' })
    expect(item.doses).toEqual([])
  })

  it('carries the mediums a tool or surface works in, and how it reads when found', () => {
    const sharpie = createItem({
      id: 'sharpie',
      name: 'Sharpie',
      type: 'tool',
      mediumIds: ['tagging', 'drawing'],
      foundAs: 'a Sharpie with some life left in it',
    })
    expect(sharpie.mediumIds).toEqual(['tagging', 'drawing'])
    expect(sharpie.foundAs).toBe('a Sharpie with some life left in it')
  })

  it('defaults mediumIds to empty and foundAs to null, and copies the array', () => {
    const rock = createItem({ id: 'rock', name: 'Rock' })
    expect(rock.mediumIds).toEqual([])
    expect(rock.foundAs).toBeNull()
    const source = { id: 'x', name: 'X', mediumIds: ['painting'] }
    const item = createItem(source)
    item.mediumIds.push('carving')
    expect(source.mediumIds).toEqual(['painting'])
  })

  it('does not share the doses array reference with source', () => {
    const item = createItem(raw)
    item.doses[0].value = 99
    expect(raw.doses[0].value).toBe(10)
  })

  it('applies defaults for missing optional fields', () => {
    const item = createItem({ id: 'rock', name: 'Rock' })
    expect(item.description).toBe('')
    expect(item.type).toBe('junk')
    expect(item.value).toBe(0)
    expect(item.stackable).toBe(false)
    expect(item.quantity).toBe(1)
    expect(item.effects).toEqual([])
  })

  it('does not share effects array reference with source', () => {
    const item = createItem(raw)
    item.effects[0].value = 99
    expect(raw.effects[0].value).toBe(5)
  })

  it('serializes cleanly to JSON', () => {
    const item = createItem(raw)
    const serialized = JSON.parse(JSON.stringify(item))
    expect(serialized.name).toBe('Pabst Blue Ribbon')
    expect(serialized.effects).toHaveLength(1)
    expect(serialized.doses).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// applyEffects
// ---------------------------------------------------------------------------

describe('applyEffects', () => {
  const item = createItem({
    id: 'pabst',
    name: 'Pabst Blue Ribbon',
    type: 'consumable',
    stackable: true,
    quantity: 1,
    effects: [{ target: 'mood', value: 5, duration: null }],
    doses: [{ substanceId: 'beer', value: 10 }],
  })

  it('returns a copy of all effects', () => {
    const effects = applyEffects(item)
    expect(effects).toHaveLength(1)
    expect(effects[0].target).toBe('mood')
    expect(effects[0].value).toBe(5)
  })

  it('does not mutate the item', () => {
    const effects = applyEffects(item)
    effects[0].value = 999
    expect(item.effects[0].value).toBe(5)
  })

  it('returns empty array for item with no effects', () => {
    const noEffect = createItem({ id: 'rock', name: 'Rock' })
    expect(applyEffects(noEffect)).toEqual([])
  })

  it('does not mutate the player argument', () => {
    const player = { status: { sobriety: 80 } }
    applyEffects(item)
    expect(player.status.sobriety).toBe(80)
  })
})
