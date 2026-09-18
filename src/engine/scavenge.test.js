import { describe, it, expect } from 'vitest'
import {
  SCAVENGE_ERROR_CODES,
  SCAVENGE_DEPLETION_MAX,
  SCAVENGE_TICKS_PER_RESTOCK,
  SCAVENGE_DEPLETION_PENALTY,
  scavengedCounterName,
  scavengeDepletion,
  scavengeSearch,
} from './scavenge.js'
import { blendSober } from './blend.js'

// --- Fixtures ---

const items = {
  cardboard: { id: 'cardboard', name: 'Cardboard' },
  lone_shoe: { id: 'lone_shoe', name: 'A Shoe' },
  sharpie: { id: 'sharpie', name: 'Sharpie' },
  nice_piece_of_wood: { id: 'nice_piece_of_wood', name: 'Nice Piece of Wood' },
}

const tables = {
  lot: {
    id: 'lot',
    stat: 'luck',
    dc: 10,
    entries: [
      { itemId: 'cardboard', weight: 30, rare: false, unique: false },
      { itemId: 'lone_shoe', weight: 10, rare: false, unique: false },
      { itemId: 'sharpie', weight: 5, rare: true, unique: false },
    ],
  },
  basement: {
    id: 'basement',
    stat: 'wits',
    dc: 8,
    entries: [
      {
        itemId: 'nice_piece_of_wood',
        weight: 30,
        rare: false,
        unique: true,
        inspiration: { mediumId: 'painting', strength: 50, ticksTotal: 12 },
      },
      { itemId: 'cardboard', weight: 10, rare: false, unique: false },
    ],
  },
}

function makePlayer({ luck = 10, wits = 10, counters = {} } = {}) {
  return {
    stats: {
      luck: { base: luck, modifiers: [], xp: 0 },
      wits: { base: wits, modifiers: [], xp: 0 },
    },
    psyche: { traumas: [], obsessions: [], insanities: [], abilities: [] },
    blend: blendSober(),
    counters,
  }
}

const lot = (scavenge) => ({ id: 'toads_express', scavengeTableId: 'lot', scavenge })
const basement = () => ({ id: 'moms_house', scavengeTableId: 'basement' })
const at = (tick) => ({ tick })

/** An rng that returns the given values in order, then repeats the last. */
function sequence(...values) {
  let i = 0
  return () => values[Math.min(i++, values.length - 1)]
}
const HIGH_DIE = 0.7 // natural 15
const LOW_DIE = 0.1 // natural 3
const MAX_DIE = 0.9999 // natural 20

// --- scavengedCounterName ---

describe('scavengedCounterName', () => {
  it('names the counter that remembers a find', () => {
    expect(scavengedCounterName({ itemId: 'lone_shoe' })).toBe('scavenged_lone_shoe')
  })
})

// --- scavengeDepletion ---

describe('scavengeDepletion', () => {
  it('is zero for a place nobody has worked', () => {
    expect(scavengeDepletion({ location: lot(undefined), gameTime: at(100) })).toBe(0)
    expect(
      scavengeDepletion({ location: lot({ depletion: 0, updatedAtTick: 0 }), gameTime: at(5) })
    ).toBe(0)
  })

  it('restocks one level per restock period, lazily', () => {
    const location = lot({ depletion: 3, updatedAtTick: 10 })
    expect(scavengeDepletion({ location, gameTime: at(10) })).toBe(3)
    expect(scavengeDepletion({ location, gameTime: at(10 + SCAVENGE_TICKS_PER_RESTOCK - 1) })).toBe(
      3
    )
    expect(scavengeDepletion({ location, gameTime: at(10 + SCAVENGE_TICKS_PER_RESTOCK) })).toBe(2)
    expect(scavengeDepletion({ location, gameTime: at(10 + SCAVENGE_TICKS_PER_RESTOCK * 2) })).toBe(
      1
    )
  })

  it('never restocks below zero or reads above the maximum', () => {
    expect(
      scavengeDepletion({ location: lot({ depletion: 2, updatedAtTick: 0 }), gameTime: at(10000) })
    ).toBe(0)
    expect(
      scavengeDepletion({ location: lot({ depletion: 99, updatedAtTick: 0 }), gameTime: at(0) })
    ).toBe(SCAVENGE_DEPLETION_MAX)
  })
})

// --- scavengeSearch ---

describe('scavengeSearch', () => {
  it('rejects a missing player and a missing location', () => {
    const base = { tables, items, gameTime: at(0) }
    expect(scavengeSearch({ ...base, player: null, location: lot() }).error.code).toBe(
      SCAVENGE_ERROR_CODES.PLAYER_MISSING
    )
    expect(scavengeSearch({ ...base, player: makePlayer(), location: null }).error.code).toBe(
      SCAVENGE_ERROR_CODES.LOCATION_MISSING
    )
  })

  it('rejects a location that names no known table', () => {
    const location = { id: 'nowhere', scavengeTableId: 'moon' }
    const result = scavengeSearch({
      player: makePlayer(),
      location,
      tables,
      items,
      gameTime: at(0),
    })
    expect(result.error.code).toBe(SCAVENGE_ERROR_CODES.TABLE_UNKNOWN)
  })

  it('rejects a table that names an item nobody defined', () => {
    const result = scavengeSearch({
      player: makePlayer(),
      location: lot(),
      tables,
      items: { cardboard: items.cardboard },
      gameTime: at(0),
    })
    expect(result.error.code).toBe(SCAVENGE_ERROR_CODES.ITEM_UNKNOWN)
  })

  it('a failed check finds nothing and leaves the spot as it was', () => {
    const location = lot({ depletion: 1, updatedAtTick: 4 })
    const { data } = scavengeSearch({
      player: makePlayer(),
      location,
      tables,
      items,
      gameTime: at(20),
      rng: sequence(LOW_DIE),
    })
    expect(data.itemId).toBeNull()
    expect(data.entry).toBeNull()
    expect(data.check.success).toBe(false)
    expect(data.pickedClean).toBe(false)
    expect(data.scavenge).toEqual({ depletion: 1, updatedAtTick: 4 })
  })

  it('a success draws an entry by weight, depletes the spot, and restarts its clock', () => {
    // die 15 + luck mod 1 = 16 >= 10; pick 0.0 → first entry
    const { data } = scavengeSearch({
      player: makePlayer(),
      location: lot(),
      tables,
      items,
      gameTime: at(33),
      rng: sequence(HIGH_DIE, 0.0),
    })
    expect(data.itemId).toBe('cardboard')
    expect(data.entry).toMatchObject({ itemId: 'cardboard', weight: 30 })
    expect(data.depletionBefore).toBe(0)
    expect(data.scavenge).toEqual({ depletion: 1, updatedAtTick: 33 })
  })

  it('the weights decide: the far end of the draw reaches the rare entry', () => {
    const { data } = scavengeSearch({
      player: makePlayer(),
      location: lot(),
      tables,
      items,
      gameTime: at(0),
      rng: sequence(HIGH_DIE, 0.999),
    })
    expect(data.itemId).toBe('sharpie')
  })

  it('a critical success draws only from the rare entries', () => {
    const { data } = scavengeSearch({
      player: makePlayer(),
      location: lot(),
      tables,
      items,
      gameTime: at(0),
      rng: sequence(MAX_DIE, 0.0),
    })
    expect(data.check.criticalSuccess).toBe(true)
    expect(data.itemId).toBe('sharpie')
  })

  it('a critical success on a table with nothing rare draws normally', () => {
    const { data } = scavengeSearch({
      player: makePlayer(),
      location: basement(),
      tables,
      items,
      gameTime: at(0),
      rng: sequence(MAX_DIE, 0.0),
    })
    expect(data.itemId).toBe('nice_piece_of_wood')
  })

  it('uses the table stat, and the check comes back itemized', () => {
    const player = makePlayer({ wits: 40, luck: 1 })
    const { data } = scavengeSearch({
      player,
      location: basement(),
      tables,
      items,
      gameTime: at(0),
      rng: sequence(LOW_DIE, 0.0),
    })
    // die 3 + wits mod 4 = 7 < 8
    expect(data.check.stat).toBe('wits')
    expect(data.check.total).toBe(7)
    expect(data.check.modifierItems[0]).toEqual({ source: 'base', sourceId: 'wits', value: 40 })
  })

  it('depletion costs the check, as a situational modifier the story can see', () => {
    const location = lot({ depletion: 2, updatedAtTick: 0 })
    const { data } = scavengeSearch({
      player: makePlayer(),
      location,
      tables,
      items,
      gameTime: at(1),
      rng: sequence(0.45, 0.0), // natural 10
    })
    // 10 + 1 - 4 = 7 < 10
    expect(data.check.modifier).toBe(1 - 2 * SCAVENGE_DEPLETION_PENALTY)
    expect(data.check.success).toBe(false)
    expect(data.check.modifierItems.at(-1)).toEqual({
      source: 'situational',
      sourceId: null,
      value: -4,
    })
  })

  it('a failure at a worked-over spot reads as picked clean', () => {
    const location = lot({ depletion: 4, updatedAtTick: 0 })
    const { data } = scavengeSearch({
      player: makePlayer(),
      location,
      tables,
      items,
      gameTime: at(1),
      rng: sequence(LOW_DIE),
    })
    expect(data.pickedClean).toBe(true)
  })

  it('depletion never passes the maximum', () => {
    const location = lot({ depletion: SCAVENGE_DEPLETION_MAX, updatedAtTick: 0 })
    const { data } = scavengeSearch({
      player: makePlayer({ luck: 100 }),
      location,
      tables,
      items,
      gameTime: at(1),
      rng: sequence(MAX_DIE, 0.0),
    })
    expect(data.itemId).not.toBeNull()
    expect(data.scavenge.depletion).toBe(SCAVENGE_DEPLETION_MAX)
  })

  it('a restocked spot is worked from its restocked level', () => {
    const location = lot({ depletion: 3, updatedAtTick: 0 })
    const { data } = scavengeSearch({
      player: makePlayer({ luck: 100 }),
      location,
      tables,
      items,
      gameTime: at(SCAVENGE_TICKS_PER_RESTOCK * 2),
      rng: sequence(HIGH_DIE, 0.0),
    })
    expect(data.depletionBefore).toBe(1)
    expect(data.scavenge).toEqual({ depletion: 2, updatedAtTick: SCAVENGE_TICKS_PER_RESTOCK * 2 })
  })

  it('a unique entry is found once: after that the table draws from what is left', () => {
    const first = scavengeSearch({
      player: makePlayer(),
      location: basement(),
      tables,
      items,
      gameTime: at(0),
      rng: sequence(HIGH_DIE, 0.0),
    })
    expect(first.data.itemId).toBe('nice_piece_of_wood')
    expect(first.data.entry.inspiration).toEqual({
      mediumId: 'painting',
      strength: 50,
      ticksTotal: 12,
    })

    const again = scavengeSearch({
      player: makePlayer({ counters: { scavenged_nice_piece_of_wood: 1 } }),
      location: basement(),
      tables,
      items,
      gameTime: at(0),
      rng: sequence(HIGH_DIE, 0.0),
    })
    expect(again.data.itemId).toBe('cardboard')
  })

  it('does not mutate the player or the location', () => {
    const player = makePlayer()
    const location = lot({ depletion: 1, updatedAtTick: 0 })
    const before = JSON.stringify({ player, location })
    scavengeSearch({
      player,
      location,
      tables,
      items,
      gameTime: at(5),
      rng: sequence(HIGH_DIE, 0.0),
    })
    expect(JSON.stringify({ player, location })).toBe(before)
  })
})
