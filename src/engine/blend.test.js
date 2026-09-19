import { describe, it, expect } from 'vitest'
import {
  BLEND_ERROR_CODES,
  SOBER_PERSONA_ID,
  PERSONA_SOURCES,
  blendSober,
  blendCompute,
  blendDecay,
  dosesApply,
  sobrietyDerive,
} from './blend.js'
import { randomSeeded } from '../utils/random.js'

// --- Fixtures ---

const whiskey = {
  id: 'whiskey',
  display: 'Whiskey',
  family: 'alcohol',
  persona: { id: 'priest', display: 'The priest' },
  decayPerTick: 2,
  habituationRate: 0.1,
  habituationDecayPerTick: 0.5,
  withdrawal: {
    habituationAtLeast: 40,
    intoxicationBelow: 5,
    persona: { id: 'shakes', display: 'The shakes' },
    modifiers: [
      { stat: 'toughness', value: -3 },
      { stat: 'creativity', value: 2 },
    ],
  },
  bands: [
    {
      atLeast: 15,
      modifiers: [
        { stat: 'charm', value: 3 },
        { stat: 'wits', value: -3 },
      ],
    },
    {
      atLeast: 50,
      modifiers: [
        { stat: 'toughness', value: 5 },
        { stat: 'wits', value: -8 },
      ],
    },
  ],
}

const weed = {
  id: 'weed',
  display: 'Weed',
  family: 'cannabis',
  persona: { id: 'telepath', display: 'The telepath' },
  decayPerTick: 3,
  habituationRate: 0,
  habituationDecayPerTick: 0,
  withdrawal: null,
  bands: [
    {
      atLeast: 10,
      modifiers: [
        { stat: 'creativity', value: 4 },
        { stat: 'charm', value: -3 },
      ],
    },
  ],
}

const starving = {
  id: 'starving',
  display: 'Starving',
  source: { status: 'hunger', below: 15 },
  weight: 0.3,
  persona: { id: 'hollow', display: 'Hollow' },
  modifiers: [
    { stat: 'wits', value: -3 },
    { stat: 'creativity', value: 3 },
  ],
}

const elated = {
  id: 'elated',
  display: 'Elated',
  source: { status: 'mood', above: 80 },
  weight: 0.2,
  persona: { id: 'golden', display: 'Golden' },
  modifiers: [
    { stat: 'charm', value: 3 },
    { stat: 'wits', value: -1 },
  ],
}

const substances = { whiskey, weed }
const conditions = { starving, elated }

function makePlayer({ intoxications = {}, habituations = {}, status = {} } = {}) {
  return {
    intoxications,
    habituations,
    status: { hunger: 50, energy: 80, mood: 40, health: 100, money: 0, ...status },
  }
}

// --- blendSober / sobrietyDerive ---

describe('blendSober', () => {
  it('is the blend of a player nothing is acting on', () => {
    expect(blendSober()).toEqual({
      weights: [],
      dominantPersonaId: SOBER_PERSONA_ID,
      soberWeight: 1,
      modifiers: {},
      modifierSources: [],
      families: {},
    })
  })
})

describe('sobrietyDerive', () => {
  it('is 100 with nothing in the bloodstream', () => {
    expect(sobrietyDerive({ intoxications: {} })).toBe(100)
  })

  it('is 100 minus the sum of every intoxication', () => {
    expect(sobrietyDerive({ intoxications: { whiskey: 40, weed: 25 } })).toBe(35)
  })

  it('floors at 0 when the sum passes 100', () => {
    expect(sobrietyDerive({ intoxications: { whiskey: 80, weed: 60 } })).toBe(0)
  })
})

// --- blendCompute ---

describe('blendCompute', () => {
  it('rejects a missing player with PLAYER_MISSING', () => {
    const result = blendCompute({ player: null, substances, conditions })
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe(BLEND_ERROR_CODES.PLAYER_MISSING)
  })

  it('rejects an intoxication naming no known substance', () => {
    const player = makePlayer({ intoxications: { absinthe: 20 } })
    const result = blendCompute({ player, substances, conditions })
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe(BLEND_ERROR_CODES.SUBSTANCE_UNKNOWN)
    expect(result.error.message).toContain('absinthe')
  })

  it('is sober when nothing acts on the player', () => {
    const result = blendCompute({ player: makePlayer(), substances, conditions })
    expect(result.ok).toBe(true)
    expect(result.data).toEqual(blendSober())
  })

  it('weights a single substance by its intoxication over one hundred', () => {
    const player = makePlayer({ intoxications: { whiskey: 40 } })
    const { data } = blendCompute({ player, substances, conditions })
    expect(data.weights).toEqual([
      { personaId: 'priest', weight: 0.4, source: PERSONA_SOURCES.SUBSTANCE, sourceId: 'whiskey' },
    ])
    expect(data.soberWeight).toBe(0.6)
    expect(data.dominantPersonaId).toBe(SOBER_PERSONA_ID)
    expect(data.families).toEqual({ alcohol: 0.4 })
  })

  it('forty whiskey, forty weed, twenty you', () => {
    const player = makePlayer({ intoxications: { whiskey: 40, weed: 40 } })
    const { data } = blendCompute({ player, substances, conditions })
    expect(data.soberWeight).toBe(0.2)
    expect(data.weights.map((w) => w.weight)).toEqual([0.4, 0.4])
    expect(data.families).toEqual({ alcohol: 0.4, cannabis: 0.4 })
    expect(data.dominantPersonaId).not.toBe(SOBER_PERSONA_ID)
  })

  it('normalises when the total passes one and sober drops to zero', () => {
    const player = makePlayer({ intoxications: { whiskey: 80, weed: 80 } })
    const { data } = blendCompute({ player, substances, conditions })
    expect(data.soberWeight).toBe(0)
    expect(data.weights.map((w) => w.weight)).toEqual([0.5, 0.5])
  })

  it('applies only the highest band a substance has reached', () => {
    const light = makePlayer({ intoxications: { whiskey: 20 } })
    expect(blendCompute({ player: light, substances, conditions }).data.modifiers).toEqual({
      charm: 3,
      wits: -3,
    })
    const heavy = makePlayer({ intoxications: { whiskey: 60 } })
    expect(blendCompute({ player: heavy, substances, conditions }).data.modifiers).toEqual({
      toughness: 5,
      wits: -8,
    })
  })

  it('applies no band below the first threshold but still carries the weight', () => {
    const player = makePlayer({ intoxications: { whiskey: 5 } })
    const { data } = blendCompute({ player, substances, conditions })
    expect(data.modifiers).toEqual({})
    expect(data.weights[0].weight).toBe(0.05)
  })

  it('sums modifiers across substances and conditions', () => {
    const player = makePlayer({
      intoxications: { whiskey: 20, weed: 20 },
      status: { hunger: 10 },
    })
    const { data } = blendCompute({ player, substances, conditions })
    // whiskey: charm +3, wits -3; weed: creativity +4, charm -3; starving: wits -3, creativity +3
    expect(data.modifiers).toEqual({ charm: 0, wits: -6, creativity: 7 })
  })

  it('itemizes every modifier by the persona that brought it', () => {
    const player = makePlayer({
      intoxications: { whiskey: 20, weed: 20 },
      habituations: {},
      status: { hunger: 10 },
    })
    const { data } = blendCompute({ player, substances, conditions })
    expect(data.modifierSources).toEqual([
      { personaId: 'priest', source: 'substance', sourceId: 'whiskey', stat: 'charm', value: 3 },
      { personaId: 'priest', source: 'substance', sourceId: 'whiskey', stat: 'wits', value: -3 },
      {
        personaId: 'telepath',
        source: 'substance',
        sourceId: 'weed',
        stat: 'creativity',
        value: 4,
      },
      { personaId: 'telepath', source: 'substance', sourceId: 'weed', stat: 'charm', value: -3 },
      { personaId: 'hollow', source: 'condition', sourceId: 'starving', stat: 'wits', value: -3 },
      {
        personaId: 'hollow',
        source: 'condition',
        sourceId: 'starving',
        stat: 'creativity',
        value: 3,
      },
    ])
    const summed = {}
    for (const m of data.modifierSources) summed[m.stat] = (summed[m.stat] ?? 0) + m.value
    expect(summed).toEqual(data.modifiers)
  })

  it('withdrawal modifiers are itemized under the withdrawal persona', () => {
    const player = makePlayer({ habituations: { whiskey: 50 } })
    const { data } = blendCompute({ player, substances, conditions })
    expect(data.modifierSources).toEqual([
      {
        personaId: 'shakes',
        source: 'withdrawal',
        sourceId: 'whiskey',
        stat: 'toughness',
        value: -3,
      },
      {
        personaId: 'shakes',
        source: 'withdrawal',
        sourceId: 'whiskey',
        stat: 'creativity',
        value: 2,
      },
    ])
  })

  it('a dead heat with sober goes to sober; one point more and the persona is in charge', () => {
    const tied = makePlayer({ intoxications: { whiskey: 50 } })
    expect(blendCompute({ player: tied, substances, conditions }).data.dominantPersonaId).toBe(
      SOBER_PERSONA_ID
    )
    const tipped = makePlayer({ intoxications: { whiskey: 51 } })
    expect(blendCompute({ player: tipped, substances, conditions }).data.dominantPersonaId).toBe(
      'priest'
    )
  })

  it('names the heaviest persona dominant when it outweighs sober', () => {
    const player = makePlayer({ intoxications: { whiskey: 55, weed: 30 } })
    const { data } = blendCompute({ player, substances, conditions })
    expect(data.dominantPersonaId).toBe('priest')
  })

  it('a condition below its status threshold contributes its weight and persona', () => {
    const player = makePlayer({ status: { hunger: 10 } })
    const { data } = blendCompute({ player, substances, conditions })
    expect(data.weights).toEqual([
      { personaId: 'hollow', weight: 0.3, source: PERSONA_SOURCES.CONDITION, sourceId: 'starving' },
    ])
    expect(data.soberWeight).toBe(0.7)
    expect(data.families).toEqual({})
  })

  it('a condition above its status threshold contributes too', () => {
    const player = makePlayer({ status: { mood: 90 } })
    const { data } = blendCompute({ player, substances, conditions })
    expect(data.weights[0].personaId).toBe('golden')
    expect(data.modifiers).toEqual({ charm: 3, wits: -1 })
  })

  it('a condition exactly at its threshold is not active', () => {
    const player = makePlayer({ status: { hunger: 15, mood: 80 } })
    const { data } = blendCompute({ player, substances, conditions })
    expect(data.weights).toEqual([])
  })

  it('withdrawal acts when habituated and short of the substance', () => {
    const player = makePlayer({ intoxications: {}, habituations: { whiskey: 50 } })
    const { data } = blendCompute({ player, substances, conditions })
    expect(data.weights).toEqual([
      { personaId: 'shakes', weight: 0.5, source: PERSONA_SOURCES.WITHDRAWAL, sourceId: 'whiskey' },
    ])
    expect(data.modifiers).toEqual({ toughness: -3, creativity: 2 })
    expect(data.families).toEqual({})
  })

  it('withdrawal stops once the substance is back in the bloodstream', () => {
    const player = makePlayer({ intoxications: { whiskey: 10 }, habituations: { whiskey: 50 } })
    const { data } = blendCompute({ player, substances, conditions })
    expect(data.weights.map((w) => w.source)).toEqual([PERSONA_SOURCES.SUBSTANCE])
  })

  it('withdrawal needs the habituation threshold', () => {
    const player = makePlayer({ habituations: { whiskey: 39 } })
    const { data } = blendCompute({ player, substances, conditions })
    expect(data.weights).toEqual([])
  })

  it('a substance with no withdrawal never withdraws', () => {
    const player = makePlayer({ habituations: { weed: 100 } })
    const { data } = blendCompute({ player, substances, conditions })
    expect(data.weights).toEqual([])
  })

  it('does not mutate the player', () => {
    const player = makePlayer({ intoxications: { whiskey: 40 }, status: { hunger: 10 } })
    const snapshot = JSON.stringify(player)
    blendCompute({ player, substances, conditions })
    expect(JSON.stringify(player)).toBe(snapshot)
  })
})

// --- blendDecay ---

describe('blendDecay', () => {
  it('rejects a missing player', () => {
    const result = blendDecay({ player: null, substances, ticksElapsed: 1 })
    expect(result.error.code).toBe(BLEND_ERROR_CODES.PLAYER_MISSING)
  })

  it('rejects negative or non-numeric ticks with TICKS_INVALID', () => {
    const player = makePlayer()
    expect(blendDecay({ player, substances, ticksElapsed: -1 }).error.code).toBe(
      BLEND_ERROR_CODES.TICKS_INVALID
    )
    expect(blendDecay({ player, substances, ticksElapsed: NaN }).error.code).toBe(
      BLEND_ERROR_CODES.TICKS_INVALID
    )
  })

  it('rejects an unknown substance', () => {
    const player = makePlayer({ habituations: { mead: 10 } })
    expect(blendDecay({ player, substances, ticksElapsed: 1 }).error.code).toBe(
      BLEND_ERROR_CODES.SUBSTANCE_UNKNOWN
    )
  })

  it('each substance wears off on its own clock', () => {
    const player = makePlayer({ intoxications: { whiskey: 40, weed: 40 } })
    const { data } = blendDecay({ player, substances, ticksElapsed: 4 })
    expect(data.intoxicationChanges).toEqual({ whiskey: -8, weed: -12 })
  })

  it('never decays below zero', () => {
    const player = makePlayer({ intoxications: { whiskey: 3 } })
    const { data } = blendDecay({ player, substances, ticksElapsed: 10 })
    expect(data.intoxicationChanges).toEqual({ whiskey: -3 })
  })

  it('habituation fades at its own rate', () => {
    const player = makePlayer({ habituations: { whiskey: 10 } })
    const { data } = blendDecay({ player, substances, ticksElapsed: 4 })
    expect(data.habituationChanges).toEqual({ whiskey: -2 })
  })

  it('reports nothing for zero ticks', () => {
    const player = makePlayer({ intoxications: { whiskey: 40 }, habituations: { whiskey: 10 } })
    const { data } = blendDecay({ player, substances, ticksElapsed: 0 })
    expect(data).toEqual({ intoxicationChanges: {}, habituationChanges: {} })
  })

  it('does not mutate the player', () => {
    const player = makePlayer({ intoxications: { whiskey: 40 } })
    blendDecay({ player, substances, ticksElapsed: 4 })
    expect(player.intoxications.whiskey).toBe(40)
  })
})

// --- dosesApply ---

describe('dosesApply', () => {
  it('rejects a missing player', () => {
    const result = dosesApply({ player: null, substances, doses: [] })
    expect(result.error.code).toBe(BLEND_ERROR_CODES.PLAYER_MISSING)
  })

  it('rejects a dose of an unknown substance', () => {
    const result = dosesApply({
      player: makePlayer(),
      substances,
      doses: [{ substanceId: 'gin', value: 20 }],
    })
    expect(result.error.code).toBe(BLEND_ERROR_CODES.SUBSTANCE_UNKNOWN)
  })

  it('rejects a dose that is not a positive number', () => {
    for (const value of [0, -5, NaN, undefined]) {
      const result = dosesApply({
        player: makePlayer(),
        substances,
        doses: [{ substanceId: 'whiskey', value }],
      })
      expect(result.error.code).toBe(BLEND_ERROR_CODES.DOSE_INVALID)
    }
  })

  it('rejects a chance outside 0–1', () => {
    const result = dosesApply({
      player: makePlayer(),
      substances,
      doses: [{ substanceId: 'whiskey', value: 20, chance: 1.5 }],
    })
    expect(result.error.code).toBe(BLEND_ERROR_CODES.DOSE_INVALID)
  })

  it('a dose raises intoxication and habituation by the substance rate', () => {
    const { data } = dosesApply({
      player: makePlayer(),
      substances,
      doses: [{ substanceId: 'whiskey', value: 20 }],
    })
    expect(data).toEqual({
      intoxicationChanges: { whiskey: 20 },
      habituationChanges: { whiskey: 2 },
      substanceIdsTaken: ['whiskey'],
    })
  })

  it('caps intoxication at one hundred', () => {
    const player = makePlayer({ intoxications: { whiskey: 90 } })
    const { data } = dosesApply({
      player,
      substances,
      doses: [{ substanceId: 'whiskey', value: 35 }],
    })
    expect(data.intoxicationChanges).toEqual({ whiskey: 10 })
  })

  it('two doses of the same substance in one call accumulate under the cap', () => {
    const { data } = dosesApply({
      player: makePlayer({ intoxications: { whiskey: 70 } }),
      substances,
      doses: [
        { substanceId: 'whiskey', value: 20 },
        { substanceId: 'whiskey', value: 20 },
      ],
    })
    expect(data.intoxicationChanges).toEqual({ whiskey: 30 })
    expect(data.substanceIdsTaken).toEqual(['whiskey', 'whiskey'])
  })

  it('a substance with zero habituation rate never habituates', () => {
    const { data } = dosesApply({
      player: makePlayer(),
      substances,
      doses: [{ substanceId: 'weed', value: 30 }],
    })
    expect(data.habituationChanges).toEqual({})
  })

  it('a hidden dose lands only when the roll allows — and the player is not told', () => {
    const doses = [
      { substanceId: 'weed', value: 30 },
      { substanceId: 'whiskey', value: 30, chance: 0.1 },
    ]
    const never = dosesApply({ player: makePlayer(), substances, doses, rng: () => 0.99 })
    expect(never.data.substanceIdsTaken).toEqual(['weed'])
    const always = dosesApply({ player: makePlayer(), substances, doses, rng: () => 0.0 })
    expect(always.data.substanceIdsTaken).toEqual(['weed', 'whiskey'])
  })

  it('is reproducible with a seeded rng', () => {
    const doses = [{ substanceId: 'whiskey', value: 10, chance: 0.5 }]
    const run = () =>
      Array.from(
        { length: 20 },
        () =>
          dosesApply({ player: makePlayer(), substances, doses, rng: randomSeeded({ seed: 7 }) })
            .data
      )
    expect(run()).toEqual(run())
  })

  it('does not mutate the player', () => {
    const player = makePlayer()
    dosesApply({ player, substances, doses: [{ substanceId: 'whiskey', value: 20 }] })
    expect(player.intoxications).toEqual({})
    expect(player.habituations).toEqual({})
  })
})
