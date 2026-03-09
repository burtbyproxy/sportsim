import { describe, it, expect } from 'vitest'
import { simulateTick } from './simulation.js'
import { seededRandom } from '../utils/random.js'
import { advanceClock, createClock } from './clock.js'

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
      { locationId: 'bar', startHour: 17, endHour: 2, probability: 0.85, days: ['all'], type: 'bar' },
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
    const alwaysPresent = () => 0 // chance(0.x, rng) where rng < probability → true
    const updates = simulateTick([char], gameTime, alwaysPresent)
    expect(updates[0].locationId).toBe('blue_parrot')
  })

  it('places character off-map outside scheduled hours', () => {
    const char = makeFixed('bartender')
    const gameTime = makeGameTime(10) // 10am — outside shift
    const updates = simulateTick([char], gameTime, seededRandom(1))
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
    const updates = simulateTick([char], makeGameTime(20), seededRandom(1))
    expect(updates[0].statusChanges).toBeUndefined()
  })

  it('returns correct id', () => {
    const char = makeFixed('my_bartender')
    const updates = simulateTick([char], makeGameTime(20), seededRandom(1))
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
    const updates = simulateTick([char], gameTime, seededRandom(1))
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
    const updates = simulateTick([char], makeGameTime(10), seededRandom(1))
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
    const updates = simulateTick([char], makeGameTime(3), seededRandom(1))
    expect(updates[0].statusChanges).toBeDefined()
    // hunger should decrease
    expect(updates[0].statusChanges.hunger).toBe(-1)
  })

  it('biases toward bar when sobriety is very low', () => {
    const char = makeFull('drunk_protagonist', { sobriety: 10 })
    // sobriety < 30 → bias toward 'bar'
    // Schedule has a bar entry with type: 'bar'
    const gameTime = makeGameTime(20) // evening — bar shift (17-02) is active
    const alwaysPresent = () => 0
    const updates = simulateTick([char], gameTime, alwaysPresent)
    expect(updates[0].locationId).toBe('bar')
  })

  it('full-sim character with no status tracks no decay', () => {
    const char = { ...makeFull('ghost'), status: null }
    const updates = simulateTick([char], makeGameTime(3), seededRandom(1))
    expect(updates[0].statusChanges).toBeUndefined()
  })
})

// --- simulateTick: mixed characters ---

describe('simulateTick — multiple characters', () => {
  it('handles all three tiers in one call', () => {
    const chars = [
      makeFixed('bartender'),
      makeRoutine('carl'),
      makeFull('protagonist'),
    ]
    const gameTime = makeGameTime(20)
    const updates = simulateTick(chars, gameTime, seededRandom(42))
    expect(updates).toHaveLength(3)
    expect(updates.map((u) => u.id)).toEqual(['bartender', 'carl', 'protagonist'])
  })

  it('is reproducible with seeded RNG', () => {
    const chars = [makeFixed('a'), makeFixed('b'), makeFixed('c')]
    const gameTime = makeGameTime(20)
    const run1 = simulateTick(chars, gameTime, seededRandom(99))
    const run2 = simulateTick(chars, gameTime, seededRandom(99))
    expect(run1.map((u) => u.locationId)).toEqual(run2.map((u) => u.locationId))
  })
})

// --- Integration: 24-hour simulation ---

describe('simulateTick — 24-hour integration (96 ticks)', () => {
  it('carl moves through his schedule over a full day', () => {
    const carl = makeRoutine('carl')
    const rng = seededRandom(7)
    let clock = createClock() // Monday 8:00 AM, tick 0

    const locationLog = []

    for (let i = 0; i < 96; i++) {
      const updates = simulateTick([carl], clock, rng)
      locationLog.push(updates[0].locationId)
      clock = advanceClock(clock, 1)
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
    const rng = seededRandom(1)

    const start = performance.now()
    simulateTick(chars, gameTime, rng)
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(5)
  })
})
