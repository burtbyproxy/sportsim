import { describe, it, expect } from 'vitest'
import {
  SKILL_ERROR_CODES,
  CHECK_ITEM_SOURCES,
  skillCellCreate,
  skillCellGet,
  skillEffective,
  skillGain,
  skillCheckRoll,
} from './skills.js'
import { blendSober, SOBER_PERSONA_ID, PERSONA_SOURCES } from './blend.js'
import { STAT_ITEM_SOURCES } from './dice.js'
import { numberSum } from '../utils/number.js'

// --- Fixtures ---

const mediums = {
  painting: { id: 'painting', display: 'Painting', stat: 'creativity' },
  carving: { id: 'carving', display: 'Carving', stat: 'toughness' },
}

function makePlayer({ skills = {}, blend = blendSober(), stats = {} } = {}) {
  return {
    stats: {
      creativity: { base: 10, modifiers: [], xp: 0 },
      toughness: { base: 20, modifiers: [], xp: 0 },
      ...stats,
    },
    psyche: { traumas: [], obsessions: [], insanities: [], abilities: [] },
    intoxications: {},
    habituations: {},
    blend,
    skills,
  }
}

/** Modifier sources added up per stat. */
function modifiersByStat({ modifierSources }) {
  const byStat = {}
  for (const m of modifierSources) byStat[m.stat] = (byStat[m.stat] ?? 0) + m.value
  return byStat
}

/** A blend of the given persona weights; sober takes the rest. */
function blendOf({ weights, modifierSources = [] }) {
  const total = numberSum({ values: weights.map((w) => w.weight) })
  return {
    ...blendSober(),
    weights: weights.map((w) => ({
      personaId: w.personaId,
      weight: w.weight,
      source: PERSONA_SOURCES.substance,
      sourceId: w.personaId,
    })),
    soberWeight: parseFloat(Math.max(0, 1 - total).toFixed(2)),
    dominantPersonaId: weights[0]?.weight > 1 - total ? weights[0].personaId : SOBER_PERSONA_ID,
    modifierSources,
    modifiers: modifiersByStat({ modifierSources }),
  }
}

const cell = ({ base, xp = 0 }) => ({ base, modifiers: [], xp })

// --- skillCellCreate / skillCellGet ---

describe('skillCellCreate', () => {
  it('is an untrained cell', () => {
    expect(skillCellCreate()).toEqual({ base: 0, modifiers: [], xp: 0 })
  })
})

describe('skillCellGet', () => {
  it('returns a fresh cell for a medium nobody has trained', () => {
    expect(
      skillCellGet({ player: makePlayer(), mediumId: 'painting', personaId: 'sober' })
    ).toEqual(skillCellCreate())
  })

  it('returns a fresh cell for a persona that never touched a trained medium', () => {
    const player = makePlayer({ skills: { painting: { sober: cell({ base: 30 }) } } })
    expect(skillCellGet({ player, mediumId: 'painting', personaId: 'telepath' })).toEqual(
      skillCellCreate()
    )
  })

  it('returns a copy of a trained cell, not the cell itself', () => {
    const player = makePlayer({ skills: { painting: { sober: cell({ base: 30, xp: 4 }) } } })
    const got = skillCellGet({ player, mediumId: 'painting', personaId: 'sober' })
    expect(got).toEqual({ base: 30, modifiers: [], xp: 4 })
    got.base = 99
    expect(player.skills.painting.sober.base).toBe(30)
  })

  it('does not write the grid when reading an untrained cell', () => {
    const player = makePlayer()
    skillCellGet({ player, mediumId: 'painting', personaId: 'sober' })
    expect(player.skills).toEqual({})
  })
})

// --- skillEffective ---

describe('skillEffective', () => {
  it('rejects a missing player', () => {
    const result = skillEffective({ player: null, mediumId: 'painting', mediums })
    expect(result.error.code).toBe(SKILL_ERROR_CODES.playerMissing)
  })

  it('rejects an unknown medium', () => {
    const result = skillEffective({ player: makePlayer(), mediumId: 'macrame', mediums })
    expect(result.error.code).toBe(SKILL_ERROR_CODES.mediumUnknown)
  })

  it('a sober player reads the sober cell alone', () => {
    const player = makePlayer({
      skills: { painting: { sober: cell({ base: 40 }), telepath: cell({ base: 80 }) } },
    })
    const { data } = skillEffective({ player, mediumId: 'painting', mediums })
    expect(data.value).toBe(40)
    expect(data.contributions).toEqual([{ personaId: 'sober', weight: 1, cellValue: 40 }])
  })

  it('a blend reads the weighted average of the cells it touches', () => {
    const player = makePlayer({
      skills: {
        painting: {
          sober: cell({ base: 40 }),
          telepath: cell({ base: 80 }),
          priest: cell({ base: 10 }),
        },
      },
      blend: blendOf({
        weights: [
          { personaId: 'telepath', weight: 0.4 },
          { personaId: 'priest', weight: 0.4 },
        ],
      }),
    })
    const { data } = skillEffective({ player, mediumId: 'painting', mediums })
    // 0.4*80 + 0.4*10 + 0.2*40 = 32 + 4 + 8
    expect(data.value).toBe(44)
    expect(data.contributions).toEqual([
      { personaId: 'telepath', weight: 0.4, cellValue: 80 },
      { personaId: 'priest', weight: 0.4, cellValue: 10 },
      { personaId: 'sober', weight: 0.2, cellValue: 40 },
    ])
  })

  it('carving drunk all winter makes you no painter', () => {
    const player = makePlayer({
      skills: { carving: { priest: cell({ base: 70 }) } },
      blend: blendOf({ weights: [{ personaId: 'priest', weight: 0.6 }] }),
    })
    expect(skillEffective({ player, mediumId: 'carving', mediums }).data.value).toBe(42)
    expect(skillEffective({ player, mediumId: 'painting', mediums }).data.value).toBe(0)
  })

  it('sober skill does not carry over to a persona that has not practised', () => {
    const player = makePlayer({
      skills: { painting: { sober: cell({ base: 60 }) } },
      blend: blendOf({ weights: [{ personaId: 'telepath', weight: 1 }] }),
    })
    expect(skillEffective({ player, mediumId: 'painting', mediums }).data.value).toBe(0)
  })

  it('cell modifiers count toward the cell value', () => {
    const player = makePlayer({
      skills: {
        painting: { sober: { base: 30, modifiers: [{ source: 'brush', value: 5 }], xp: 0 } },
      },
    })
    expect(skillEffective({ player, mediumId: 'painting', mediums }).data.value).toBe(35)
  })
})

// --- skillGain ---

describe('skillGain', () => {
  it('rejects a missing player, an unknown medium, and a bad amount', () => {
    expect(skillGain({ player: null, mediumId: 'painting', mediums, amount: 5 }).error.code).toBe(
      SKILL_ERROR_CODES.playerMissing
    )
    expect(
      skillGain({ player: makePlayer(), mediumId: 'macrame', mediums, amount: 5 }).error.code
    ).toBe(SKILL_ERROR_CODES.mediumUnknown)
    for (const amount of [0, -1, NaN, undefined]) {
      expect(
        skillGain({ player: makePlayer(), mediumId: 'painting', mediums, amount }).error.code
      ).toBe(SKILL_ERROR_CODES.amountInvalid)
    }
  })

  it('a sober player trains the sober cell alone', () => {
    const { data } = skillGain({ player: makePlayer(), mediumId: 'painting', mediums, amount: 6 })
    expect(data.cells).toEqual({ sober: cell({ base: 0, xp: 6 }) })
    expect(data.allocations).toEqual([{ personaId: 'sober', xp: 6 }])
    expect(data.personaIdsLeveled).toEqual([])
  })

  it('a blend splits the experience by weight across the cells it touches', () => {
    const player = makePlayer({
      blend: blendOf({
        weights: [
          { personaId: 'telepath', weight: 0.4 },
          { personaId: 'priest', weight: 0.4 },
        ],
      }),
    })
    const { data } = skillGain({ player, mediumId: 'painting', mediums, amount: 5 })
    expect(data.allocations).toEqual([
      { personaId: 'telepath', xp: 2 },
      { personaId: 'priest', xp: 2 },
      { personaId: 'sober', xp: 1 },
    ])
    expect(data.cells).toEqual({
      telepath: cell({ base: 0, xp: 2 }),
      priest: cell({ base: 0, xp: 2 }),
      sober: cell({ base: 0, xp: 1 }),
    })
  })

  it('a cell levels on its own threshold and carries the remainder', () => {
    // untrained threshold is 10 + 0*2 = 10
    const { data } = skillGain({ player: makePlayer(), mediumId: 'painting', mediums, amount: 13 })
    expect(data.cells.sober).toEqual(cell({ base: 1, xp: 3 }))
    expect(data.personaIdsLeveled).toEqual(['sober'])
  })

  it('leaves cells the blend does not touch exactly as they were', () => {
    const player = makePlayer({
      skills: { painting: { priest: cell({ base: 25, xp: 7 }) } },
      blend: blendOf({ weights: [{ personaId: 'telepath', weight: 1 }] }),
    })
    const { data } = skillGain({ player, mediumId: 'painting', mediums, amount: 4 })
    expect(data.cells.priest).toEqual(cell({ base: 25, xp: 7 }))
    expect(data.cells.telepath).toEqual(cell({ base: 0, xp: 4 }))
    expect(data.cells.sober).toBeUndefined()
  })

  it('does not touch other mediums or mutate the player', () => {
    const player = makePlayer({ skills: { carving: { sober: cell({ base: 9 }) } } })
    const snapshot = JSON.stringify(player)
    const { data } = skillGain({ player, mediumId: 'painting', mediums, amount: 4 })
    expect(data.cells.carving).toBeUndefined()
    expect(JSON.stringify(player)).toBe(snapshot)
  })
})

// --- skillCheckRoll ---

describe('skillCheckRoll', () => {
  const maxDie = () => 0.9999 // natural 20
  const minDie = () => 0 // natural 1
  const midDie = () => 0.5 // natural 11

  it('rejects a missing player, an unknown medium, and a bad dc', () => {
    expect(skillCheckRoll({ player: null, mediumId: 'painting', mediums, dc: 10 }).error.code).toBe(
      SKILL_ERROR_CODES.playerMissing
    )
    expect(
      skillCheckRoll({ player: makePlayer(), mediumId: 'macrame', mediums, dc: 10 }).error.code
    ).toBe(SKILL_ERROR_CODES.mediumUnknown)
    expect(
      skillCheckRoll({ player: makePlayer(), mediumId: 'painting', mediums, dc: NaN }).error.code
    ).toBe(SKILL_ERROR_CODES.dcInvalid)
  })

  it('adds the skill modifier and the medium stat modifier to the die', () => {
    const player = makePlayer({ skills: { painting: { sober: cell({ base: 35 }) } } })
    // skill 35 → +3; creativity 10 → +1; die 11 → 15
    const { data } = skillCheckRoll({ player, mediumId: 'painting', mediums, dc: 15, rng: midDie })
    expect(data).toMatchObject({
      natural: 11,
      skillModifier: 3,
      statModifier: 1,
      modifier: 4,
      total: 15,
      dc: 15,
      success: true,
      mediumId: 'painting',
      stat: 'creativity',
      skillValue: 35,
    })
  })

  it('takes any number of situational modifiers, each kept by name', () => {
    const player = makePlayer()
    const modifiers = [
      { sourceId: 'good_light', value: 2 },
      { sourceId: 'dave_the_cat', value: -1 },
      { sourceId: 'brut_aftershave', value: 1 },
      { sourceId: 'mom_upstairs', value: -2 },
    ]
    const { data } = skillCheckRoll({
      player,
      mediumId: 'painting',
      mediums,
      dc: 10,
      modifiers,
      rng: midDie,
    })
    expect(data.modifier).toBe(1 + 0) // creativity +1, skill +0, situational net 0
    expect(data.modifierItems.filter((i) => i.source === CHECK_ITEM_SOURCES.situational)).toEqual([
      { source: 'situational', sourceId: 'good_light', value: 2 },
      { source: 'situational', sourceId: 'dave_the_cat', value: -1 },
      { source: 'situational', sourceId: 'brut_aftershave', value: 1 },
      { source: 'situational', sourceId: 'mom_upstairs', value: -2 },
    ])
  })

  it('itemizes every skill cell, every stat source, and every persona touching the stat', () => {
    const player = makePlayer({
      skills: { painting: { telepath: cell({ base: 50 }), sober: cell({ base: 20 }) } },
      blend: blendOf({
        weights: [{ personaId: 'telepath', weight: 0.5 }],
        modifierSources: [
          {
            personaId: 'telepath',
            source: 'substance',
            sourceId: 'weed',
            stat: 'creativity',
            value: 4,
          },
        ],
      }),
    })
    player.stats.creativity.modifiers = [{ source: 'grandmas_paints', value: 2, duration: null }]
    const { data } = skillCheckRoll({ player, mediumId: 'painting', mediums, dc: 10, rng: midDie })
    expect(data.modifierItems).toEqual([
      { source: CHECK_ITEM_SOURCES.skill, sourceId: 'telepath', value: 25 },
      { source: CHECK_ITEM_SOURCES.skill, sourceId: 'sober', value: 10 },
      { source: STAT_ITEM_SOURCES.base, sourceId: 'creativity', value: 10 },
      { source: STAT_ITEM_SOURCES.modifier, sourceId: 'grandmas_paints', value: 2 },
      { source: 'substance', sourceId: 'telepath', value: 4 },
    ])
    // skill 35 → +3; creativity 16 → +1
    expect(data.skillModifier).toBe(3)
    expect(data.statModifier).toBe(1)
  })

  it('reports criticals off the natural die', () => {
    const player = makePlayer()
    expect(
      skillCheckRoll({ player, mediumId: 'painting', mediums, dc: 30, rng: maxDie }).data
    ).toMatchObject({ natural: 20, criticalSuccess: true, criticalFailure: false, success: false })
    expect(
      skillCheckRoll({ player, mediumId: 'painting', mediums, dc: 1, rng: minDie }).data
    ).toMatchObject({ natural: 1, criticalSuccess: false, criticalFailure: true, success: true })
  })

  it('uses the medium stat, not creativity, for a medium that leans elsewhere', () => {
    const player = makePlayer() // toughness 20 → +2
    const { data } = skillCheckRoll({ player, mediumId: 'carving', mediums, dc: 10, rng: midDie })
    expect(data.stat).toBe('toughness')
    expect(data.statModifier).toBe(2)
  })
})
