import { describe, it, expect } from 'vitest'
import { simulationTick } from '../src/engine/simulation.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function alwaysRng() {
  return 0.01
} // effectively always present
function neverRng() {
  return 0.99
} // effectively never present

function makeTime(hour = 12, minute = 0, dayOfWeek = 'monday') {
  return { hour, minute, dayOfWeek, tick: 0, day: 1, period: 'afternoon' }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeFixed() {
  return {
    id: 'bartender',
    simulation: 'fixed',
    status: null,
    decisionWeights: null,
    schedule: {
      entries: [
        { locationId: 'blue_parrot', startHour: 16, endHour: 2, probability: 0.95, days: ['all'] },
      ],
    },
  }
}

function makeRoutine() {
  return {
    id: 'carl',
    simulation: 'routine',
    status: { hunger: 60, sobriety: 70, energy: 65, mood: 45, health: 90 },
    decisionWeights: null,
    schedule: {
      entries: [
        { locationId: 'mocks_crest', startHour: 11, endHour: 23, probability: 0.9, days: ['all'] },
        {
          locationId: 'ainsworth_plaid',
          startHour: 23,
          endHour: 0,
          probability: 0.7,
          days: ['all'],
        },
      ],
    },
  }
}

// Full-sim character whose schedule has NO food-typed or food-named entry.
// decisionWeights.low_hunger fires when hunger < 20 — but there's nowhere to go.
// This is the bias fallthrough scenario.
function makeFull(overrides = {}) {
  return {
    id: 'rival',
    simulation: 'full',
    status: { hunger: 60, sobriety: 70, energy: 65, mood: 45, health: 90 },
    decisionWeights: {
      low_sobriety: { bias: 'bar', weight: 0.7 },
      low_hunger: { bias: 'food', weight: 0.8 },
      low_mood: { bias: 'alone', weight: 0.5 },
      low_energy: null,
    },
    schedule: {
      entries: [
        { locationId: 'columbia_park', startHour: 8, endHour: 20, probability: 1.0, days: ['all'] },
        { locationId: 'moms_house', startHour: 20, endHour: 8, probability: 1.0, days: ['all'] },
      ],
    },
    stats: {
      stamina: { base: 10, modifiers: [], xp: 0 },
      toughness: { base: 10, modifiers: [], xp: 0 },
      wits: { base: 10, modifiers: [], xp: 0 },
      creativity: { base: 10, modifiers: [], xp: 0 },
      charm: { base: 10, modifiers: [], xp: 0 },
      reputation: { base: 10, modifiers: [], xp: 0 },
      luck: { base: 10, modifiers: [], xp: 0 },
      karma: { base: 10, modifiers: [], xp: 0 },
    },
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// simulationTick — fixed tier
// ---------------------------------------------------------------------------

describe('simulationTick — fixed tier', () => {
  it('returns locationId when in schedule window and rng passes', () => {
    const result = simulationTick({
      characters: [makeFixed()],
      gameTime: makeTime(18),
      rng: alwaysRng,
    })
    expect(result[0].locationId).toBe('blue_parrot')
  })

  it('returns null when rng fails probability', () => {
    const result = simulationTick({
      characters: [makeFixed()],
      gameTime: makeTime(18),
      rng: neverRng,
    })
    expect(result[0].locationId).toBeNull()
  })

  it('returns null when outside schedule window', () => {
    const result = simulationTick({
      characters: [makeFixed()],
      gameTime: makeTime(10),
      rng: alwaysRng,
    })
    expect(result[0].locationId).toBeNull()
  })

  it('returns null when schedule is empty', () => {
    const c = { ...makeFixed(), schedule: { entries: [] } }
    const result = simulationTick({ characters: [c], gameTime: makeTime(18), rng: alwaysRng })
    expect(result[0].locationId).toBeNull()
  })

  it('result has correct id', () => {
    const result = simulationTick({
      characters: [makeFixed()],
      gameTime: makeTime(18),
      rng: alwaysRng,
    })
    expect(result[0].id).toBe('bartender')
  })

  it('does not include statusChanges', () => {
    const result = simulationTick({
      characters: [makeFixed()],
      gameTime: makeTime(18),
      rng: alwaysRng,
    })
    expect(result[0].statusChanges).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// simulationTick — routine tier
// ---------------------------------------------------------------------------

describe('simulationTick — routine tier', () => {
  it('returns matching schedule location when rng passes', () => {
    const result = simulationTick({
      characters: [makeRoutine()],
      gameTime: makeTime(14),
      rng: alwaysRng,
    })
    expect(result[0].locationId).toBe('mocks_crest')
  })

  it('returns null when outside all schedule windows', () => {
    const result = simulationTick({
      characters: [makeRoutine()],
      gameTime: makeTime(3),
      rng: alwaysRng,
    })
    expect(result[0].locationId).toBeNull()
  })

  it('returns null when rng fails probability', () => {
    const result = simulationTick({
      characters: [makeRoutine()],
      gameTime: makeTime(14),
      rng: neverRng,
    })
    expect(result[0].locationId).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// simulationTick — full tier — normal path
// ---------------------------------------------------------------------------

describe('simulationTick — full tier — normal path', () => {
  it('returns scheduled location when status is nominal', () => {
    // hunger=60 (not < 20), sobriety=70 (not < 30) — no bias fires
    const result = simulationTick({
      characters: [makeFull()],
      gameTime: makeTime(10),
      rng: alwaysRng,
    })
    expect(result[0].locationId).toBe('columbia_park')
  })

  it('includes statusChanges', () => {
    const result = simulationTick({
      characters: [makeFull()],
      gameTime: makeTime(10),
      rng: alwaysRng,
    })
    expect(result[0].statusChanges).toBeDefined()
  })

  it('returns null when outside all schedule windows and rng fails', () => {
    const c = makeFull({ schedule: { entries: [] } })
    const result = simulationTick({ characters: [c], gameTime: makeTime(10), rng: alwaysRng })
    expect(result[0].locationId).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// simulationTick — full tier — bias path
// ---------------------------------------------------------------------------

describe('simulationTick — full tier — bias fires, entry found', () => {
  // The park comes first in the schedule, so ordinary resolution lands there.
  // Only the bias can pick the bar, which makes the bias the thing under test.
  const parkThenBar = {
    entries: [
      {
        locationId: 'columbia_park',
        startHour: 0,
        endHour: 24,
        probability: 1.0,
        days: ['all'],
      },
      {
        locationId: 'blue_parrot',
        type: 'bar',
        startHour: 0,
        endHour: 24,
        probability: 1.0,
        days: ['all'],
      },
    ],
  }
  const withSobriety = (sobriety) =>
    makeFull({
      status: { hunger: 60, sobriety, energy: 65, mood: 45, health: 90 },
      schedule: parkThenBar,
    })

  it('a drunk character skips the first scheduled stop for the bar-typed entry', () => {
    const result = simulationTick({
      characters: [withSobriety(10)],
      gameTime: makeTime(10),
      rng: alwaysRng,
    })
    expect(result[0].locationId).toBe('blue_parrot')
  })

  it('the same character sober keeps the schedule', () => {
    const result = simulationTick({
      characters: [withSobriety(70)],
      gameTime: makeTime(10),
      rng: alwaysRng,
    })
    expect(result[0].locationId).toBe('columbia_park')
  })
})

// ---------------------------------------------------------------------------
// simulationTick — full tier — BIAS FALLTHROUGH
// ---------------------------------------------------------------------------

describe('simulationTick — full tier — bias fallthrough', () => {
  it('falls through to normal schedule when bias fires but no matching entry exists', () => {
    // hunger < 20 triggers low_hunger bias ('food'), but schedule has NO food-typed
    // or food-named entries. Engine must fall through to normal schedule resolution.
    const c = makeFull({
      status: { hunger: 10, sobriety: 70, energy: 65, mood: 45, health: 90 },
      // schedule entries: columbia_park (8-20) and moms_house (20-8) — neither is food
    })
    const result = simulationTick({ characters: [c], gameTime: makeTime(10), rng: alwaysRng })
    // Hour 10 is in columbia_park's window — that's the normal resolution
    expect(result[0].locationId).toBe('columbia_park')
  })

  it('bias fallthrough still returns statusChanges', () => {
    const c = makeFull({
      status: { hunger: 10, sobriety: 70, energy: 65, mood: 45, health: 90 },
    })
    const result = simulationTick({ characters: [c], gameTime: makeTime(10), rng: alwaysRng })
    expect(result[0].statusChanges).toBeDefined()
  })

  it('bias fallthrough returns null when normal schedule also has no match', () => {
    const c = makeFull({
      status: { hunger: 10, sobriety: 70, energy: 65, mood: 45, health: 90 },
      schedule: { entries: [] }, // no entries at all
    })
    const result = simulationTick({ characters: [c], gameTime: makeTime(10), rng: alwaysRng })
    expect(result[0].locationId).toBeNull()
  })

  it('bias fallthrough: multiple biases, highest weight fires and falls through', () => {
    // Both sobriety < 30 AND hunger < 20 — low_hunger wins (weight 0.8 > 0.7)
    // Neither bias has a matching entry — should fall through to schedule
    const c = makeFull({
      status: { hunger: 10, sobriety: 10, energy: 65, mood: 45, health: 90 },
      // no bar or food entries in schedule
    })
    const result = simulationTick({ characters: [c], gameTime: makeTime(10), rng: alwaysRng })
    expect(result[0].locationId).toBe('columbia_park')
  })
})

// ---------------------------------------------------------------------------
// simulationTick — multiple characters
// ---------------------------------------------------------------------------

describe('simulationTick — multiple characters', () => {
  it('returns one update per character', () => {
    const characters = [makeFixed(), makeRoutine(), makeFull()]
    const result = simulationTick({ characters, gameTime: makeTime(12), rng: alwaysRng })
    expect(result).toHaveLength(3)
  })

  it('each update has the correct id', () => {
    const characters = [makeFixed(), makeRoutine(), makeFull()]
    const result = simulationTick({ characters, gameTime: makeTime(12), rng: alwaysRng })
    expect(result.map((r) => r.id)).toEqual(['bartender', 'carl', 'rival'])
  })

  it('returns empty array for empty input', () => {
    expect(simulationTick({ characters: [], gameTime: makeTime(12), rng: alwaysRng })).toEqual([])
  })
})
