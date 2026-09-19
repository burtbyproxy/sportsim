import { describe, it, expect } from 'vitest'
import {
  MAKING_ERROR_CODES,
  MAKING_STATUSES,
  MAKING_TIERS,
  MAKING_MODIFIER_SOURCE_IDS,
  ARTIFACT_KINDS,
  ARTIFACT_STATUSES,
  makingActive,
  makingOptions,
  makingStart,
  makingWork,
  makingFinish,
  makingAbandon,
  marksCover,
} from './making.js'
import { inspirationStrike } from './inspiration.js'
import { blendSober } from './blend.js'
import { rngForNatural, rngSequence } from '../../tests/helpers/rng.js'

const mediums = {
  painting: {
    id: 'painting',
    stat: 'creativity',
    making: {
      gameId: 'steady',
      ticksTotal: 4,
      dc: 12,
      xp: 10,
      toolRequired: true,
      takesIngredient: true,
      leavesArtifact: true,
    },
  },
  tagging: {
    id: 'tagging',
    stat: 'luck',
    making: {
      gameId: 'steady',
      ticksTotal: 1,
      dc: 12,
      xp: 5,
      toolRequired: true,
      takesIngredient: false,
      leavesArtifact: true,
    },
  },
  performance: {
    id: 'performance',
    stat: 'charm',
    making: {
      gameId: 'steady',
      ticksTotal: 2,
      dc: 13,
      xp: 8,
      toolRequired: false,
      takesIngredient: false,
      leavesArtifact: false,
    },
  },
}

const items = {
  paints: { id: 'paints', type: 'tool', mediumIds: ['painting'] },
  spray: { id: 'spray', type: 'tool', mediumIds: ['tagging', 'painting'] },
  door: { id: 'door', type: 'surface', mediumIds: ['painting'] },
  brut: { id: 'brut', type: 'ingredient' },
  sock: { id: 'sock', type: 'junk' },
}

const alley = {
  id: 'alley',
  surfaces: [
    { id: 'wall', mediumIds: ['tagging', 'painting'] },
    { id: 'corner', mediumIds: ['performance'] },
  ],
  marks: [],
}

function playerWith({
  carrying = [],
  inspired = true,
  mediumId = 'painting',
  ticksTotal = 12,
  strength = 60,
} = {}) {
  const player = {
    stats: {
      creativity: { base: 10, modifiers: [], xp: 0 },
      luck: { base: 10, modifiers: [], xp: 0 },
      charm: { base: 10, modifiers: [], xp: 0 },
    },
    psyche: { traumas: [], abilities: [] },
    blend: blendSober(),
    skills: {},
    inventory: carrying.map((id) => ({ ...items[id], quantity: 1 })),
    inspirations: [],
    makings: [],
  }
  if (inspired) {
    player.inspirations = inspirationStrike({
      player,
      source: { kind: 'event', id: 'test' },
      mediumId,
      strength,
      ticksTotal,
      gameTime: { tick: 0 },
    }).data.inspirations
  }
  return player
}

const doorPlan = {
  mediumId: 'painting',
  toolItemId: 'paints',
  surfaceKind: 'item',
  surfaceId: 'door',
}
const wallPlan = {
  mediumId: 'tagging',
  toolItemId: 'spray',
  surfaceKind: 'location',
  surfaceId: 'wall',
}

/** A die that lands on the given face. */
const die = (face) => () => rngForNatural({ natural: face })

function started({ player, plan, location = alley }) {
  const result = makingStart({
    player,
    location,
    items,
    mediums,
    plan,
    gameState: { offer: null },
    gameTime: { tick: 1 },
  })
  return { ...player, makings: result.data.makings }
}

function worked({ player, ticksWorked }) {
  return {
    ...player,
    makings: makingWork({ player, ticksWorked, gameState: { offer: null }, gameTime: { tick: 2 } })
      .data.makings,
  }
}

describe('makingOptions', () => {
  it('pairs every carried tool with every surface that takes the same medium, carried or here', () => {
    const player = playerWith({ carrying: ['paints', 'spray', 'door', 'sock'] })
    const { plans } = makingOptions({ player, location: alley, items, mediums }).data
    const keys = plans.map((p) => `${p.mediumId}:${p.toolItemId}:${p.surfaceKind}:${p.surfaceId}`)
    expect(keys.sort()).toEqual(
      [
        'painting:paints:item:door',
        'painting:paints:location:wall',
        'painting:spray:item:door',
        'painting:spray:location:wall',
        'performance:null:location:corner',
        'tagging:spray:location:wall',
      ].sort()
    )
  })

  it('puts the medium the idea asked for first', () => {
    const player = playerWith({ carrying: ['spray', 'door'], mediumId: 'tagging' })
    const { plans } = makingOptions({ player, location: alley, items, mediums }).data
    expect(plans[0].mediumId).toBe('tagging')
  })

  it('marks a plan the idea will not outlast: the clock has to beat the work, not tie it', () => {
    const player = playerWith({ carrying: ['paints', 'door'], ticksTotal: 4 })
    const { plans } = makingOptions({ player, location: alley, items, mediums }).data
    expect(plans.find((p) => p.mediumId === 'painting').enoughTime).toBe(false)
    expect(plans.find((p) => p.mediumId === 'performance').enoughTime).toBe(true)
  })

  it('a surface with hours is only there during them, overnight included', () => {
    const player = playerWith({ carrying: [], mediumId: 'performance' })
    const bar = {
      id: 'bar',
      surfaces: [
        { id: 'machine', mediumIds: ['performance'], hours: { openHour: 21, closeHour: 1 } },
      ],
    }
    const plansAt = (hour) =>
      makingOptions({ player, location: bar, items, mediums, gameTime: { hour } }).data.plans
    expect(plansAt(20)).toHaveLength(0)
    expect(plansAt(21)).toHaveLength(1)
    expect(plansAt(0)).toHaveLength(1)
    expect(plansAt(2)).toHaveLength(0)
    const plan = {
      mediumId: 'performance',
      toolItemId: null,
      surfaceKind: 'location',
      surfaceId: 'machine',
    }
    const early = makingStart({
      player,
      location: bar,
      items,
      mediums,
      plan,
      gameState: {},
      gameTime: { tick: 0, hour: 15 },
    })
    expect(early.error.code).toBe(MAKING_ERROR_CODES.SURFACE_INVALID)
  })

  it('lists carried ingredients and nothing else', () => {
    const player = playerWith({ carrying: ['brut', 'sock', 'paints'] })
    const { ingredientItemIds } = makingOptions({ player, location: alley, items, mediums }).data
    expect(ingredientItemIds).toEqual(['brut'])
  })

  it('refuses without an inspiration', () => {
    const player = playerWith({ carrying: ['paints', 'door'], inspired: false })
    const result = makingOptions({ player, location: alley, items, mediums })
    expect(result.error.code).toBe(MAKING_ERROR_CODES.INSPIRATION_NONE)
  })
})

describe('makingStart', () => {
  it('opens a record bound to the active inspiration and names what the work uses up', () => {
    const player = playerWith({ carrying: ['paints', 'door', 'brut'] })
    const result = makingStart({
      player,
      location: alley,
      items,
      mediums,
      plan: { ...doorPlan, ingredientItemId: 'brut' },
      gameState: { round: 1 },
      gameTime: { tick: 7 },
    })
    expect(result.ok).toBe(true)
    expect(result.data.making).toMatchObject({
      status: MAKING_STATUSES.IN_PROGRESS,
      inspirationId: player.inspirations[0].id,
      ticksTotal: 4,
      ticksDone: 0,
      locationId: 'alley',
      startedAtTick: 7,
      game: { id: 'steady', state: { round: 1 } },
    })
    // The surface and the ingredient go into the piece. The tool survives.
    expect(result.data.itemIdsConsumed.sort()).toEqual(['brut', 'door'])
    expect(player.makings).toEqual([])
  })

  it('a tool with one job left in it goes into the piece; any other tool survives', () => {
    const lastCan = { ...items, spray: { ...items.spray, spentOnUse: true } }
    const start = (registry) =>
      makingStart({
        player: playerWith({ carrying: ['spray'], mediumId: 'tagging' }),
        location: alley,
        items: registry,
        mediums,
        plan: wallPlan,
        gameState: {},
        gameTime: { tick: 0 },
      })
    expect(start(lastCan).data.itemIdsConsumed).toEqual(['spray'])
    expect(start(items).data.itemIdsConsumed).toEqual([])
  })

  it('uses up nothing when the surface is a wall', () => {
    const player = playerWith({ carrying: ['spray'] })
    const result = makingStart({
      player,
      location: alley,
      items,
      mediums,
      plan: wallPlan,
      gameTime: { tick: 0 },
    })
    expect(result.data.itemIdsConsumed).toEqual([])
  })

  it.each([
    ['a tool not carried', { carrying: ['door'] }, doorPlan, MAKING_ERROR_CODES.TOOL_INVALID],
    [
      'a tool for another medium',
      { carrying: ['paints'] },
      { ...wallPlan, toolItemId: 'paints' },
      MAKING_ERROR_CODES.TOOL_INVALID,
    ],
    [
      'a surface not carried',
      { carrying: ['paints'] },
      doorPlan,
      MAKING_ERROR_CODES.SURFACE_INVALID,
    ],
    [
      'a surface that is not here',
      { carrying: ['spray'] },
      { ...wallPlan, surfaceId: 'ceiling' },
      MAKING_ERROR_CODES.SURFACE_INVALID,
    ],
    [
      'a wall that does not take the medium',
      { carrying: ['spray'] },
      { ...wallPlan, surfaceId: 'corner' },
      MAKING_ERROR_CODES.SURFACE_INVALID,
    ],
    [
      'an ingredient in a medium that takes none',
      { carrying: ['spray', 'brut'] },
      { ...wallPlan, ingredientItemId: 'brut' },
      MAKING_ERROR_CODES.INGREDIENT_INVALID,
    ],
    [
      'an ingredient not carried',
      { carrying: ['paints', 'door'] },
      { ...doorPlan, ingredientItemId: 'brut' },
      MAKING_ERROR_CODES.INGREDIENT_INVALID,
    ],
    [
      'an idea that will not last',
      { carrying: ['paints', 'door'], ticksTotal: 4 },
      doorPlan,
      MAKING_ERROR_CODES.TIME_SHORT,
    ],
    [
      'an unknown medium',
      { carrying: ['paints', 'door'] },
      { ...doorPlan, mediumId: 'macrame' },
      MAKING_ERROR_CODES.MEDIUM_UNKNOWN,
    ],
  ])('refuses %s', (_, setup, plan, code) => {
    const result = makingStart({
      player: playerWith(setup),
      location: alley,
      items,
      mediums,
      plan,
      gameTime: { tick: 0 },
    })
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe(code)
  })

  it('refuses a second making while one is in progress', () => {
    const player = started({
      player: playerWith({ carrying: ['paints', 'spray', 'door'] }),
      plan: doorPlan,
    })
    const result = makingStart({
      player,
      location: alley,
      items,
      mediums,
      plan: wallPlan,
      gameTime: { tick: 2 },
    })
    expect(result.error.code).toBe(MAKING_ERROR_CODES.ALREADY_MAKING)
  })
})

describe('what a plan can cost, and who will not do it', () => {
  const shy = {
    ...mediums,
    tagging: {
      ...mediums.tagging,
      making: {
        ...mediums.tagging.making,
        refusals: [{ personaId: 'sober', reason: 'Not sober. No.' }],
      },
    },
  }
  const paidAlley = {
    ...alley,
    surfaces: [{ id: 'wall', mediumIds: ['tagging'], cost: 5 }],
  }
  const withMoney = (money) => ({
    ...playerWith({ carrying: ['spray'], mediumId: 'tagging' }),
    status: { money },
  })

  it('a surface that charges is listed with its price and whether the player can cover it', () => {
    const plan = (money) =>
      makingOptions({ player: withMoney(money), location: paidAlley, items, mediums }).data.plans[0]
    expect(plan(2)).toMatchObject({ cost: 5, affordable: false })
    expect(plan(5)).toMatchObject({ cost: 5, affordable: true })
  })

  it('starting pays up front, and refuses a player who is short', () => {
    const start = (money) =>
      makingStart({
        player: withMoney(money),
        location: paidAlley,
        items,
        mediums,
        plan: wallPlan,
        gameState: {},
        gameTime: { tick: 0 },
      })
    expect(start(4.99).error.code).toBe(MAKING_ERROR_CODES.MONEY_SHORT)
    expect(start(5).data.moneyCost).toBe(5)
    // A free wall costs nothing.
    const free = makingStart({
      player: withMoney(0),
      location: alley,
      items,
      mediums,
      plan: wallPlan,
      gameState: {},
      gameTime: { tick: 0 },
    })
    expect(free.data.moneyCost).toBe(0)
  })

  it('whoever is in charge can refuse a form outright; somebody else holding the brush will do it', () => {
    const sober = playerWith({ carrying: ['spray'], mediumId: 'tagging' })
    const plans = makingOptions({ player: sober, location: alley, items, mediums: shy }).data.plans
    expect(plans.find((p) => p.mediumId === 'tagging').refusedReason).toBe('Not sober. No.')
    expect(plans.find((p) => p.mediumId === 'performance').refusedReason).toBeNull()
    const start = (player) =>
      makingStart({
        player,
        location: alley,
        items,
        mediums: shy,
        plan: wallPlan,
        gameState: {},
        gameTime: { tick: 0 },
      })
    expect(start(sober).error.code).toBe(MAKING_ERROR_CODES.PERSONA_REFUSES)
    const drunk = { ...sober, blend: { ...sober.blend, dominantPersonaId: 'host' } }
    expect(start(drunk).ok).toBe(true)
  })
})

describe('a form that can be done anywhere', () => {
  const loose = {
    ...mediums,
    performance: {
      ...mediums.performance,
      making: {
        ...mediums.performance.making,
        anywhere: true,
        encore: { chance: 0.5, strength: 35, ticksTotal: 8 },
      },
    },
  }
  const nowhere = { id: 'void', surfaces: [], marks: [] }
  const herePlan = {
    mediumId: 'performance',
    toolItemId: null,
    surfaceKind: 'place',
    surfaceId: 'void',
  }
  const inspired = () => playerWith({ carrying: [], mediumId: 'performance' })

  it('is offered on the spot itself, even where the place offers nothing', () => {
    const plans = makingOptions({ player: inspired(), location: nowhere, items, mediums: loose })
      .data.plans
    expect(plans).toEqual([
      expect.objectContaining({ surfaceKind: 'place', surfaceId: 'void', cost: 0 }),
    ])
    // A form that is not marked anywhere gets no such plan.
    expect(
      makingOptions({ player: inspired(), location: nowhere, items, mediums }).data.plans
    ).toEqual([])
  })

  it('starts only for a form marked anywhere, and only on the spot you are standing on', () => {
    const start = (meds, plan) =>
      makingStart({
        player: inspired(),
        location: nowhere,
        items,
        mediums: meds,
        plan,
        gameState: {},
        gameTime: { tick: 0 },
      })
    expect(start(loose, herePlan).ok).toBe(true)
    expect(start(mediums, herePlan).error.code).toBe(MAKING_ERROR_CODES.SURFACE_INVALID)
    expect(start(loose, { ...herePlan, surfaceId: 'elsewhere' }).error.code).toBe(
      MAKING_ERROR_CODES.SURFACE_INVALID
    )
  })

  it('leaves nothing on the spot, even in a form that otherwise leaves things', () => {
    const leaves = {
      ...loose,
      performance: {
        ...loose.performance,
        making: { ...loose.performance.making, leavesArtifact: true },
      },
    }
    const base = inspired()
    const begun = makingStart({
      player: base,
      location: nowhere,
      items,
      mediums: leaves,
      plan: herePlan,
      gameState: {},
      gameTime: { tick: 0 },
    })
    const player = worked({ player: { ...base, makings: begun.data.makings }, ticksWorked: 2 })
    const result = makingFinish({
      player,
      location: nowhere,
      mediums: leaves,
      gameTime: { tick: 3 },
      rng: () => 0.99,
    })
    expect(result.data.tier).toBe(MAKING_TIERS.INSPIRED)
    expect(result.data.artifact).toBeNull()
  })
})

describe('encore', () => {
  const encore = { chance: 0.5, strength: 35, ticksTotal: 8 }
  const feeds = {
    ...mediums,
    tagging: { ...mediums.tagging, making: { ...mediums.tagging.making, encore } },
  }
  const ready = () =>
    worked({
      player: started({
        player: playerWith({ carrying: ['spray'], mediumId: 'tagging' }),
        plan: wallPlan,
      }),
      ticksWorked: 1,
    })
  /** The die first, then the encore roll. */
  const rolls = (...values) => rngSequence({ values, repeatLast: true })

  it('a form that feeds itself can hand back the idea for the next one', () => {
    const result = makingFinish({
      player: ready(),
      location: alley,
      mediums: feeds,
      gameTime: { tick: 5 },
      rng: rolls(0.7, 0.49),
    })
    expect(result.data.encore).toEqual({ mediumId: 'tagging', strength: 35, ticksTotal: 8 })
  })

  it('or not; and a form that does not feed itself never does, and never rolls for it', () => {
    const missed = makingFinish({
      player: ready(),
      location: alley,
      mediums: feeds,
      gameTime: { tick: 5 },
      rng: rolls(0.7, 0.5),
    })
    expect(missed.data.encore).toBeNull()
    let asked = 0
    const counting = () => {
      asked++
      return 0.0
    }
    const plain = makingFinish({
      player: ready(),
      location: alley,
      mediums,
      gameTime: { tick: 5 },
      rng: counting,
    })
    expect(plain.data.encore).toBeNull()
    expect(asked).toBe(1)
  })
})

describe('makingWork', () => {
  it('moves the work forward and says when it is done, never past it', () => {
    let player = started({ player: playerWith({ carrying: ['paints', 'door'] }), plan: doorPlan })
    const first = makingWork({ player, ticksWorked: 2, gameTime: { tick: 3 } })
    expect(first.data.making.ticksDone).toBe(2)
    expect(first.data.workDone).toBe(false)
    player = { ...player, makings: first.data.makings }
    const second = makingWork({ player, ticksWorked: 5, gameTime: { tick: 5 } })
    expect(second.data.making.ticksDone).toBe(4)
    expect(second.data.workDone).toBe(true)
    expect(second.data.making.updatedAtTick).toBe(5)
  })

  it('keeps the round that was played on the record', () => {
    const player = started({ player: playerWith({ carrying: ['paints', 'door'] }), plan: doorPlan })
    const result = makingWork({
      player,
      ticksWorked: 1,
      gameState: { banked: 2 },
      gameTime: { tick: 3 },
    })
    expect(result.data.making.game).toEqual({ id: 'steady', state: { banked: 2 } })
    expect(player.makings[0].game.state).toEqual({ offer: null })
  })

  it('a game that ends the work early makes the work done so far all the work there is', () => {
    const player = started({ player: playerWith({ carrying: ['paints', 'door'] }), plan: doorPlan })
    const result = makingWork({
      player,
      ticksWorked: 1,
      gameState: { offer: null },
      workDone: true,
      gameTime: { tick: 3 },
    })
    expect(result.data.workDone).toBe(true)
    expect(result.data.making).toMatchObject({ ticksDone: 1, ticksTotal: 1 })
    const finished = makingFinish({
      player: { ...player, makings: result.data.makings },
      location: alley,
      mediums,
      gameTime: { tick: 4 },
      rng: die(15),
    })
    expect(finished.ok).toBe(true)
  })

  it('is an error with nothing in progress, and with a nonsense amount of work', () => {
    const idle = playerWith({ carrying: [] })
    expect(makingWork({ player: idle, ticksWorked: 1, gameTime: { tick: 0 } }).error.code).toBe(
      MAKING_ERROR_CODES.NONE_IN_PROGRESS
    )
    expect(makingWork({ player: idle, ticksWorked: 0, gameTime: { tick: 0 } }).error.code).toBe(
      MAKING_ERROR_CODES.TICKS_INVALID
    )
  })
})

describe('makingFinish', () => {
  function readyToFinish({
    plan = doorPlan,
    carrying = ['paints', 'spray', 'door'],
    ...rest
  } = {}) {
    const player = started({ player: playerWith({ carrying, ...rest }), plan })
    return worked({ player, ticksWorked: mediums[plan.mediumId].making.ticksTotal })
  }

  it('refuses work that is not done', () => {
    const player = started({ player: playerWith({ carrying: ['paints', 'door'] }), plan: doorPlan })
    const result = makingFinish({
      player,
      location: alley,
      mediums,
      gameTime: { tick: 3 },
      rng: die(15),
    })
    expect(result.error.code).toBe(MAKING_ERROR_CODES.WORK_UNFINISHED)
  })

  it('refuses when the idea it was started on is gone, even if another has struck', () => {
    const player = readyToFinish()
    player.inspirations = inspirationStrike({
      player,
      source: { kind: 'event', id: 'distraction' },
      mediumId: 'painting',
      strength: 90,
      ticksTotal: 12,
      gameTime: { tick: 4 },
    }).data.inspirations
    const result = makingFinish({
      player,
      location: alley,
      mediums,
      gameTime: { tick: 5 },
      rng: die(15),
    })
    expect(result.error.code).toBe(MAKING_ERROR_CODES.INSPIRATION_NONE)
  })

  it.each([
    [1, MAKING_TIERS.BOTCHED],
    [5, MAKING_TIERS.ROUGH],
    [15, MAKING_TIERS.SOLID],
    [20, MAKING_TIERS.INSPIRED],
  ])('a %i on the die makes it %s', (face, tier) => {
    const result = makingFinish({
      player: readyToFinish(),
      location: alley,
      mediums,
      gameTime: { tick: 5 },
      rng: die(face),
    })
    expect(result.data.tier).toBe(tier)
    expect(result.data.experience.tier).toBe(tier)
  })

  it('the strength of the idea helps the check, itemized', () => {
    const result = makingFinish({
      player: readyToFinish({ strength: 60 }),
      location: alley,
      mediums,
      gameTime: { tick: 5 },
      rng: die(10),
    })
    const item = result.data.check.modifierItems.find(
      (m) => m.sourceId === MAKING_MODIFIER_SOURCE_IDS.INSPIRATION
    )
    expect(item.value).toBe(3)
    expect(result.data.check.total).toBe(10 + 1 + 3)
  })

  it('how the game went bears on the check, itemized with the rest', () => {
    const result = makingFinish({
      player: readyToFinish({ strength: 60 }),
      location: alley,
      mediums,
      modifiers: [{ sourceId: 'game', value: -4 }],
      gameTime: { tick: 5 },
      rng: die(15),
    })
    expect(result.data.check.modifierItems).toContainEqual({
      source: 'situational',
      sourceId: 'game',
      value: -4,
    })
    expect(result.data.check.total).toBe(15 + 1 + 3 - 4)
    expect(result.data.tier).toBe(MAKING_TIERS.SOLID)
  })

  it('a medium the idea did not ask for costs the check', () => {
    const result = makingFinish({
      player: readyToFinish({ plan: wallPlan, mediumId: 'painting' }),
      location: alley,
      mediums,
      gameTime: { tick: 5 },
      rng: die(10),
    })
    const sourceIds = result.data.check.modifierItems.map((m) => m.sourceId)
    expect(sourceIds).toContain(MAKING_MODIFIER_SOURCE_IDS.WRONG_MEDIUM)
    expect(result.data.check.total).toBe(10 + 1 + 3 - 2)
  })

  it('an idea that asked for nothing in particular is at home in any medium', () => {
    const result = makingFinish({
      player: readyToFinish({ plan: wallPlan, mediumId: null }),
      location: alley,
      mediums,
      gameTime: { tick: 5 },
      rng: die(10),
    })
    const sourceIds = result.data.check.modifierItems.map((m) => m.sourceId)
    expect(sourceIds).not.toContain(MAKING_MODIFIER_SOURCE_IDS.WRONG_MEDIUM)
  })

  it('work on something carried leaves a portable, unshown artifact and a finished record', () => {
    const player = readyToFinish()
    const result = makingFinish({
      player,
      location: alley,
      mediums,
      gameTime: { tick: 5 },
      rng: die(15),
    })
    const { artifact, experience, making } = result.data
    expect(artifact).toMatchObject({
      kind: ARTIFACT_KINDS.PORTABLE,
      status: ARTIFACT_STATUSES.UNSHOWN,
      surfaceId: 'door',
      toolItemId: 'paints',
      madeAtLocationId: 'alley',
      experienceId: experience.id,
    })
    expect(experience.artifactId).toBe(artifact.id)
    expect(experience.dominantPersonaId).toBe('sober')
    expect(making.status).toBe(MAKING_STATUSES.FINISHED)
    expect(making.experienceId).toBe(experience.id)
    expect(makingActive({ player: { makings: result.data.makings } })).toBeNull()
  })

  it('work on a wall leaves a fresh mark and names the fresh marks under it', () => {
    const location = {
      ...alley,
      marks: [
        { id: 'old', surfaceId: 'wall', status: ARTIFACT_STATUSES.FRESH },
        { id: 'older', surfaceId: 'wall', status: ARTIFACT_STATUSES.COVERED },
        { id: 'elsewhere', surfaceId: 'dumpster', status: ARTIFACT_STATUSES.FRESH },
      ],
    }
    const result = makingFinish({
      player: readyToFinish({ plan: wallPlan, mediumId: 'tagging' }),
      location,
      mediums,
      gameTime: { tick: 5 },
      rng: die(15),
    })
    expect(result.data.artifact).toMatchObject({
      kind: ARTIFACT_KINDS.FIXED,
      status: ARTIFACT_STATUSES.FRESH,
    })
    expect(result.data.markIdsCovered).toEqual(['old'])
  })

  it('a surface that keeps nothing leaves the experience and nothing else', () => {
    const location = {
      ...alley,
      surfaces: [{ id: 'wall', mediumIds: ['tagging'], artifact: 'none' }],
    }
    const player = worked({
      player: started({
        player: playerWith({ carrying: ['spray'], mediumId: 'tagging' }),
        plan: wallPlan,
        location,
      }),
      ticksWorked: 1,
    })
    const result = makingFinish({ player, location, mediums, gameTime: { tick: 5 }, rng: die(20) })
    expect(result.data.artifact).toBeNull()
    expect(result.data.experience.tier).toBe(MAKING_TIERS.INSPIRED)
  })

  it('a surface the place marks portable hands you something to carry, and the wall is untouched', () => {
    const location = {
      ...alley,
      surfaces: [{ id: 'wall', mediumIds: ['tagging'], artifact: 'portable' }],
      marks: [{ id: 'old', surfaceId: 'wall', status: ARTIFACT_STATUSES.FRESH }],
    }
    const player = worked({
      player: started({
        player: playerWith({ carrying: ['spray'], mediumId: 'tagging' }),
        plan: wallPlan,
        location,
      }),
      ticksWorked: 1,
    })
    const result = makingFinish({ player, location, mediums, gameTime: { tick: 5 }, rng: die(15) })
    expect(result.data.artifact).toMatchObject({
      kind: ARTIFACT_KINDS.PORTABLE,
      status: ARTIFACT_STATUSES.UNSHOWN,
    })
    expect(result.data.markIdsCovered).toEqual([])
  })

  it('a botched piece leaves the experience and nothing else, and covers nothing', () => {
    const location = {
      ...alley,
      marks: [{ id: 'old', surfaceId: 'wall', status: ARTIFACT_STATUSES.FRESH }],
    }
    const result = makingFinish({
      player: readyToFinish({ plan: wallPlan, mediumId: 'tagging' }),
      location,
      mediums,
      gameTime: { tick: 5 },
      rng: die(1),
    })
    expect(result.data.artifact).toBeNull()
    expect(result.data.experience.artifactId).toBeNull()
    expect(result.data.markIdsCovered).toEqual([])
  })

  it('a performance leaves only the experience however well it went', () => {
    const plan = {
      mediumId: 'performance',
      toolItemId: null,
      surfaceKind: 'location',
      surfaceId: 'corner',
    }
    const result = makingFinish({
      player: readyToFinish({ plan, carrying: [], mediumId: 'performance' }),
      location: alley,
      mediums,
      gameTime: { tick: 5 },
      rng: die(20),
    })
    expect(result.data.tier).toBe(MAKING_TIERS.INSPIRED)
    expect(result.data.artifact).toBeNull()
  })
})

describe('makingAbandon', () => {
  it('closes the work with what ended it', () => {
    const player = started({ player: playerWith({ carrying: ['paints', 'door'] }), plan: doorPlan })
    const result = makingAbandon({
      player,
      reason: { kind: 'clock', id: 'clock' },
      gameTime: { tick: 9 },
    })
    expect(result.data.abandoned).toMatchObject({
      status: MAKING_STATUSES.ABANDONED,
      endedBy: { kind: 'clock', id: 'clock' },
      updatedAtTick: 9,
    })
    expect(makingActive({ player: { makings: result.data.makings } })).toBeNull()
    // The record is kept, not deleted.
    expect(result.data.makings).toHaveLength(1)
  })

  it('abandoning nothing is fine; a reason with no shape is not', () => {
    const idle = playerWith({ carrying: [] })
    const nothing = makingAbandon({
      player: idle,
      reason: { kind: 'player', id: 'x' },
      gameTime: { tick: 0 },
    })
    expect(nothing.ok).toBe(true)
    expect(nothing.data.abandoned).toBeNull()
    expect(makingAbandon({ player: idle, reason: {}, gameTime: { tick: 0 } }).error.code).toBe(
      MAKING_ERROR_CODES.REASON_INVALID
    )
  })
})

describe('marksCover', () => {
  it('covers the named marks, leaves the rest, and mutates nothing', () => {
    const location = {
      marks: [
        { id: 'a', status: ARTIFACT_STATUSES.FRESH, endedBy: null, updatedAtTick: 1 },
        { id: 'b', status: ARTIFACT_STATUSES.FRESH, endedBy: null, updatedAtTick: 1 },
      ],
    }
    const marks = marksCover({
      location,
      markIdsCovered: ['a'],
      coveredBy: { kind: 'mark', id: 'new' },
      gameTime: { tick: 8 },
    })
    expect(marks[0]).toMatchObject({
      status: ARTIFACT_STATUSES.COVERED,
      endedBy: { kind: 'mark', id: 'new' },
      updatedAtTick: 8,
    })
    expect(marks[1].status).toBe(ARTIFACT_STATUSES.FRESH)
    expect(location.marks[0].status).toBe(ARTIFACT_STATUSES.FRESH)
  })
})
