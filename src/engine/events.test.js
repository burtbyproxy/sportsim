import { describe, it, expect } from 'vitest'
import { eventsRandomCheck, eventsTriggeredCheck, eventResolve } from './events.js'
import { randomSeeded } from '../utils/random.js'

function makePlayer(statusOverrides = {}) {
  return {
    stats: { charm: { base: 10, modifiers: [], xp: 0 } },
    status: { hunger: 50, sobriety: 80, energy: 80, mood: 50, health: 100, ...statusOverrides },
    inventory: [],
    psyche: { traumas: [], obsessions: [], insanities: [], abilities: [] },
  }
}

function makeLocation({ id = 'test_loc', visitCount = 0 }) {
  return { id, visitCount }
}

function makeGameTime(hour = 14) {
  return { tick: 1, day: 1, hour, minute: 0, period: 'afternoon', dayOfWeek: 'monday' }
}

function makeEvent(overrides = {}) {
  return {
    id: 'test_event',
    type: 'random',
    conditions: {},
    probability: 1.0,
    oneTime: false,
    fired: false,
    narrative: 'Something happened.',
    choices: null,
    outcome: { narrative: 'Outcome.', statChanges: null },
    nextEventId: null,
    ...overrides,
  }
}

// --- eventsRandomCheck ---

describe('eventsRandomCheck', () => {
  it('returns events that pass conditions and probability', () => {
    const event = makeEvent({ probability: 1.0 })
    const result = eventsRandomCheck({
      player: makePlayer(),
      location: makeLocation({}),
      gameTime: makeGameTime(),
      events: [event],
      firedEventIds: [],
      rng: randomSeeded({ seed: 1 }),
    })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('test_event')
  })

  it('never returns events with probability 0', () => {
    const event = makeEvent({ probability: 0 })
    const result = eventsRandomCheck({
      player: makePlayer(),
      location: makeLocation({}),
      gameTime: makeGameTime(),
      events: [event],
      firedEventIds: [],
      rng: randomSeeded({ seed: 1 }),
    })
    expect(result).toHaveLength(0)
  })

  it('does not return triggered events', () => {
    const event = makeEvent({ type: 'triggered', probability: 1.0 })
    const result = eventsRandomCheck({
      player: makePlayer(),
      location: makeLocation({}),
      gameTime: makeGameTime(),
      events: [event],
      firedEventIds: [],
      rng: randomSeeded({ seed: 1 }),
    })
    expect(result).toHaveLength(0)
  })

  it('skips one-time events that already fired', () => {
    const event = makeEvent({ oneTime: true, probability: 1.0 })
    const result = eventsRandomCheck({
      player: makePlayer(),
      location: makeLocation({}),
      gameTime: makeGameTime(),
      events: [event],
      firedEventIds: ['test_event'],
      rng: randomSeeded({ seed: 1 }),
    })
    expect(result).toHaveLength(0)
  })

  it('includes one-time events that have not fired', () => {
    const event = makeEvent({ oneTime: true, probability: 1.0 })
    const result = eventsRandomCheck({
      player: makePlayer(),
      location: makeLocation({}),
      gameTime: makeGameTime(),
      events: [event],
      firedEventIds: [],
      rng: randomSeeded({ seed: 1 }),
    })
    expect(result).toHaveLength(1)
  })

  it('filters by location', () => {
    const event = makeEvent({ conditions: { locationId: 'specific_bar' }, probability: 1.0 })
    const wrongLocation = makeLocation({ id: 'wrong_place' })
    const rightLocation = makeLocation({ id: 'specific_bar' })

    const wrongResult = eventsRandomCheck({
      player: makePlayer(),
      location: wrongLocation,
      gameTime: makeGameTime(),
      events: [event],
      firedEventIds: [],
      rng: randomSeeded({ seed: 1 }),
    })
    const rightResult = eventsRandomCheck({
      player: makePlayer(),
      location: rightLocation,
      gameTime: makeGameTime(),
      events: [event],
      firedEventIds: [],
      rng: randomSeeded({ seed: 1 }),
    })

    expect(wrongResult).toHaveLength(0)
    expect(rightResult).toHaveLength(1)
  })

  it('filters by time of day', () => {
    const event = makeEvent({ conditions: { minHour: 20, maxHour: 24 }, probability: 1.0 })
    const daytimeResult = eventsRandomCheck({
      player: makePlayer(),
      location: makeLocation({}),
      gameTime: makeGameTime(14),
      events: [event],
      firedEventIds: [],
      rng: randomSeeded({ seed: 1 }),
    })
    const nightResult = eventsRandomCheck({
      player: makePlayer(),
      location: makeLocation({}),
      gameTime: makeGameTime(21),
      events: [event],
      firedEventIds: [],
      rng: randomSeeded({ seed: 1 }),
    })
    expect(daytimeResult).toHaveLength(0)
    expect(nightResult).toHaveLength(1)
  })

  it('filters by player status', () => {
    const event = makeEvent({
      conditions: { minStatus: { sobriety: 0 }, maxStatus: { sobriety: 29 } },
      probability: 1.0,
    })
    const soberPlayer = makePlayer({ sobriety: 80 })
    const drunkPlayer = makePlayer({ sobriety: 15 })

    expect(
      eventsRandomCheck({
        player: soberPlayer,
        location: makeLocation({}),
        gameTime: makeGameTime(),
        events: [event],
        firedEventIds: [],
        rng: randomSeeded({ seed: 1 }),
      })
    ).toHaveLength(0)
    expect(
      eventsRandomCheck({
        player: drunkPlayer,
        location: makeLocation({}),
        gameTime: makeGameTime(),
        events: [event],
        firedEventIds: [],
        rng: randomSeeded({ seed: 1 }),
      })
    ).toHaveLength(1)
  })
})

// --- eventsTriggeredCheck ---

describe('eventsTriggeredCheck', () => {
  it('returns triggered events when conditions met', () => {
    const event = makeEvent({ type: 'triggered', conditions: {} })
    const result = eventsTriggeredCheck({
      player: makePlayer(),
      location: makeLocation({}),
      gameTime: makeGameTime(),
      events: [event],
    })
    expect(result).toHaveLength(1)
  })

  it('does not return random events', () => {
    const event = makeEvent({ type: 'random' })
    const result = eventsTriggeredCheck({
      player: makePlayer(),
      location: makeLocation({}),
      gameTime: makeGameTime(),
      events: [event],
    })
    expect(result).toHaveLength(0)
  })

  it('skips one-time triggered events already fired', () => {
    const event = makeEvent({ type: 'triggered', oneTime: true })
    const result = eventsTriggeredCheck({
      player: makePlayer(),
      location: makeLocation({}),
      gameTime: makeGameTime(),
      events: [event],
      firedEventIds: ['test_event'],
    })
    expect(result).toHaveLength(0)
  })

  it('an event that needs an item waits until the player is holding one', () => {
    const event = makeEvent({ type: 'triggered', conditions: { requiredItems: ['karaoke_tape'] } })
    const holding = (inventory) =>
      eventsTriggeredCheck({
        player: { ...makePlayer(), inventory },
        location: makeLocation({}),
        gameTime: makeGameTime(),
        events: [event],
      })
    expect(holding([])).toHaveLength(0)
    expect(holding([{ id: 'karaoke_tape', quantity: 0 }])).toHaveLength(0)
    expect(holding([{ id: 'karaoke_tape', quantity: 1 }])).toHaveLength(1)
  })
})

// --- eventResolve ---

describe('eventResolve', () => {
  it('returns automatic outcome when no choices', () => {
    const event = makeEvent({ choices: null })
    const { outcome, diceResult } = eventResolve({
      event,
      player: makePlayer(),
      choiceIndex: null,
    }).data
    expect(outcome).toBe(event.outcome)
    expect(diceResult).toBeNull()
  })

  it('resolves player choice without dice check', () => {
    const choiceOutcome = { narrative: 'You chose wisely.', statChanges: null }
    const event = makeEvent({
      choices: [
        { label: 'Run', check: null, outcome: choiceOutcome },
        {
          label: 'Fight',
          check: null,
          outcome: { narrative: 'You chose violence.', statChanges: null },
        },
      ],
    })
    const { outcome, diceResult } = eventResolve({
      event,
      player: makePlayer(),
      choiceIndex: 0,
    }).data
    expect(outcome).toBe(choiceOutcome)
    expect(diceResult).toBeNull()
  })

  it('resolves player choice with dice check', () => {
    const player = makePlayer()
    const choiceOutcome = { narrative: 'You tried.', statChanges: null }
    const event = makeEvent({
      choices: [
        {
          label: 'Try',
          check: { stat: 'charm', dc: 1 },
          outcome: choiceOutcome,
        },
      ],
    })
    const { outcome, diceResult } = eventResolve({
      event,
      player,
      choiceIndex: 0,
      rng: randomSeeded({ seed: 1 }),
    }).data
    expect(outcome).toBe(choiceOutcome)
    expect(diceResult).toBeTruthy()
    expect(diceResult.stat).toBe('charm')
  })

  it('refuses an invalid choice index instead of applying the automatic outcome', () => {
    const event = makeEvent({
      choices: [
        { label: 'Only choice', check: null, outcome: { narrative: 'A', statChanges: null } },
      ],
    })
    // Index 99 is invalid: nobody picked the automatic outcome, so nobody gets it.
    const { data, error } = eventResolve({ event, player: makePlayer(), choiceIndex: 99 })
    expect(data).toBeNull()
    expect(error.code).toBe('CHOICE_INVALID')
  })
})

// --- location type conditions and failure outcomes on checked choices ---

describe('event conditions — locationType', () => {
  it('matches any location of the type', () => {
    const event = makeEvent({ type: 'triggered', conditions: { locationType: 'bar' } })
    const bar = { id: 'blue_parrot', type: 'bar', visitCount: 0 }
    const park = { id: 'columbia_park', type: 'park', visitCount: 0 }
    expect(
      eventsTriggeredCheck({
        player: makePlayer(),
        location: bar,
        gameTime: makeGameTime(),
        events: [event],
        firedEventIds: [],
      })
    ).toHaveLength(1)
    expect(
      eventsTriggeredCheck({
        player: makePlayer(),
        location: park,
        gameTime: makeGameTime(),
        events: [event],
        firedEventIds: [],
      })
    ).toHaveLength(0)
  })
})

describe('eventResolve — checked choice with a failure outcome', () => {
  const win = { narrative: 'Won.', statChanges: null }
  const lose = { narrative: 'Lost.', statChanges: null }
  const eventWith = (dc) =>
    makeEvent({
      choices: [{ label: 'Try', check: { stat: 'charm', dc }, outcome: win, failureOutcome: lose }],
    })

  it('a passed check yields the choice outcome', () => {
    const { outcome, diceResult } = eventResolve({
      event: eventWith(1),
      player: makePlayer(),
      choiceIndex: 0,
      rng: randomSeeded({ seed: 1 }),
    }).data
    expect(diceResult.success).toBe(true)
    expect(outcome).toBe(win)
  })

  it('a failed check yields the failure outcome', () => {
    const { outcome, diceResult } = eventResolve({
      event: eventWith(999),
      player: makePlayer(),
      choiceIndex: 0,
      rng: randomSeeded({ seed: 1 }),
    }).data
    expect(diceResult.success).toBe(false)
    expect(outcome).toBe(lose)
  })

  it('a failed check without a failure outcome falls back to the choice outcome', () => {
    const event = makeEvent({
      choices: [{ label: 'Try', check: { stat: 'charm', dc: 999 }, outcome: win }],
    })
    const { outcome } = eventResolve({
      event,
      player: makePlayer(),
      choiceIndex: 0,
      rng: randomSeeded({ seed: 1 }),
    }).data
    expect(outcome).toBe(win)
  })
})

describe('outdoors — the street happens on the street', () => {
  const street = { id: 'curb', type: 'random', probability: 1, conditions: { outdoors: true } }
  const indoors = { id: 'ceiling', type: 'random', probability: 1, conditions: { outdoors: false } }
  const either = { id: 'rain', type: 'random', probability: 1, conditions: {} }
  const registry = [street, indoors, either]
  const time = { hour: 12, tick: 0 }
  const fired = (location) =>
    eventsRandomCheck({
      player: { stats: {}, status: {} },
      location,
      gameTime: time,
      events: registry,
      firedEventIds: [],
      rng: () => 0,
    }).map((e) => e.id)

  it('a street event finds you in a parking lot and not in a basement', () => {
    expect(fired({ id: 'lot', type: 'market', outdoors: true })).toEqual(['curb', 'rain'])
    expect(fired({ id: 'basement', type: 'home', outdoors: false })).toEqual(['ceiling', 'rain'])
  })

  it('a place that never said is indoors', () => {
    expect(fired({ id: 'old_save_location', type: 'home' })).toEqual(['ceiling', 'rain'])
  })
})

describe('eventResolve — a choice the event never offered', () => {
  const event = {
    id: 'fork',
    choices: [{ label: 'left', outcome: { moneyChange: 1 } }],
    outcome: { moneyChange: -100 },
  }

  it('resolves nothing and says so, rather than applying the automatic outcome', () => {
    const result = eventResolve({ event, player: { stats: {} }, choiceIndex: 7, rng: () => 0.5 })
    expect(result.data).toBeNull()
    expect(result.error).toMatchObject({ code: 'CHOICE_INVALID', params: { choiceIndex: 7 } })
  })

  it('a real choice still resolves, and an event with no choices still resolves itself', () => {
    expect(
      eventResolve({ event, player: { stats: {} }, choiceIndex: 0, rng: () => 0.5 }).data.outcome
    ).toEqual({ moneyChange: 1 })
    const automatic = { id: 'rain', choices: [], outcome: { moneyChange: -1 } }
    expect(
      eventResolve({ event: automatic, player: { stats: {} }, choiceIndex: null, rng: () => 0.5 })
        .data.outcome
    ).toEqual({
      moneyChange: -1,
    })
  })
})
