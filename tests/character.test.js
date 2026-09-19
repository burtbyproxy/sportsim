import { describe, it, expect } from 'vitest'
import { characterCreate } from '../src/models/character.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeFixedCharacter(overrides = {}) {
  return characterCreate({
    id: 'bartender_parrot',
    name: 'The Bartender',
    description: 'A woman with a face like she has heard every story twice.',
    habit: 'Wipes the bar in slow circles.',
    voice: 'Economical. Correct change without being asked.',
    simulation: 'fixed',
    schedule: {
      entries: [
        { locationId: 'blue_parrot', startHour: 16, endHour: 2, probability: 0.95, days: ['all'] },
      ],
    },
    relationshipScore: 0,
    want: 'To close on time.',
    fear: 'The 2am crowd.',
    ...overrides,
  })
}

function makeRoutineCharacter(overrides = {}) {
  return characterCreate({
    id: 'carl',
    name: 'Carl',
    description: 'A man shaped like a question mark.',
    habit: 'Cracks knuckles.',
    voice: 'Short sentences. Wrong facts.',
    simulation: 'routine',
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
    want: 'To be right about something.',
    fear: 'Being ignored.',
    ...overrides,
  })
}

function makeFullCharacter(overrides = {}) {
  return characterCreate({
    id: 'rival',
    name: 'The Rival',
    description: 'You know them. They know you.',
    simulation: 'full',
    want: 'Recognition.',
    fear: 'Irrelevance.',
    status: { hunger: 60, sobriety: 70, energy: 65, mood: 45, health: 90 },
    decisionWeights: {
      low_sobriety: { bias: 'bar', weight: 0.7 },
      low_hunger: { bias: 'food', weight: 0.8 },
      low_mood: { bias: 'alone', weight: 0.5 },
      low_energy: null,
    },
    ...overrides,
  })
}

// ---------------------------------------------------------------------------
// characterCreate
// ---------------------------------------------------------------------------

describe('characterCreate', () => {
  it('maps all fields for a fixed character', () => {
    const c = makeFixedCharacter()
    expect(c.id).toBe('bartender_parrot')
    expect(c.name).toBe('The Bartender')
    expect(c.simulation).toBe('fixed')
    expect(c.want).toBe('To close on time.')
    expect(c.fear).toBe('The 2am crowd.')
  })

  it('fixed tier has null status by default', () => {
    const c = makeFixedCharacter()
    expect(c.status).toBeNull()
  })

  it('fixed tier retains explicit status if provided', () => {
    const c = makeFixedCharacter({
      status: { hunger: 50, sobriety: 80, energy: 70, mood: 50, health: 100 },
    })
    expect(c.status).not.toBeNull()
    expect(c.status.hunger).toBe(50)
  })

  it('routine tier gets default status when not provided', () => {
    const c = makeRoutineCharacter()
    expect(c.status).not.toBeNull()
    expect(c.status.sobriety).toBe(100)
  })

  it('full tier gets default status when not provided', () => {
    const c = characterCreate({ name: 'X', simulation: 'full' })
    expect(c.status).not.toBeNull()
  })

  it('full tier retains decisionWeights', () => {
    const c = makeFullCharacter()
    expect(c.decisionWeights).not.toBeNull()
    expect(c.decisionWeights.low_sobriety.bias).toBe('bar')
    expect(c.decisionWeights.low_energy).toBeNull()
  })

  it('non-full tiers have null decisionWeights', () => {
    expect(makeFixedCharacter().decisionWeights).toBeNull()
    expect(makeRoutineCharacter().decisionWeights).toBeNull()
  })

  it('invalid simulation tier defaults to fixed', () => {
    const c = characterCreate({ name: 'X', simulation: 'turbo' })
    expect(c.simulation).toBe('fixed')
  })

  it('missing simulation defaults to fixed', () => {
    const c = characterCreate({ name: 'X' })
    expect(c.simulation).toBe('fixed')
  })

  it('generates id when not provided', () => {
    const c = characterCreate({ name: 'X' })
    expect(c.id).toBeTruthy()
  })

  it('applies default stat values when stats not provided', () => {
    const c = characterCreate({ name: 'X' })
    expect(c.stats.charm.base).toBe(10)
    expect(c.stats.stamina.modifiers).toEqual([])
  })

  it('does not share schedule entry references with source', () => {
    const raw = {
      name: 'X',
      schedule: {
        entries: [{ locationId: 'y', startHour: 0, endHour: 24, probability: 1, days: ['all'] }],
      },
    }
    const c = characterCreate(raw)
    c.schedule.entries[0].locationId = 'CHANGED'
    expect(raw.schedule.entries[0].locationId).toBe('y')
  })

  it('serializes cleanly to JSON', () => {
    const c = makeFullCharacter()
    const restored = JSON.parse(JSON.stringify(c))
    expect(restored.simulation).toBe('full')
    expect(restored.decisionWeights.low_sobriety.weight).toBe(0.7)
  })
})
