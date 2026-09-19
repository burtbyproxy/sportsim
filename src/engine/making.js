/**
 * Making Engine — the work.
 *
 * An inspiration is a clock; making is what you do before it runs out. A
 * making is a plan (a medium, a tool that works in it, a surface that takes
 * it, maybe an ingredient) worked over several ticks. The idea has to
 * outlast the work: the making is bound to the inspiration that started it,
 * and when that inspiration dies the making is abandoned where it stands.
 *
 * A finished making always leaves an Experience. Most leave an Artifact as
 * well: something made on a thing you carry is portable and goes in the
 * portfolio; something made on a wall stays on the wall as a mark, and a
 * fresh mark covers whatever was on that surface before. A botched piece
 * leaves only the experience. A performance leaves only the experience no
 * matter how it went.
 *
 * Records are never deleted. Each carries a status and the tick it last
 * changed. The words for a piece are the describer's business, not this
 * module's; records leave here with their text empty.
 *
 * Pure functions. No side effects. No Vue. No DOM. Single input struct in,
 * result struct out; new lists are returned, nothing is mutated.
 */

import { v4 as uuidv4 } from 'uuid'
import { blendSober } from './blend.js'
import { inspirationActive } from './inspiration.js'
import { skillCheckRoll } from './skills.js'
import { locationOpen } from '../models/location.js'
import { resultOk, resultFail } from './result.js'
import { listSortBy } from '../utils/list.js'

/** Enumerated error codes for every making result. The code is the contract. */
export const MAKING_ERROR_CODES = Object.freeze({
  playerMissing: 'PLAYER_MISSING',
  locationMissing: 'LOCATION_MISSING',
  inspirationNone: 'INSPIRATION_NONE',
  alreadyMaking: 'ALREADY_MAKING',
  noneInProgress: 'NONE_IN_PROGRESS',
  mediumUnknown: 'MEDIUM_UNKNOWN',
  toolInvalid: 'TOOL_INVALID',
  surfaceInvalid: 'SURFACE_INVALID',
  ingredientInvalid: 'INGREDIENT_INVALID',
  timeShort: 'TIME_SHORT',
  moneyShort: 'MONEY_SHORT',
  personaRefuses: 'PERSONA_REFUSES',
  ticksInvalid: 'TICKS_INVALID',
  workUnfinished: 'WORK_UNFINISHED',
  reasonInvalid: 'REASON_INVALID',
})

/** Every state a making record can be in. */
export const MAKING_STATUSES = Object.freeze({
  inProgress: 'in_progress',
  finished: 'finished',
  abandoned: 'abandoned',
})

/** Where the surface of a making comes from. */
export const MAKING_SURFACE_KINDS = Object.freeze({
  item: 'item',
  location: 'location',
  /** No surface but where you are standing: a form that can be done anywhere. */
  place: 'place',
})

/**
 * What working on a surface the place offers leaves behind. A wall keeps the
 * piece (fixed, the default). Some hand you something to carry: the tape from
 * the recorder over the karaoke machine. Some keep nothing at all.
 */
export const SURFACE_ARTIFACTS = Object.freeze({
  fixed: 'fixed',
  portable: 'portable',
  none: 'none',
})

/** How a finished piece came out. Words, never a number. */
export const MAKING_TIERS = Object.freeze({
  botched: 'botched',
  rough: 'rough',
  solid: 'solid',
  inspired: 'inspired',
})

/** Whether an artifact travels with the player or stays where it was made. */
export const ARTIFACT_KINDS = Object.freeze({
  portable: 'portable',
  fixed: 'fixed',
})

/** Every state an artifact can be in so far. Showing and the weather come later. */
export const ARTIFACT_STATUSES = Object.freeze({
  unshown: 'unshown',
  fresh: 'fresh',
  covered: 'covered',
})

/** The one state an experience has until somebody starts telling it. */
export const EXPERIENCE_STATUS_REMEMBERED = 'remembered'

/** Source ids of the situational modifiers a making check itemizes. */
export const MAKING_MODIFIER_SOURCE_IDS = Object.freeze({
  inspiration: 'inspiration',
  wrongMedium: 'inspiration_wrong_medium',
})

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function copies(player) {
  return (player.makings ?? []).map((record) => ({
    ...record,
    game: record.game ? JSON.parse(JSON.stringify(record.game)) : null,
    endedBy: record.endedBy ? { ...record.endedBy } : null,
  }))
}

function itemsCarried({ player, itemId }) {
  return (player.inventory ?? []).some((i) => i.id === itemId && (i.quantity ?? 1) > 0)
}

function itemsCarriedOfType({ player, items, type }) {
  const seen = new Set()
  const found = []
  for (const carried of player.inventory ?? []) {
    const definition = items[carried.id]
    if (!definition || definition.type !== type || seen.has(carried.id)) continue
    if ((carried.quantity ?? 1) <= 0) continue
    seen.add(carried.id)
    found.push(definition)
  }
  return found
}

function takesMedium({ thing, mediumId }) {
  return (thing.mediumIds ?? []).includes(mediumId)
}

/** A surface the place only offers at certain hours: the karaoke machine, say. */
function surfaceOpen({ surface, gameTime }) {
  if (!surface.hours) return true
  return locationOpen({ location: { availability: surface.hours }, hour: gameTime?.hour ?? 0 })
}

function surfaceFind({ player, location, items, surfaceKind, surfaceId, gameTime }) {
  if (surfaceKind === MAKING_SURFACE_KINDS.item) {
    const definition = items[surfaceId]
    if (
      !definition ||
      definition.type !== 'surface' ||
      !itemsCarried({ player, itemId: surfaceId })
    ) {
      return null
    }
    return definition
  }
  if (surfaceKind === MAKING_SURFACE_KINDS.location) {
    const surface = (location.surfaces ?? []).find((s) => s.id === surfaceId) ?? null
    return surface && surfaceOpen({ surface, gameTime }) ? surface : null
  }
  return null
}

/**
 * Whoever is in charge may flatly refuse a form: sober, nobody is getting you
 * up there. Returns the reason, or null.
 */
function refusalBuild({ player, medium }) {
  const personaId = (player.blend ?? blendSober()).dominantPersonaId
  const refusal = (medium.making.refusals ?? []).find((r) => r.personaId === personaId)
  return refusal ? refusal.reason : null
}

function tierFrom(check) {
  if (check.criticalFailure) return MAKING_TIERS.botched
  if (check.criticalSuccess) return MAKING_TIERS.inspired
  return check.success ? MAKING_TIERS.solid : MAKING_TIERS.rough
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * The making under way, or null. A copy.
 * @param {{ player: Object }} input
 * @returns {Object|null}
 */
export function makingActive({ player }) {
  if (!player) return null
  return copies(player).find((r) => r.status === MAKING_STATUSES.inProgress) ?? null
}

/**
 * Everything the player could make right here, right now: one plan per
 * medium × tool × surface that fit together, from what they carry and what
 * the place offers, and the ingredients they could work in. Plans in the
 * medium the idea asked for come first. A plan that cannot be started is
 * still listed, and says why: the idea will not outlast it (enoughTime), the
 * place wants money the player does not have (affordable), or whoever is in
 * charge refuses the form outright (refusedReason).
 *
 * @param {{ player: Object, location: Object, items: Object<string, Object>, mediums: Object<string, Object>, gameTime: { hour: number } }} input
 * @returns {{ ok: boolean, data: {
 *   plans: { mediumId: string, toolItemId: string|null, surfaceKind: string, surfaceId: string, ticksTotal: number, enoughTime: boolean, cost: number, affordable: boolean, refusedReason: string|null }[],
 *   ingredientItemIds: string[],
 * }|null, error: Object|null }}
 */
export function makingOptions({ player, location, items = {}, mediums = {}, gameTime }) {
  if (!player || typeof player !== 'object') {
    return resultFail({
      code: MAKING_ERROR_CODES.playerMissing,
      message: 'makingOptions needs a player',
    })
  }
  if (!location || typeof location !== 'object') {
    return resultFail({
      code: MAKING_ERROR_CODES.locationMissing,
      message: 'makingOptions needs a location',
    })
  }
  const inspiration = inspirationActive({ player })
  if (!inspiration) {
    return resultFail({
      code: MAKING_ERROR_CODES.inspirationNone,
      message: 'Nothing is moving the player',
    })
  }

  const tools = itemsCarriedOfType({ player, items, type: 'tool' })
  const surfaceItems = itemsCarriedOfType({ player, items, type: 'surface' })
  const plans = []
  for (const medium of Object.values(mediums)) {
    if (!medium.making) continue
    const toolIds = medium.making.toolRequired
      ? tools.filter((t) => takesMedium({ thing: t, mediumId: medium.id })).map((t) => t.id)
      : [null]
    const surfaces = [
      ...surfaceItems
        .filter((s) => takesMedium({ thing: s, mediumId: medium.id }))
        .map((s) => ({ surfaceKind: MAKING_SURFACE_KINDS.item, surfaceId: s.id })),
      ...(location.surfaces ?? [])
        .filter((s) => takesMedium({ thing: s, mediumId: medium.id }))
        .filter((s) => surfaceOpen({ surface: s, gameTime }))
        .map((s) => ({
          surfaceKind: MAKING_SURFACE_KINDS.location,
          surfaceId: s.id,
          cost: s.cost ?? 0,
        })),
    ]
    // A form that can be done anywhere needs nothing but the ground under you.
    if (medium.making.anywhere) {
      surfaces.push({ surfaceKind: MAKING_SURFACE_KINDS.place, surfaceId: location.id, cost: 0 })
    }
    const refusedReason = refusalBuild({ player, medium })
    for (const toolItemId of toolIds) {
      for (const surface of surfaces) {
        const cost = surface.cost ?? 0
        plans.push({
          mediumId: medium.id,
          toolItemId,
          surfaceKind: surface.surfaceKind,
          surfaceId: surface.surfaceId,
          ticksTotal: medium.making.ticksTotal,
          enoughTime: inspiration.ticksRemaining > medium.making.ticksTotal,
          cost,
          affordable: (player.status?.money ?? 0) >= cost,
          refusedReason,
        })
      }
    }
  }
  // The medium the idea is for comes first.
  const ordered = listSortBy({
    items: plans,
    keyOf: (plan) => (plan.mediumId === inspiration.mediumId ? 0 : 1),
  })

  return resultOk({
    plans: ordered,
    ingredientItemIds: itemsCarriedOfType({ player, items, type: 'ingredient' }).map((i) => i.id),
  })
}

/**
 * Begin. The plan is checked against what the player carries and where they
 * stand, a record is opened bound to the active inspiration, and the things
 * the work uses up — a carried surface, an ingredient, a tool with one job
 * left in it — are named for the caller to take away. Other tools survive.
 *
 * @param {{
 *   player: Object,
 *   location: Object,
 *   items: Object<string, Object>,
 *   mediums: Object<string, Object>,
 *   plan: { mediumId: string, toolItemId: string|null, surfaceKind: string, surfaceId: string, ingredientItemId?: string|null },
 *   gameState: Object,
 *   gameTime: { tick: number, hour: number },
 * }} input
 *   gameState — the opening state of the medium's game (engine/minigame.js), kept on the record.
 * @returns {{ ok: boolean, data: { makings: Object[], making: Object, itemIdsConsumed: string[], moneyCost: number }|null, error: Object|null }}
 *   moneyCost — what the surface charges, paid up front: five bucks to have the tape rolling.
 */
export function makingStart({
  player,
  location,
  items = {},
  mediums = {},
  plan,
  gameState,
  gameTime,
}) {
  if (!player || typeof player !== 'object') {
    return resultFail({
      code: MAKING_ERROR_CODES.playerMissing,
      message: 'makingStart needs a player',
    })
  }
  if (!location || typeof location !== 'object') {
    return resultFail({
      code: MAKING_ERROR_CODES.locationMissing,
      message: 'makingStart needs a location',
    })
  }
  if (makingActive({ player })) {
    return resultFail({
      code: MAKING_ERROR_CODES.alreadyMaking,
      message: 'The player is already making something',
    })
  }
  const inspiration = inspirationActive({ player })
  if (!inspiration) {
    return resultFail({
      code: MAKING_ERROR_CODES.inspirationNone,
      message: 'Nothing is moving the player',
    })
  }
  const medium = mediums[plan?.mediumId]
  if (!medium?.making) {
    return resultFail({
      code: MAKING_ERROR_CODES.mediumUnknown,
      message: `'${plan?.mediumId}' is not a medium anything can be made in`,
    })
  }

  const { toolItemId = null, surfaceKind, surfaceId, ingredientItemId = null } = plan
  if (medium.making.toolRequired) {
    const tool = items[toolItemId]
    const usable =
      tool &&
      tool.type === 'tool' &&
      takesMedium({ thing: tool, mediumId: medium.id }) &&
      itemsCarried({ player, itemId: toolItemId })
    if (!usable) {
      return resultFail({
        code: MAKING_ERROR_CODES.toolInvalid,
        message: `'${toolItemId}' is not a carried tool for ${medium.id}`,
      })
    }
  } else if (toolItemId !== null) {
    return resultFail({
      code: MAKING_ERROR_CODES.toolInvalid,
      message: `${medium.id} takes no tool`,
    })
  }

  const surface =
    surfaceKind === MAKING_SURFACE_KINDS.place
      ? medium.making.anywhere && surfaceId === location.id
        ? { id: location.id, mediumIds: [medium.id] }
        : null
      : surfaceFind({ player, location, items, surfaceKind, surfaceId, gameTime })
  if (!surface || !takesMedium({ thing: surface, mediumId: medium.id })) {
    return resultFail({
      code: MAKING_ERROR_CODES.surfaceInvalid,
      message: `'${surfaceId}' (${surfaceKind}) is not a surface here that takes ${medium.id}`,
    })
  }

  if (ingredientItemId !== null) {
    const ingredient = items[ingredientItemId]
    const usable =
      medium.making.takesIngredient &&
      ingredient &&
      ingredient.type === 'ingredient' &&
      itemsCarried({ player, itemId: ingredientItemId })
    if (!usable) {
      return resultFail({
        code: MAKING_ERROR_CODES.ingredientInvalid,
        message: `'${ingredientItemId}' is not a carried ingredient ${medium.id} can take`,
      })
    }
  }

  if (inspiration.ticksRemaining <= medium.making.ticksTotal) {
    return resultFail({
      code: MAKING_ERROR_CODES.timeShort,
      message: 'The idea will not last as long as the work',
    })
  }
  const refusedReason = refusalBuild({ player, medium })
  if (refusedReason)
    return resultFail({ code: MAKING_ERROR_CODES.personaRefuses, message: refusedReason })
  const moneyCost = surfaceKind === MAKING_SURFACE_KINDS.location ? (surface.cost ?? 0) : 0
  if ((player.status?.money ?? 0) < moneyCost) {
    return resultFail({
      code: MAKING_ERROR_CODES.moneyShort,
      message: `That costs ${moneyCost} and the player is short`,
    })
  }

  const tick = gameTime?.tick ?? 0
  const making = {
    id: uuidv4(),
    status: MAKING_STATUSES.inProgress,
    mediumId: medium.id,
    toolItemId,
    surfaceKind,
    surfaceId,
    ingredientItemId,
    inspirationId: inspiration.id,
    locationId: location.id,
    ticksTotal: medium.making.ticksTotal,
    ticksDone: 0,
    game: { id: medium.making.gameId, state: gameState },
    startedAtTick: tick,
    experienceId: null,
    endedBy: null,
    updatedAtTick: tick,
  }
  const itemIdsConsumed = []
  if (toolItemId !== null && items[toolItemId].spentOnUse) itemIdsConsumed.push(toolItemId)
  if (surfaceKind === MAKING_SURFACE_KINDS.item) itemIdsConsumed.push(surfaceId)
  if (ingredientItemId !== null) itemIdsConsumed.push(ingredientItemId)

  return resultOk({
    makings: [...copies(player), making],
    making: { ...making },
    itemIdsConsumed,
    moneyCost,
  })
}

/**
 * A sitting. The work moves forward by the ticks put in, never past done,
 * and the round of the game that was played is kept on the record. A game
 * can end the work early — the player stopped, or it went wrong — and then
 * the work done so far is all the work there is.
 *
 * @param {{ player: Object, ticksWorked: number, gameState: Object, workDone?: boolean, gameTime: { tick: number } }} input
 * @returns {{ ok: boolean, data: { makings: Object[], making: Object, workDone: boolean }|null, error: Object|null }}
 */
export function makingWork({ player, ticksWorked, gameState, workDone = false, gameTime }) {
  if (!player || typeof player !== 'object') {
    return resultFail({
      code: MAKING_ERROR_CODES.playerMissing,
      message: 'makingWork needs a player',
    })
  }
  if (!Number.isInteger(ticksWorked) || ticksWorked < 1) {
    return resultFail({
      code: MAKING_ERROR_CODES.ticksInvalid,
      message: `ticksWorked must be an integer >= 1, got ${ticksWorked}`,
    })
  }
  const makings = copies(player)
  const making = makings.find((r) => r.status === MAKING_STATUSES.inProgress)
  if (!making) {
    return resultFail({
      code: MAKING_ERROR_CODES.noneInProgress,
      message: 'The player is not making anything',
    })
  }
  making.ticksDone = Math.min(making.ticksTotal, making.ticksDone + ticksWorked)
  if (workDone) making.ticksTotal = making.ticksDone
  making.game = { ...making.game, state: gameState }
  making.updatedAtTick = gameTime?.tick ?? making.updatedAtTick
  return resultOk({
    makings,
    making: { ...making },
    workDone: making.ticksDone >= making.ticksTotal,
  })
}

/**
 * The work is done; find out what it is. One check in the medium, helped by
 * the strength of the idea and hurt by a medium the idea did not ask for,
 * every contribution itemized. The check decides the tier. The experience
 * and the artifact (when there is one) leave here without their words.
 *
 * A fixed artifact covers any fresh mark already on that surface; the ids
 * covered are returned for the caller to mark.
 *
 * @param {{
 *   player: Object,
 *   location: Object,
 *   mediums: Object<string, Object>,
 *   modifiers?: { sourceId: string, value: number }[],
 *   gameTime: { tick: number },
 *   rng?: () => number,
 * }} input
 *   modifiers — what else bears on the check: how the game went.
 * @returns {{ ok: boolean, data: {
 *   makings: Object[],
 *   making: Object,
 *   check: Object,
 *   tier: string,
 *   experience: Object,
 *   artifact: Object|null,
 *   markIdsCovered: string[],
 *   encore: { mediumId: string, strength: number, ticksTotal: number }|null,
 * }|null, error: Object|null }}
 *   encore — some forms feed themselves: finishing one can be the idea for the
 *   next. Returned for the caller to strike once this idea is spent.
 */
export function makingFinish({
  player,
  location,
  mediums = {},
  modifiers: modifiersExtra = [],
  gameTime,
  rng = Math.random,
  tuning,
}) {
  if (!player || typeof player !== 'object') {
    return resultFail({
      code: MAKING_ERROR_CODES.playerMissing,
      message: 'makingFinish needs a player',
    })
  }
  if (!location || typeof location !== 'object') {
    return resultFail({
      code: MAKING_ERROR_CODES.locationMissing,
      message: 'makingFinish needs a location',
    })
  }
  const makings = copies(player)
  const making = makings.find((r) => r.status === MAKING_STATUSES.inProgress)
  if (!making) {
    return resultFail({
      code: MAKING_ERROR_CODES.noneInProgress,
      message: 'The player is not making anything',
    })
  }
  if (making.ticksDone < making.ticksTotal) {
    return resultFail({
      code: MAKING_ERROR_CODES.workUnfinished,
      message: 'There is still work to do',
    })
  }
  const inspiration = inspirationActive({ player })
  if (!inspiration || inspiration.id !== making.inspirationId) {
    return resultFail({
      code: MAKING_ERROR_CODES.inspirationNone,
      message: 'The idea behind this work is gone',
    })
  }
  const medium = mediums[making.mediumId]
  if (!medium?.making) {
    return resultFail({
      code: MAKING_ERROR_CODES.mediumUnknown,
      message: `'${making.mediumId}' is not a medium anything can be made in`,
    })
  }

  const modifiers = [
    {
      sourceId: MAKING_MODIFIER_SOURCE_IDS.inspiration,
      // Inspiration strength per point on the die.
      value: Math.max(1, Math.floor(inspiration.strength / tuning.making.strengthPerModifier)),
    },
  ]
  if (inspiration.mediumId !== null && inspiration.mediumId !== medium.id) {
    modifiers.push({
      sourceId: MAKING_MODIFIER_SOURCE_IDS.wrongMedium,
      // What working in a medium the idea did not ask for costs.
      value: tuning.making.wrongMediumPenalty,
    })
  }
  modifiers.push(...modifiersExtra.map((m) => ({ sourceId: m.sourceId, value: m.value })))
  const rolled = skillCheckRoll({
    tuning,
    player,
    mediumId: medium.id,
    mediums,
    dc: medium.making.dc,
    modifiers,
    rng,
  })
  if (!rolled.ok) return rolled
  const check = rolled.data
  const tier = tierFrom(check)

  const tick = gameTime?.tick ?? 0
  const blend = player.blend ?? blendSober()
  const experienceId = uuidv4()
  // Something carried is carried away. What a place offers decides for itself
  // what it leaves: a wall keeps the piece, the karaoke machine with the tape
  // rolling hands you a tape, and the machine on its own keeps nothing.
  const placed = (location.surfaces ?? []).find((s) => s.id === making.surfaceId)
  let leaves = placed?.artifact ?? SURFACE_ARTIFACTS.fixed
  if (making.surfaceKind === MAKING_SURFACE_KINDS.item) leaves = SURFACE_ARTIFACTS.portable
  // Done on nothing but the spot you stood on, it leaves nothing on it.
  if (making.surfaceKind === MAKING_SURFACE_KINDS.place) leaves = SURFACE_ARTIFACTS.none
  const fixed = leaves === SURFACE_ARTIFACTS.fixed
  const leavesArtifact =
    medium.making.leavesArtifact &&
    leaves !== SURFACE_ARTIFACTS.none &&
    tier !== MAKING_TIERS.botched

  const artifact = leavesArtifact
    ? {
        id: uuidv4(),
        status: fixed ? ARTIFACT_STATUSES.fresh : ARTIFACT_STATUSES.unshown,
        kind: fixed ? ARTIFACT_KINDS.fixed : ARTIFACT_KINDS.portable,
        experienceId,
        makingId: making.id,
        mediumId: medium.id,
        toolItemId: making.toolItemId,
        surfaceKind: making.surfaceKind,
        surfaceId: making.surfaceId,
        ingredientItemId: making.ingredientItemId,
        tier,
        madeAtLocationId: location.id,
        workText: '',
        artistText: '',
        endedBy: null,
        createdAtTick: tick,
        updatedAtTick: tick,
      }
    : null

  const experience = {
    id: experienceId,
    status: EXPERIENCE_STATUS_REMEMBERED,
    kind: 'making',
    makingId: making.id,
    inspirationId: inspiration.id,
    mediumId: medium.id,
    tier,
    check,
    personaSnapshot: JSON.parse(JSON.stringify(blend)),
    dominantPersonaId: blend.dominantPersonaId,
    locationId: location.id,
    artifactId: artifact ? artifact.id : null,
    workText: '',
    artistText: '',
    createdAtTick: tick,
    updatedAtTick: tick,
  }

  making.status = MAKING_STATUSES.finished
  making.experienceId = experienceId
  making.endedBy = { kind: 'experience', id: experienceId }
  making.updatedAtTick = tick

  const markIdsCovered =
    artifact && fixed
      ? (location.marks ?? [])
          .filter((m) => m.surfaceId === making.surfaceId && m.status === ARTIFACT_STATUSES.fresh)
          .map((m) => m.id)
      : []

  const again = medium.making.encore
  const encore =
    again && rng() < again.chance
      ? { mediumId: medium.id, strength: again.strength, ticksTotal: again.ticksTotal }
      : null

  return resultOk({
    makings,
    making: { ...making },
    check,
    tier,
    experience,
    artifact,
    markIdsCovered,
    encore,
  })
}

/**
 * The work stops short: the player walked away, or the idea died under it.
 * Abandoning nothing is not an error; the loop asks after every tick.
 *
 * @param {{ player: Object, reason: { kind: string, id: string }, gameTime: { tick: number } }} input
 * @returns {{ ok: boolean, data: { makings: Object[], abandoned: Object|null }|null, error: Object|null }}
 */
export function makingAbandon({ player, reason, gameTime }) {
  if (!player || typeof player !== 'object') {
    return resultFail({
      code: MAKING_ERROR_CODES.playerMissing,
      message: 'makingAbandon needs a player',
    })
  }
  const valid =
    reason &&
    typeof reason === 'object' &&
    typeof reason.kind === 'string' &&
    reason.kind.length > 0 &&
    typeof reason.id === 'string' &&
    reason.id.length > 0
  if (!valid) {
    return resultFail({
      code: MAKING_ERROR_CODES.reasonInvalid,
      message: 'reason needs a kind and an id',
    })
  }
  const makings = copies(player)
  const making = makings.find((r) => r.status === MAKING_STATUSES.inProgress)
  if (!making) return resultOk({ makings, abandoned: null })
  making.status = MAKING_STATUSES.abandoned
  making.endedBy = { ...reason }
  making.updatedAtTick = gameTime?.tick ?? making.updatedAtTick
  return resultOk({ makings, abandoned: { ...making } })
}

/**
 * A mark that something newer went over. Returns the location's new list of
 * marks; does not mutate.
 *
 * @param {{ location: Object, markIdsCovered: string[], coveredBy: { kind: string, id: string }, gameTime: { tick: number } }} input
 * @returns {Object[]}
 */
export function marksCover({ location, markIdsCovered, coveredBy, gameTime }) {
  return (location.marks ?? []).map((mark) =>
    markIdsCovered.includes(mark.id)
      ? {
          ...mark,
          status: ARTIFACT_STATUSES.covered,
          endedBy: { ...coveredBy },
          updatedAtTick: gameTime?.tick ?? mark.updatedAtTick,
        }
      : { ...mark }
  )
}
