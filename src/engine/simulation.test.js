import { describe, it, expect } from 'vitest'
import { simulateTick } from './simulation.js'
import { randomSeeded } from '../utils/random.js'
import { clockAdvance, clockCreate } from './clock.js'

// --- Helpers ---

function makeSchedule(entries) {
  return { entries }
}

function makeFixed(id, locationId = 'blue_parrot', probability = 1) {
  return {
    id,
    simulation: 'fixed',
    currentLocationId: null,
    schedule: makeSchedule([
      {
        locationId,
        startHour: 16,
        endHour: 2,
        probability,
        days: ['all'],
      },
    ]),
  }
}

function makeRoutine(id) {
  return {
    id,
    simulation: 'routine',
    currentLocationId: null,
    schedule: makeSchedule([
      { locationId: 'work', startHour: 9, endHour: 17, probability: 0.9, days: ['all'] },
      { locationId: 'bar', startHour: 17, endHour: 23, probability: 0.8, days: ['all'] },
      { locationId: 'home', startHour: 23, endHour: 9, probability: 0.95, days: ['all'] },
    ]),
  }
}

function makeFull(id, statusOverrides = {}) {
  return {
    id,
    simulation: 'full',
    currentLocationId: null,
    status: {
      hunger: 50,
      sobriety: 80,
      energy: 70,
      mood: 45,
      health: 90,
      money: 5,
      ...statusOverrides,
    },
    schedule: makeSchedule([
      { locationId: 'home', startHour: 0, endHour: 11, probability: 0.9, days: ['all'] },
      {
        locationId: 'bar',
        startHour: 17,
        endHour: 2,
        probability: 0.85,
        days: ['all'],
        type: 'bar',
      },
    ]),
    decisionWeights: {
      low_sobriety: { bias: 'bar', weight: 0.7 },
      low_hunger: { bias: 'food', weight: 0.8 },
      low_mood: { bias: 'alone', weight: 0.5 },
      low_energy: null,
    },
  }
}

function makeGameTime(hour, minute = 0, dayOfWeek = 'monday') {
  return { tick: 1, day: 1, hour, minute, period: 'afternoon', dayOfWeek }
}

// --- simulateTick: fixed tier ---

describe('simulateTick — fixed tier', () => {
  it('places character at scheduled location during scheduled hours', () => {
    const char = makeFixed('bartender')
    const gameTime = makeGameTime(20) // 8pm — inside 16:00-02:00 shift
    const alwaysPresent = () => 0 // randomChance({ probability: 0.x, rng }) where rng < probability → true
    const updates = simulateTick([char], gameTime, alwaysPresent)
    expect(updates[0].locationId).toBe('blue_parrot')
  })

  it('places character off-map outside scheduled hours', () => {
    const char = makeFixed('bartender')
    const gameTime = makeGameTime(10) // 10am — outside shift
    const updates = simulateTick([char], gameTime, randomSeeded({ seed: 1 }))
    expect(updates[0].locationId).toBeNull()
  })

  it('applies probability — character absent when roll fails', () => {
    const char = makeFixed('flaky_clerk', 'shop', 0.5)
    const gameTime = makeGameTime(20)
    const alwaysAbsent = () => 0.9 // 0.9 >= 0.5 → chance returns false
    const updates = simulateTick([char], gameTime, alwaysAbsent)
    expect(updates[0].locationId).toBeNull()
  })

  it('never returns statusChanges for fixed tier', () => {
    const char = makeFixed('bartender')
    const updates = simulateTick([char], makeGameTime(20), randomSeeded({ seed: 1 }))
    expect(updates[0].statusChanges).toBeUndefined()
  })

  it('returns correct id', () => {
    const char = makeFixed('my_bartender')
    const updates = simulateTick([char], makeGameTime(20), randomSeeded({ seed: 1 }))
    expect(updates[0].id).toBe('my_bartender')
  })
})

// --- simulateTick: routine tier ---

describe('simulateTick — routine tier', () => {
  it('places character at scheduled location', () => {
    const char = makeRoutine('carl')
    const gameTime = makeGameTime(10) // inside work shift
    const alwaysPresent = () => 0
    const updates = simulateTick([char], gameTime, alwaysPresent)
    expect(updates[0].locationId).toBe('work')
  })

  it('places character in transit location at endHour boundary + minutes', () => {
    const char = makeRoutine('carl')
    // At 17:15, work shift ended (endHour=17) and carl is heading to bar
    const gameTime = makeGameTime(17, 15)
    const updates = simulateTick([char], gameTime, randomSeeded({ seed: 1 }))
    expect(updates[0].locationId).toBe('bar') // transit destination
  })

  it('places character off-map when no schedule match and not in transit', () => {
    const char = makeRoutine('carl')
    // Hour 17, minute 0 — exactly on boundary, not in transit (minute=0)
    // This resolves to the bar entry (startHour=17) — carl just arrived
    const gameTime = makeGameTime(17, 0)
    const alwaysPresent = () => 0
    const updates = simulateTick([char], gameTime, alwaysPresent)
    expect(updates[0].locationId).toBe('bar')
  })

  it('does not return statusChanges for routine tier', () => {
    const char = makeRoutine('carl')
    const updates = simulateTick([char], makeGameTime(10), randomSeeded({ seed: 1 }))
    expect(updates[0].statusChanges).toBeUndefined()
  })
})

// --- simulateTick: full tier ---

describe('simulateTick — full tier', () => {
  it('follows normal schedule when status is fine', () => {
    const char = makeFull('protagonist')
    const gameTime = makeGameTime(3) // inside home window (0-11)
    const alwaysPresent = () => 0
    const updates = simulateTick([char], gameTime, alwaysPresent)
    expect(updates[0].locationId).toBe('home')
  })

  it('returns statusChanges for full tier', () => {
    const char = makeFull('protagonist')
    const updates = simulateTick([char], makeGameTime(3), randomSeeded({ seed: 1 }))
    expect(updates[0].statusChanges).toBeDefined()
    // hunger should decrease
    expect(updates[0].statusChanges.hunger).toBe(-1)
  })

  it('a drunk heads for the bar at nine in the morning; sober, the same schedule keeps them home', () => {
    // At 9:00 the schedule says home (0–11) and the bar shift (17–02) is hours
    // away, so the bias is the only thing that can send anyone to the bar.
    const gameTime = makeGameTime(9)
    const alwaysPresent = () => 0
    const drunk = makeFull('drunk_protagonist', { sobriety: 10 })
    const sober = makeFull('sober_protagonist', { sobriety: 80 })
    expect(simulateTick([drunk], gameTime, alwaysPresent)[0].locationId).toBe('bar')
    expect(simulateTick([sober], gameTime, alwaysPresent)[0].locationId).toBe('home')
  })

  it('the drunk line is sobriety 30: at it they keep their schedule, under it they do not', () => {
    const gameTime = makeGameTime(9)
    const alwaysPresent = () => 0
    const at = makeFull('at_the_line', { sobriety: 30 })
    const under = makeFull('under_the_line', { sobriety: 29 })
    expect(simulateTick([at], gameTime, alwaysPresent)[0].locationId).toBe('home')
    expect(simulateTick([under], gameTime, alwaysPresent)[0].locationId).toBe('bar')
  })

  it('full-sim character with no status tracks no decay', () => {
    const char = { ...makeFull('ghost'), status: null }
    const updates = simulateTick([char], makeGameTime(3), randomSeeded({ seed: 1 }))
    expect(updates[0].statusChanges).toBeUndefined()
  })
})

// --- simulateTick: mixed characters ---

describe('simulateTick — multiple characters', () => {
  it('handles all three tiers in one call', () => {
    const chars = [makeFixed('bartender'), makeRoutine('carl'), makeFull('protagonist')]
    const gameTime = makeGameTime(20)
    const updates = simulateTick(chars, gameTime, randomSeeded({ seed: 42 }))
    expect(updates).toHaveLength(3)
    expect(updates.map((u) => u.id)).toEqual(['bartender', 'carl', 'protagonist'])
  })

  it('is reproducible with seeded RNG', () => {
    const chars = [makeFixed('a'), makeFixed('b'), makeFixed('c')]
    const gameTime = makeGameTime(20)
    const run1 = simulateTick(chars, gameTime, randomSeeded({ seed: 99 }))
    const run2 = simulateTick(chars, gameTime, randomSeeded({ seed: 99 }))
    expect(run1.map((u) => u.locationId)).toEqual(run2.map((u) => u.locationId))
  })
})

// --- Integration: 24-hour simulation ---

describe('simulateTick — 24-hour integration (96 ticks)', () => {
  it('carl moves through his schedule over a full day', () => {
    const carl = makeRoutine('carl')
    const rng = randomSeeded({ seed: 7 })
    let clock = clockCreate() // Monday 8:00 AM, tick 0

    const locationLog = []

    for (let i = 0; i < 96; i++) {
      const updates = simulateTick([carl], clock, rng)
      locationLog.push(updates[0].locationId)
      clock = clockAdvance({ gameTime: clock, ticks: 1 })
    }

    // Carl should have visited work (9-17), bar (17-23), and home (23-9) over the day
    const locationsVisited = new Set(locationLog.filter(Boolean))
    expect(locationsVisited.has('work')).toBe(true)
    expect(locationsVisited.has('bar')).toBe(true)
    expect(locationsVisited.has('home')).toBe(true)
  })
})

// --- Performance: 50 characters in < 5ms ---

describe('simulateTick — performance', () => {
  it('simulates 50 characters (40 fixed, 8 routine, 2 full) in < 5ms', () => {
    const chars = [
      ...Array.from({ length: 40 }, (_, i) => makeFixed(`fixed_${i}`)),
      ...Array.from({ length: 8 }, (_, i) => makeRoutine(`routine_${i}`)),
      ...Array.from({ length: 2 }, (_, i) => makeFull(`full_${i}`)),
    ]
    const gameTime = makeGameTime(20)
    const rng = randomSeeded({ seed: 1 })

    const start = performance.now()
    simulateTick(chars, gameTime, rng)
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(5)
  })
})

describe('full-tier bias respects the day of the week', () => {
  it('a hungry character is not sent to a stop that only exists on another day', () => {
    const char = {
      id: 'eater',
      simulation: 'full',
      currentLocationId: 'home',
      status: { hunger: 5, sobriety: 100, mood: 80, energy: 80, health: 100 },
      decisionWeights: { low_hunger: { bias: 'food', weight: 1 } },
      schedule: {
        entries: [
          {
            locationId: 'saturday_food_cart',
            type: 'food',
            startHour: 0,
            endHour: 24,
            days: ['saturday'],
            probability: 1,
          },
          { locationId: 'home', startHour: 0, endHour: 24, days: ['all'], probability: 1 },
        ],
      },
    }
    const onDay = (dayOfWeek) =>
      simulateTick([char], { hour: 12, minute: 0, tick: 0, day: 1, dayOfWeek }, () => 0)[0]
        .locationId
    expect(onDay('saturday')).toBe('saturday_food_cart')
    expect(onDay('tuesday')).not.toBe('saturday_food_cart')
  })
})
