/**
 * Psyche Engine — the marks that never wear off.
 *
 * The blend is who you are tonight: it moves with what's in you and can be
 * steered. The psyche is what stays. Something bad happens, or something
 * goes on too long, and there is a save. Fail it and nested content tables
 * are rolled down to a mark: a scar, a phobia, an obsession (love or hate),
 * a neurosis, a psychosis, an affective swing. A mark is about something,
 * a typed reference to a real thing (a place, a person, an item, a
 * substance, a condition, a topic), taken from whatever did it to you.
 *
 * Marks are content (content/marks); the engine only knows what a mark can
 * do: bend stats for good, add to confusion, refuse its target (avoids),
 * pull toward it on the menu (draws), and, on a trigger, throw a fit: a
 * persona shoved into the blend for a while. NPCs carry the same marks.
 *
 * Pure functions. No side effects. No Vue. No DOM. Every public function
 * takes a single input struct; the ones that can fail return a result
 * struct (ok/data/error).
 */

import { v4 as uuidv4 } from 'uuid'
import { resultOk, resultFail } from './result.js'
import { checkRoll } from './dice.js'
import { PERSONA_SOURCES } from './blend.js'
import { inventoryHas } from './items.js'
import { randomChance, randomPickWeighted } from '../utils/random.js'

/** Enumerated error codes for every psyche result. The code is the contract. */
export const PSYCHE_ERROR_CODES = Object.freeze({
  subjectMissing: 'SUBJECT_MISSING',
  tableUnknown: 'TABLE_UNKNOWN',
  statUnknown: 'STAT_UNKNOWN',
  ticksInvalid: 'TICKS_INVALID',
})

/** What a mark is, as the tables sort them. The engine treats every kind alike. */
export const MARK_KINDS = Object.freeze({
  trauma: 'trauma',
  phobia: 'phobia',
  obsession: 'obsession',
  neurosis: 'neurosis',
  psychosis: 'psychosis',
  affective: 'affective',
})

/**
 * A mark in play, or ended. A cured mark (engine/curing.js) stays as what
 * happened and does nothing: every reader of marks looks at active ones.
 */
export const MARK_STATUSES = Object.freeze({
  active: 'active',
  cured: 'cured',
})

/** What a mark can be about. Each is an id in its own registry. */
export const MARK_TARGET_KINDS = Object.freeze({
  location: 'location',
  character: 'character',
  item: 'item',
  substance: 'substance',
  condition: 'condition',
  topic: 'topic',
})

/** What sets a mark's fit off. */
export const FIT_TRIGGER_KINDS = Object.freeze({
  // Its target is right there: the place, the person, the thing in hand, the drug in you.
  target: 'target',
  // A vital past a line, like a condition's source.
  status: 'status',
  // A condition acting on the subject.
  condition: 'condition',
  // Nobody else here.
  alone: 'alone',
  // Somebody else here.
  company: 'company',
})

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Whether two targets are the same thing. Two nothings are the same.
 * @param {{ first: { kind: string, id: string }|null, second: { kind: string, id: string }|null }} input
 * @returns {boolean}
 */
function targetSame({ first, second }) {
  if (!first || !second) return !first && !second
  return first.kind === second.kind && first.id === second.id
}

/**
 * Whether a mark definition can be about a kind of thing (null: about nothing).
 * @param {{ definition: Object, targetKind: string|null }} input
 * @returns {boolean}
 */
function markFits({ definition, targetKind }) {
  if (definition.targetKinds.length === 0) return true
  return targetKind !== null && definition.targetKinds.includes(targetKind)
}

/**
 * Whether a table can come down to a mark that can be about the target
 * kind, looking no deeper than depthLeft.
 * @param {{ tables: Object, marks: Object, tableId: string, targetKind: string|null, depthLeft: number }} input
 * @returns {boolean}
 */
function tableReaches({ tables, marks, tableId, targetKind, depthLeft }) {
  if (depthLeft <= 0 || !tables[tableId]) return false
  return tables[tableId].entries.some((entry) =>
    entry.markId
      ? Boolean(marks[entry.markId]) && markFits({ definition: marks[entry.markId], targetKind })
      : tableReaches({
          tables,
          marks,
          tableId: entry.tableId,
          targetKind,
          depthLeft: depthLeft - 1,
        })
  )
}

/**
 * Whether a subject's scene has a mark's target in it.
 * @param {{ target: { kind: string, id: string }|null, scene: Object }} input
 * @returns {boolean}
 */
function targetPresent({ target, scene }) {
  if (!target) return false
  const present = {
    [MARK_TARGET_KINDS.location]: () => scene.locationId === target.id,
    [MARK_TARGET_KINDS.character]: () => scene.characterIds.includes(target.id),
    [MARK_TARGET_KINDS.item]: () => inventoryHas({ inventory: scene.inventory, itemId: target.id }),
    [MARK_TARGET_KINDS.substance]: () => (scene.intoxications[target.id] ?? 0) > 0,
    [MARK_TARGET_KINDS.condition]: () => scene.conditionIds.includes(target.id),
    [MARK_TARGET_KINDS.topic]: () => scene.topicIds.includes(target.id),
  }
  return present[target.kind]?.() ?? false
}

/**
 * Whether a trigger holds for a mark in a scene: the same triggers set off
 * a mark's fit and an act (engine/acts.js). Only the target trigger reads
 * the mark; the rest read the scene.
 * @param {{ mark: { target: { kind: string, id: string }|null }|null, trigger: Object, scene: Object }} input
 * @returns {boolean}
 */
export function triggerHolds({ mark, trigger, scene }) {
  if (trigger.kind === FIT_TRIGGER_KINDS.target)
    return targetPresent({ target: mark?.target ?? null, scene })
  if (trigger.kind === FIT_TRIGGER_KINDS.status) {
    const value = scene.status?.[trigger.status]
    if (value === undefined || value === null) return false
    return typeof trigger.below === 'number' ? value < trigger.below : value > trigger.above
  }
  if (trigger.kind === FIT_TRIGGER_KINDS.condition) {
    return scene.conditionIds.includes(trigger.conditionId)
  }
  if (trigger.kind === FIT_TRIGGER_KINDS.alone) return scene.characterIds.length === 0
  if (trigger.kind === FIT_TRIGGER_KINDS.company) return scene.characterIds.length > 0
  return false
}

/**
 * Whether an action is about a target: its place, its person, its thing,
 * its drug, its topic.
 * @param {{ action: Object, target: { kind: string, id: string } }} input
 * @returns {boolean}
 */
function actionInvolves({ action, target }) {
  const involved = {
    [MARK_TARGET_KINDS.location]: () => action.locationId === target.id,
    [MARK_TARGET_KINDS.character]: () => action.characterId === target.id,
    [MARK_TARGET_KINDS.item]: () =>
      (action.requirements?.requiredItems ?? []).includes(target.id) ||
      (action.success?.itemsGained ?? []).includes(target.id),
    [MARK_TARGET_KINDS.substance]: () =>
      (action.success?.doses ?? []).some((dose) => dose.substanceId === target.id),
    [MARK_TARGET_KINDS.topic]: () => (action.topicIds ?? []).includes(target.id),
  }
  return involved[target.kind]?.() ?? false
}

/**
 * The active marks a subject carries, each with its definition.
 * @param {{ subject: Object, marks: Object<string, Object> }} input
 * @returns {Array<{ mark: Object, definition: Object }>}
 */
function marksActive({ subject, marks }) {
  return (subject?.psyche?.marks ?? [])
    .filter((mark) => mark.status === MARK_STATUSES.active && marks[mark.markId])
    .map((mark) => ({ mark, definition: marks[mark.markId] }))
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Roll the nested tables down to one mark definition that can be about the
 * target kind. An entry that cannot get there, within depthMax tables, is
 * not on offer; a table with nothing on offer comes down to nothing.
 *
 * @param {{
 *   tables: Object<string, Object>,
 *   marks: Object<string, Object>,
 *   tableId: string,
 *   targetKind: string|null,
 *   depthMax: number,
 *   rng: () => number,
 * }} input
 *   targetKind — what the mark would be about; null for nothing in particular
 * @returns {{ ok: boolean, data: { markId: string|null }|null, error: Object|null }}
 */
export function psycheTableRoll({ tables, marks, tableId, targetKind, depthMax, rng }) {
  let current = tableId
  // Every entry on offer is known to reach a mark in time, so this ends.
  for (let depth = 0; ; depth++) {
    const table = tables[current]
    if (!table) {
      return resultFail({
        code: PSYCHE_ERROR_CODES.tableUnknown,
        message: `No psyche table '${current}'`,
        params: { tableId: current },
      })
    }
    const depthLeft = depthMax - depth - 1
    const offered = table.entries.filter((entry) =>
      entry.markId
        ? Boolean(marks[entry.markId]) && markFits({ definition: marks[entry.markId], targetKind })
        : tableReaches({ tables, marks, tableId: entry.tableId, targetKind, depthLeft })
    )
    const entry = randomPickWeighted({ items: offered, weightOf: (e) => e.weight, rng })
    if (!entry) return resultOk({ markId: null })
    if (entry.markId) return resultOk({ markId: entry.markId })
    current = entry.tableId
  }
}

/**
 * Something happened. The subject saves against it; fail, and the tables
 * say what it leaves. The mark is about the target when its kind can be,
 * and about nothing when it is about nothing. Having the same mark about
 * the same thing already adds nothing.
 *
 * @param {{
 *   tuning: Object,
 *   subject: Object,
 *   marks: Object<string, Object>,
 *   tables: Object<string, Object>,
 *   trauma: { save: { stat: string, dc: number }, tableId: string },
 *   target: { kind: string, id: string }|null,
 *   source: { kind: string, id: string },
 *   gameTime: { tick: number },
 *   rng: () => number,
 * }} input
 * @returns {{ ok: boolean, data: {
 *   saved: boolean,
 *   check: Object,
 *   mark: Object|null,
 *   duplicate: boolean,
 *   marks: Object[],
 * }|null, error: Object|null }}
 *   check — the save as rolled; mark — the new mark, if one was left; marks — the subject's marks after
 */
export function psycheTrauma({
  tuning,
  subject,
  marks,
  tables,
  trauma,
  target,
  source,
  gameTime,
  rng,
}) {
  if (!subject) {
    return resultFail({
      code: PSYCHE_ERROR_CODES.subjectMissing,
      message: 'psycheTrauma needs a subject',
    })
  }
  if (!subject.stats?.[trauma.save.stat]) {
    return resultFail({
      code: PSYCHE_ERROR_CODES.statUnknown,
      message: `No stat '${trauma.save.stat}' to save with`,
      params: { stat: trauma.save.stat },
    })
  }
  const current = subject.psyche?.marks ?? []
  const check = checkRoll({
    tuning,
    player: subject,
    statName: trauma.save.stat,
    modifiers: [],
    dc: trauma.save.dc,
    rng,
  })
  const unmarked = ({ duplicate }) =>
    resultOk({ saved: !duplicate, check, mark: null, duplicate, marks: [...current] })
  if (check.success) return unmarked({ duplicate: false })

  const rolled = psycheTableRoll({
    tables,
    marks,
    tableId: trauma.tableId,
    targetKind: target?.kind ?? null,
    depthMax: tuning.psyche.tableDepthMax,
    rng,
  })
  if (!rolled.ok) return rolled
  if (!rolled.data.markId) return unmarked({ duplicate: false })

  const definition = marks[rolled.data.markId]
  const about = definition.targetKinds.length > 0 ? target : null
  if (
    current.some(
      (m) => m.markId === definition.id && targetSame({ first: m.target, second: about })
    )
  ) {
    return unmarked({ duplicate: true })
  }
  const mark = {
    id: uuidv4(),
    markId: definition.id,
    target: about ? { kind: about.kind, id: about.id } : null,
    source: { kind: source.kind, id: source.id },
    status: MARK_STATUSES.active,
    fitTicksRemaining: 0,
    cures: {},
    acquiredAtTick: gameTime.tick,
    updatedAtTick: gameTime.tick,
  }
  return resultOk({ saved: false, check, mark, duplicate: false, marks: [...current, mark] })
}

/**
 * Time in charge wears a groove. Every tick a persona is in charge (not the
 * subject's own self, and not a fit a mark threw) counts toward it; when the
 * count reaches tuning.psyche.groove.ticksInCharge it is due — the persona's
 * source is what the groove is about — and the count starts over.
 *
 * @param {{ tuning: Object, subject: Object, ticksElapsed: number }} input
 * @returns {{ ok: boolean, data: {
 *   grooves: Object<string, number>,
 *   due: { personaId: string, target: { kind: string, id: string } }|null,
 * }|null, error: Object|null }}
 */
export function psycheGrooveTick({ tuning, subject, ticksElapsed }) {
  if (!subject) {
    return resultFail({
      code: PSYCHE_ERROR_CODES.subjectMissing,
      message: 'psycheGrooveTick needs a subject',
    })
  }
  if (!Number.isFinite(ticksElapsed) || ticksElapsed < 0) {
    return resultFail({
      code: PSYCHE_ERROR_CODES.ticksInvalid,
      message: `ticksElapsed must be >= 0, got ${ticksElapsed}`,
    })
  }
  const grooves = { ...(subject.psyche?.grooves ?? {}) }
  // The subject's own self is never a weight in the blend, so it wears nothing.
  const personaId = subject.blend?.dominantPersonaId
  const weight = (subject.blend?.weights ?? []).find((w) => w.personaId === personaId)
  if (!weight || weight.source === PERSONA_SOURCES.mark) {
    return resultOk({ grooves, due: null })
  }
  grooves[personaId] = (grooves[personaId] ?? 0) + ticksElapsed
  if (grooves[personaId] < tuning.psyche.groove.ticksInCharge)
    return resultOk({ grooves, due: null })
  grooves[personaId] = 0
  const kind =
    weight.source === PERSONA_SOURCES.condition
      ? MARK_TARGET_KINDS.condition
      : MARK_TARGET_KINDS.substance
  return resultOk({ grooves, due: { personaId, target: { kind, id: weight.sourceId } } })
}

/**
 * Fits run their course, and start. A mark in a fit counts down; a mark
 * whose trigger holds may go off, at its chance for every tick the trigger
 * held. A mark with no fit never goes off.
 *
 * @param {{
 *   subject: Object,
 *   marks: Object<string, Object>,
 *   scene: {
 *     locationId: string|null,
 *     characterIds: string[],
 *     inventory: Object[],
 *     intoxications: Object<string, number>,
 *     conditionIds: string[],
 *     topicIds: string[],
 *     status: Object<string, number>|null,
 *   },
 *   ticksElapsed: number,
 *   gameTime: { tick: number },
 *   rng: () => number,
 * }} input
 *   scene — where the subject is and what is around them: who else is
 *   there, what they carry, what is in them, which conditions act on them,
 *   what the talk here is about
 * @returns {{ ok: boolean, data: { marks: Object[], startedIds: string[], endedIds: string[] }|null, error: Object|null }}
 *   startedIds, endedIds — the marks whose fits started and ended
 */
export function psycheFitsTick({ subject, marks, scene, ticksElapsed, gameTime, rng }) {
  if (!subject) {
    return resultFail({
      code: PSYCHE_ERROR_CODES.subjectMissing,
      message: 'psycheFitsTick needs a subject',
    })
  }
  if (!Number.isFinite(ticksElapsed) || ticksElapsed < 0) {
    return resultFail({
      code: PSYCHE_ERROR_CODES.ticksInvalid,
      message: `ticksElapsed must be >= 0, got ${ticksElapsed}`,
    })
  }
  const startedIds = []
  const endedIds = []
  const next = (subject.psyche?.marks ?? []).map((mark) => {
    const definition = marks[mark.markId]
    if (mark.status !== MARK_STATUSES.active || !definition?.fit) return { ...mark }
    if (mark.fitTicksRemaining > 0) {
      const left = Math.max(0, mark.fitTicksRemaining - ticksElapsed)
      if (left === 0) endedIds.push(mark.id)
      return { ...mark, fitTicksRemaining: left, updatedAtTick: gameTime.tick }
    }
    if (!triggerHolds({ mark, trigger: definition.fit.trigger, scene })) return { ...mark }
    const chance = 1 - (1 - definition.fit.chancePerTick) ** ticksElapsed
    if (!randomChance({ probability: chance, rng })) return { ...mark }
    startedIds.push(mark.id)
    return { ...mark, fitTicksRemaining: definition.fit.ticks, updatedAtTick: gameTime.tick }
  })
  return resultOk({ marks: next, startedIds, endedIds })
}

/**
 * What a subject's marks put into the blend (engine/blend.js blendCompute
 * `psyche`): for every active mark, its standing effect (stats, confusion,
 * no persona), and for a mark in a fit, the fit (a persona with a weight,
 * its stats, its confusion).
 * @param {{ subject: Object, marks: Object<string, Object> }} input
 * @returns {Array<{ sourceId: string, personaId: string|null, weight: number, modifiers: Object[], confusion: number }>}
 */
export function psycheBlendSources({ subject, marks }) {
  const sources = []
  for (const { mark, definition } of marksActive({ subject, marks })) {
    sources.push({
      sourceId: definition.id,
      personaId: null,
      weight: 0,
      modifiers: definition.modifiers ?? [],
      confusion: definition.confusion ?? 0,
    })
    if (mark.fitTicksRemaining > 0 && definition.fit) {
      sources.push({
        sourceId: definition.id,
        personaId: definition.fit.persona.id,
        weight: definition.fit.weight,
        modifiers: definition.fit.modifiers,
        confusion: definition.fit.confusion,
      })
    }
  }
  return sources
}

/**
 * The mark that will not let the subject go near a target, or null.
 * @param {{ subject: Object, marks: Object<string, Object>, target: { kind: string, id: string } }} input
 * @returns {Object|null} the mark instance
 */
export function psycheAvoids({ subject, marks, target }) {
  const hit = marksActive({ subject, marks }).find(
    ({ mark, definition }) =>
      definition.avoids && targetSame({ first: mark.target, second: target })
  )
  return hit?.mark ?? null
}

/**
 * How hard the subject's marks pull toward an action: the sum of the draws
 * of every mark whose target the action is about. Love and hate pull alike.
 * @param {{ subject: Object, marks: Object<string, Object>, action: Object }} input
 * @returns {number} 0 for no pull; 0.5 adds half the action's weight
 */
export function psycheDraw({ subject, marks, action }) {
  let draw = 0
  for (const { mark, definition } of marksActive({ subject, marks })) {
    if (!definition.draws || !mark.target) continue
    if (actionInvolves({ action, target: mark.target })) draw += definition.draws
  }
  return draw
}
