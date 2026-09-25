import { describe, it, expect } from 'vitest'
import { simulationTick } from './simulation.js'
import { statusDecayChanges } from './stats.js'
import { randomSeeded } from '../utils/random.js'
import { clockAdvance, clockCreate } from './clock.js'
import { tuningContent } from '../../tests/helpers/content.js'

const tuning = tuningContent()

// --- Helpers ---

function makeSchedule(entries) {
  return { entries }
}

function makeFixed({ id, locationId = 'blue_parrot', probability = 1 }) {
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

function makeFull({ id, statusOverrides = {} }) {
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
    decisionWeights: Object.fromEntries([
      ['low_sobriety', { bias: 'bar', weight: 0.7 }],
      ['low_hunger', { bias: 'food', weight: 0.8 }],
      ['low_mood', { bias: 'alone', weight: 0.5 }],
      ['low_energy', null],
    ]),
  }
}

function makeGameTime({ hour, minute = 0, dayOfWeek = 'monday' }) {
  return { tick: 1, day: 1, hour, minute, period: 'afternoon', dayOfWeek }
}

// --- simulationTick: fixed tier ---

describe('simulationTick — fixed tier', () => {
  it('places character at scheduled location during scheduled hours', () => {
    const char = makeFixed({ id: 'bartender' })
    const gameTime = makeGameTime({ hour: 20 }) // 8pm — inside 16:00-02:00 shift
    const alwaysPresent = () => 0 // randomChance({ probability: 0.x, rng }) where rng < probability → true
    const updates = simulationTick({ tuning, characters: [char], gameTime, rng: alwaysPresent })
    expect(updates[0].locationId).toBe('blue_parrot')
  })

  it('places character off-map outside scheduled hours', () => {
    const char = makeFixed({ id: 'bartender' })
    const gameTime = makeGameTime({ hour: 10 }) // 10am — outside shift
    const updates = simulationTick({
      tuning,
      characters: [char],
      gameTime,
      rng: randomSeeded({ seed: 1 }),
    })
    expect(updates[0].locationId).toBeNull()
  })

  it('applies probability — character absent when roll fails', () => {
    const char = makeFixed({ id: 'flaky_clerk', locationId: 'shop', probability: 0.5 })
    const gameTime = makeGameTime({ hour: 20 })
    const alwaysAbsent = () => 0.9 // 0.9 >= 0.5 → chance returns false
    const updates = simulationTick({ tuning, characters: [char], gameTime, rng: alwaysAbsent })
    expect(updates[0].locationId).toBeNull()
  })

  it('never returns statusChanges for fixed tier', () => {
    const char = makeFixed({ id: 'bartender' })
    const updates = simulationTick({
      tuning,
      characters: [char],
      gameTime: makeGameTime({ hour: 20 }),
      rng: randomSeeded({ seed: 1 }),
    })
    expect(updates[0].statusChanges).toBeUndefined()
  })

  it('returns correct id', () => {
    const char = makeFixed({ id: 'my_bartender' })
    const updates = simulationTick({
      tuning,
      characters: [char],
      gameTime: makeGameTime({ hour: 20 }),
      rng: randomSeeded({ seed: 1 }),
    })
    expect(updates[0].id).toBe('my_bartender')
  })
})

// --- simulationTick: routine tier ---

describe('simulationTick — routine tier', () => {
  it('places character at scheduled location', () => {
    const char = makeRoutine('carl')
    const gameTime = makeGameTime({ hour: 10 }) // inside work shift
    const alwaysPresent = () => 0
    const updates = simulationTick({ tuning, characters: [char], gameTime, rng: alwaysPresent })
    expect(updates[0].locationId).toBe('work')
  })

  it('places character in transit location at endHour boundary + minutes', () => {
    const char = makeRoutine('carl')
    // At 17:15, work shift ended (endHour=17) and carl is heading to bar
    const gameTime = makeGameTime({ hour: 17, minute: 15 })
    const updates = simulationTick({
      tuning,
      characters: [char],
      gameTime,
      rng: randomSeeded({ seed: 1 }),
    })
    expect(updates[0].locationId).toBe('bar') // transit destination
  })

  it('places character off-map when no schedule match and not in transit', () => {
    const char = makeRoutine('carl')
    // Hour 17, minute 0 — exactly on boundary, not in transit (minute=0)
    // This resolves to the bar entry (startHour=17) — carl just arrived
    const gameTime = makeGameTime({ hour: 17, minute: 0 })
    const alwaysPresent = () => 0
    const updates = simulationTick({ tuning, characters: [char], gameTime, rng: alwaysPresent })
    expect(updates[0].locationId).toBe('bar')
  })

  it('a routine character with no vitals is only somewhere', () => {
    const char = makeRoutine('carl')
    const updates = simulationTick({
      tuning,
      characters: [char],
      gameTime: makeGameTime({ hour: 10 }),
      rng: randomSeeded({ seed: 1 }),
    })
    expect(updates[0].statusChanges).toBeUndefined()
    expect(updates[0].doses).toBeUndefined()
  })

  it("a routine character with vitals lives the day: the wear is the player's", () => {
    const char = {
      ...makeRoutine('carl'),
      status: { hunger: 50, energy: 70, mood: 45, health: 90 },
    }
    const updates = simulationTick({
      tuning,
      characters: [char],
      gameTime: makeGameTime({ hour: 10 }),
      rng: () => 0,
    })
    expect(updates[0].statusChanges.hunger).toBe(tuning.decay.hunger.ratePerTick)
    expect(updates[0].statusChanges.energy).toBe(tuning.decay.energy.ratePerTick)
  })
})

// --- the stops: what standing somewhere does ---

describe('simulationTick — every stop does what it does', () => {
  const status = { hunger: 50, energy: 50, mood: 40, health: 90 }
  const allDay = ({ locationId, type, probability = 1 }) => ({
    id: 'person',
    simulation: 'routine',
    currentLocationId: null,
    status,
    schedule: makeSchedule([
      { locationId, type, startHour: 0, endHour: 24, probability, days: ['all'] },
    ]),
  })
  const tick = ({ character, rng = () => 0, gameTime = makeGameTime({ hour: 10 }) }) =>
    simulationTick({ tuning, characters: [character], gameTime, rng })[0]

  for (const [type, stop] of Object.entries(tuning.simulation.stops)) {
    it(`at a '${type}' stop the wear and the stop's changes add up, and its doses go in`, () => {
      const update = tick({ character: allDay({ locationId: 'somewhere', type }) })
      const wear = statusDecayChanges({ tuning, status, ticksElapsed: 1 })
      const keys = new Set([...Object.keys(wear), ...Object.keys(stop.statusChangesPerTick)])
      // A change that comes to nothing is not reported.
      for (const key of keys) {
        expect(update.statusChanges[key] ?? 0, `${type}.${key}`).toBeCloseTo(
          (wear[key] ?? 0) + (stop.statusChangesPerTick[key] ?? 0),
          5
        )
      }
      if (stop.dosesPerTick.length > 0) expect(update.doses).toEqual(stop.dosesPerTick)
      else expect(update.doses).toBeUndefined()
    })
  }

  it('off the map is the away stop: no entry, or a roll that keeps them away', () => {
    const away = tuning.simulation.stops[tuning.simulation.awayStopType]
    const noEntry = tick({
      character: { ...allDay({ locationId: 'x', type: 'bar' }), schedule: makeSchedule([]) },
    })
    expect(noEntry.locationId).toBeNull()
    const keptAway = tick({
      character: allDay({ locationId: 'x', type: 'bar', probability: 0.5 }),
      rng: () => 0.99,
    })
    expect(keptAway.locationId).toBeNull()
    for (const update of [noEntry, keptAway]) {
      for (const [key, delta] of Object.entries(away.statusChangesPerTick)) {
        const wear = statusDecayChanges({ tuning, status, ticksElapsed: 1 })[key] ?? 0
        expect(update.statusChanges[key], key).toBeCloseTo(wear + delta, 5)
      }
      expect(update.doses).toBeUndefined()
    }
  })

  it('in transit there is no stop, only the wear', () => {
    const carl = { ...makeRoutine('carl'), status }
    const update = tick({ character: carl, gameTime: makeGameTime({ hour: 17, minute: 15 }) })
    expect(update.locationId).toBe('bar')
    expect(update.statusChanges).toEqual(statusDecayChanges({ tuning, status, ticksElapsed: 1 }))
    expect(update.doses).toBeUndefined()
  })

  it('a stop of a kind tuning does not know gives nothing but the wear', () => {
    const update = tick({ character: allDay({ locationId: 'x', type: 'moon' }) })
    expect(update.statusChanges).toEqual(statusDecayChanges({ tuning, status, ticksElapsed: 1 }))
  })

  it("a need takes a full character to its stop, and that stop's kind is what works on them", () => {
    const bar = tuning.simulation.stops.bar
    const drunk = {
      ...makeFull({ id: 'drunk', statusOverrides: { sobriety: 10 } }),
      status: { ...status, sobriety: 10 },
    }
    const update = tick({ character: drunk, gameTime: makeGameTime({ hour: 9 }) })
    expect(update.locationId).toBe('bar')
    expect(update.doses).toEqual(bar.dosesPerTick)
  })
})

// --- simulationTick: full tier ---

describe('simulationTick — full tier', () => {
  it('follows normal schedule when status is fine', () => {
    const char = makeFull({ id: 'protagonist' })
    const gameTime = makeGameTime({ hour: 3 }) // inside home window (0-11)
    const alwaysPresent = () => 0
    const updates = simulationTick({ tuning, characters: [char], gameTime, rng: alwaysPresent })
    expect(updates[0].locationId).toBe('home')
  })

  it('returns statusChanges for full tier', () => {
    const char = makeFull({ id: 'protagonist' })
    const updates = simulationTick({
      tuning,
      characters: [char],
      gameTime: makeGameTime({ hour: 3 }),
      rng: randomSeeded({ seed: 1 }),
    })
    expect(updates[0].statusChanges).toBeDefined()
    // hunger should decrease
    expect(updates[0].statusChanges.hunger).toBe(-1)
  })

  it('a drunk heads for the bar at nine in the morning; sober, the same schedule keeps them home', () => {
    // At 9:00 the schedule says home (0–11) and the bar shift (17–02) is hours
    // away, so the bias is the only thing that can send anyone to the bar.
    const gameTime = makeGameTime({ hour: 9 })
    const alwaysPresent = () => 0
    const drunk = makeFull({ id: 'drunk_protagonist', statusOverrides: { sobriety: 10 } })
    const sober = makeFull({ id: 'sober_protagonist', statusOverrides: { sobriety: 80 } })
    expect(
      simulationTick({ tuning, characters: [drunk], gameTime, rng: alwaysPresent })[0].locationId
    ).toBe('bar')
    expect(
      simulationTick({ tuning, characters: [sober], gameTime, rng: alwaysPresent })[0].locationId
    ).toBe('home')
  })

  it('the drunk line is sobriety 30: at it they keep their schedule, under it they do not', () => {
    const gameTime = makeGameTime({ hour: 9 })
    const alwaysPresent = () => 0
    const at = makeFull({ id: 'at_the_line', statusOverrides: { sobriety: 30 } })
    const under = makeFull({ id: 'under_the_line', statusOverrides: { sobriety: 29 } })
    expect(
      simulationTick({ tuning, characters: [at], gameTime, rng: alwaysPresent })[0].locationId
    ).toBe('home')
    expect(
      simulationTick({ tuning, characters: [under], gameTime, rng: alwaysPresent })[0].locationId
    ).toBe('bar')
  })

  it('full-sim character with no status tracks no decay', () => {
    const char = { ...makeFull('ghost'), status: null }
    const updates = simulationTick({
      tuning,
      characters: [char],
      gameTime: makeGameTime({ hour: 3 }),
      rng: randomSeeded({ seed: 1 }),
    })
    expect(updates[0].statusChanges).toBeUndefined()
  })
})

// --- simulationTick: mixed characters ---

describe('simulationTick — multiple characters', () => {
  it('handles all three tiers in one call', () => {
    const chars = [
      makeFixed({ id: 'bartender' }),
      makeRoutine('carl'),
      makeFull({ id: 'protagonist' }),
    ]
    const gameTime = makeGameTime({ hour: 20 })
    const updates = simulationTick({
      tuning,
      characters: chars,
      gameTime,
      rng: randomSeeded({ seed: 42 }),
    })
    expect(updates).toHaveLength(3)
    expect(updates.map((u) => u.id)).toEqual(['bartender', 'carl', 'protagonist'])
  })

  it('is reproducible with seeded RNG', () => {
    const chars = [makeFixed({ id: 'a' }), makeFixed({ id: 'b' }), makeFixed({ id: 'c' })]
    const gameTime = makeGameTime({ hour: 20 })
    const run1 = simulationTick({
      tuning,
      characters: chars,
      gameTime,
      rng: randomSeeded({ seed: 99 }),
    })
    const run2 = simulationTick({
      tuning,
      characters: chars,
      gameTime,
      rng: randomSeeded({ seed: 99 }),
    })
    expect(run1.map((u) => u.locationId)).toEqual(run2.map((u) => u.locationId))
  })
})

// --- Integration: 24-hour simulation ---

describe('simulationTick — 24-hour integration (96 ticks)', () => {
  it('carl moves through his schedule over a full day', () => {
    const carl = makeRoutine('carl')
    const rng = randomSeeded({ seed: 7 })
    let clock = clockCreate({ tuning }) // Monday 8:00 AM, tick 0

    const locationLog = []

    for (let i = 0; i < 96; i++) {
      const updates = simulationTick({ tuning, characters: [carl], gameTime: clock, rng })
      locationLog.push(updates[0].locationId)
      clock = clockAdvance({ tuning, gameTime: clock, ticks: 1 })
    }

    // Carl should have visited work (9-17), bar (17-23), and home (23-9) over the day
    const locationsVisited = new Set(locationLog.filter(Boolean))
    expect(locationsVisited.has('work')).toBe(true)
    expect(locationsVisited.has('bar')).toBe(true)
    expect(locationsVisited.has('home')).toBe(true)
  })
})

// --- A span of ticks: everyone lives the time the player spent ---

describe('simulationTick — a span of ticks ends where the time is', () => {
  const status = { hunger: 50, energy: 50, mood: 41, health: 90 }
  const carl = { ...makeRoutine('carl'), status }
  const at = ({ hour, minute = 0 }) => {
    // The absolute tick for a Monday time, so the walk back stays on the clock.
    const tick = (hour - tuning.clock.startHour) * tuning.clock.ticksPerHour + minute / 15
    return { ...makeGameTime({ hour, minute }), tick }
  }

  it('the position is where they are at the end, not where they started', () => {
    // From 16:15 to 18:00 carl leaves work for the bar; at the end he is at the bar.
    const [update] = simulationTick({
      tuning,
      characters: [carl],
      gameTime: at({ hour: 18 }),
      ticksElapsed: 7,
      rng: () => 0,
    })
    expect(update.locationId).toBe('bar')
  })

  it('the wear adds up over the span, tick by tick', () => {
    const [one] = simulationTick({
      tuning,
      characters: [carl],
      gameTime: at({ hour: 12 }),
      ticksElapsed: 1,
      rng: () => 0,
    })
    const [eight] = simulationTick({
      tuning,
      characters: [carl],
      gameTime: at({ hour: 12 }),
      ticksElapsed: 8,
      rng: () => 0,
    })
    expect(eight.statusChanges.hunger).toBeCloseTo(one.statusChanges.hunger * 8, 5)
  })

  it('mood drifts to its baseline and stops there, instead of sailing past it', () => {
    const [update] = simulationTick({
      tuning,
      characters: [carl],
      gameTime: at({ hour: 12 }),
      ticksElapsed: 16,
      rng: () => 0,
    })
    expect(status.mood + (update.statusChanges.mood ?? 0)).toBe(tuning.decay.mood.baseline)
  })

  it('the vitals are held to their bounds along the way, so the change never overshoots', () => {
    const starving = { ...carl, status: { ...status, hunger: 3 } }
    const [update] = simulationTick({
      tuning,
      characters: [starving],
      gameTime: at({ hour: 12 }),
      ticksElapsed: 8,
      rng: () => 0,
    })
    expect(update.statusChanges.hunger).toBe(-3)
  })

  it('every stop on the way gives what it gives: doses from each bar tick', () => {
    const bar = tuning.simulation.stops.bar
    const regular = {
      ...carl,
      schedule: makeSchedule([
        {
          locationId: 'bar',
          type: 'bar',
          startHour: 0,
          endHour: 24,
          probability: 1,
          days: ['all'],
        },
      ]),
    }
    const [update] = simulationTick({
      tuning,
      characters: [regular],
      gameTime: at({ hour: 12 }),
      ticksElapsed: 3,
      rng: () => 0,
    })
    expect(update.doses).toEqual([...bar.dosesPerTick, ...bar.dosesPerTick, ...bar.dosesPerTick])
  })
})

// --- Performance: 50 characters in < 5ms ---

describe('simulationTick — performance', () => {
  it('simulates 50 characters (40 fixed, 8 routine, 2 full) in < 5ms', () => {
    const chars = [
      ...Array.from(Array(40).keys(), (i) => makeFixed({ id: `fixed_${i}` })),
      ...Array.from(Array(8).keys(), (i) => makeRoutine(`routine_${i}`)),
      ...Array.from(Array(2).keys(), (i) => makeFull({ id: `full_${i}` })),
    ]
    const gameTime = makeGameTime({ hour: 20 })
    const rng = randomSeeded({ seed: 1 })

    const start = performance.now()
    simulationTick({ tuning, characters: chars, gameTime, rng })
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
      decisionWeights: Object.fromEntries([['low_hunger', { bias: 'food', weight: 1 }]]),
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
      simulationTick({
        tuning,
        characters: [char],
        gameTime: { hour: 12, minute: 0, tick: 0, day: 1, dayOfWeek },
        rng: () => 0,
      })[0].locationId
    expect(onDay('saturday')).toBe('saturday_food_cart')
    expect(onDay('tuesday')).not.toBe('saturday_food_cart')
  })
})
