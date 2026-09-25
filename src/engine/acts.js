/**
 * Acts Engine — people start things.
 *
 * An event happens to the player. An act has an author: somebody does it.
 * Content (content/acts) says who can (a named character, anyone with a
 * persona in charge, anyone with a mark in a fit), when (the same triggers
 * that set a mark's fit off, read from the author's own scene), to whom
 * (the player, the mark's target, anyone present, nobody), and what comes
 * of it (the outcome contract, landing on the one it is done to and on the
 * author). An act with a check is a contest: the author's stat against the
 * recipient's, and the side that takes it picks the branch.
 *
 * Pure functions. No side effects. No Vue. No DOM. Every public function
 * takes a single input struct; the ones that can fail return a result
 * struct (ok/data/error).
 */

import { resultOk, resultFail } from './result.js'
import { checkContestedRoll, CONTEST_WINNERS } from './dice.js'
import { MARK_STATUSES, triggerHolds } from './psyche.js'
import { randomChance, randomPickWeighted } from '../utils/random.js'

/** Enumerated error codes for every acts result. The code is the contract. */
export const ACT_ERROR_CODES = Object.freeze({
  authorMissing: 'AUTHOR_MISSING',
  recipientMissing: 'RECIPIENT_MISSING',
  statUnknown: 'STAT_UNKNOWN',
  ticksInvalid: 'TICKS_INVALID',
})

/** Somebody an outcome can land on. */
export const SUBJECT_KINDS = Object.freeze({
  player: 'player',
  character: 'character',
})

/** Who can author an act. */
export const ACT_AUTHOR_KINDS = Object.freeze({
  // This one person.
  character: 'character',
  // Anyone with this persona in charge.
  persona: 'persona',
  // Anyone with this mark, while it is in a fit.
  mark: 'mark',
})

/** Whom an act is done to. */
export const ACT_RECIPIENT_KINDS = Object.freeze({
  // The player, who has to be there.
  player: 'player',
  // The person the author's mark is about, who has to be there.
  target: 'target',
  // Whoever is there, the player included.
  anyone: 'anyone',
  // Nobody: the author does it to themselves, or to the room.
  none: 'none',
})

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * The author's mark an act is authored by, in a fit, or null: a mark author
 * needs the mark going off; a persona or character author has no mark.
 * @param {{ act: Object, author: Object }} input
 * @returns {Object|null}
 */
function markInFit({ act, author }) {
  if (act.author.kind !== ACT_AUTHOR_KINDS.mark) return null
  return (
    (author.psyche?.marks ?? []).find(
      (mark) =>
        mark.markId === act.author.id &&
        mark.status === MARK_STATUSES.active &&
        mark.fitTicksRemaining > 0
    ) ?? null
  )
}

/**
 * Whether the author is who the act says can do it.
 * @param {{ act: Object, author: Object }} input
 * @returns {boolean}
 */
function authorIs({ act, author }) {
  const is = {
    [ACT_AUTHOR_KINDS.character]: () => author.id === act.author.id,
    [ACT_AUTHOR_KINDS.persona]: () => author.blend?.dominantPersonaId === act.author.id,
    [ACT_AUTHOR_KINDS.mark]: () => markInFit({ act, author }) !== null,
  }
  return is[act.author.kind]?.() ?? false
}

/**
 * Whom the act lands on, or null when nobody it could land on is there.
 * @param {{ act: Object, mark: Object|null, scene: Object, rng: () => number }} input
 * @returns {{ kind: string, id: string }|null}
 */
function recipientPick({ act, mark, scene, rng }) {
  const asSubject = (id) =>
    id === scene.playerId
      ? { kind: SUBJECT_KINDS.player, id }
      : { kind: SUBJECT_KINDS.character, id }
  if (act.to === ACT_RECIPIENT_KINDS.none) return null
  if (act.to === ACT_RECIPIENT_KINDS.player) {
    return scene.playerId ? { kind: SUBJECT_KINDS.player, id: scene.playerId } : null
  }
  if (act.to === ACT_RECIPIENT_KINDS.target) {
    const target = mark?.target
    if (target?.kind !== SUBJECT_KINDS.character) return null
    return scene.characterIds.includes(target.id) ? asSubject(target.id) : null
  }
  const picked = randomPickWeighted({ items: scene.characterIds, weightOf: () => 1, rng })
  return picked ? asSubject(picked) : null
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Whether an author would do something this tick, and to whom. Each act
 * the author can do, in order, whose trigger holds and whose recipient is
 * there, may go off at its chance for every tick; the first that does is
 * the act. One act per author per tick.
 *
 * @param {{
 *   acts: Object[],
 *   author: Object,
 *   scene: {
 *     locationId: string|null,
 *     characterIds: string[],
 *     playerId: string|null,
 *     inventory: Object[],
 *     intoxications: Object<string, number>,
 *     conditionIds: string[],
 *     topicIds: string[],
 *     status: Object<string, number>|null,
 *   },
 *   ticksElapsed: number,
 *   rng: () => number,
 * }} input
 *   scene — the author's: who else is there (the player's id among them
 *   when the player is, and playerId says which), what is in them, what
 *   the talk is about
 * @returns {{ ok: boolean, data: {
 *   act: Object|null,
 *   mark: Object|null,
 *   recipient: { kind: string, id: string }|null,
 * }|null, error: Object|null }}
 *   mark — the author's mark the act came from, for a mark author
 */
export function actsRoll({ acts, author, scene, ticksElapsed, rng }) {
  if (!author) {
    return resultFail({ code: ACT_ERROR_CODES.authorMissing, message: 'actsRoll needs an author' })
  }
  if (!Number.isFinite(ticksElapsed) || ticksElapsed < 0) {
    return resultFail({
      code: ACT_ERROR_CODES.ticksInvalid,
      message: `ticksElapsed must be >= 0, got ${ticksElapsed}`,
    })
  }
  for (const act of acts) {
    if (!authorIs({ act, author })) continue
    const mark = markInFit({ act, author })
    if (act.trigger && !triggerHolds({ mark, trigger: act.trigger, scene })) continue
    const recipient = recipientPick({ act, mark, scene, rng })
    if (!recipient && act.to !== ACT_RECIPIENT_KINDS.none) continue
    const chance = 1 - (1 - act.chancePerTick) ** ticksElapsed
    if (!randomChance({ probability: chance, rng })) continue
    return resultOk({ act, mark, recipient })
  }
  return resultOk({ act: null, mark: null, recipient: null })
}

/**
 * What comes of an act: with a check, the author's stat against the
 * recipient's, and the winner's branch; without one, it simply comes off.
 * Nothing is applied here.
 *
 * @param {{
 *   tuning: Object,
 *   act: Object,
 *   author: Object,
 *   recipient: Object|null,
 *   rng: () => number,
 * }} input
 *   recipient — the one it is done to, as a subject with stats; null for none
 * @returns {{ ok: boolean, data: {
 *   succeeded: boolean,
 *   branch: Object,
 *   contest: { winner: string, first: Object, second: Object }|null,
 * }|null, error: Object|null }}
 *   branch — act.success or act.failure; contest — the rolls, first the author's, second the recipient's
 */
export function actResolve({ tuning, act, author, recipient, rng }) {
  if (!author) {
    return resultFail({
      code: ACT_ERROR_CODES.authorMissing,
      message: 'actResolve needs an author',
    })
  }
  if (!act.check) return resultOk({ succeeded: true, branch: act.success, contest: null })
  if (!recipient) {
    return resultFail({
      code: ACT_ERROR_CODES.recipientMissing,
      message: `Act '${act.id}' has a check and nobody to check against`,
      params: { actId: act.id },
    })
  }
  for (const [subject, statName] of [
    [author, act.check.stat],
    [recipient, act.check.opposedStat],
  ]) {
    if (!subject.stats?.[statName]) {
      return resultFail({
        code: ACT_ERROR_CODES.statUnknown,
        message: `No stat '${statName}' to roll`,
        params: { stat: statName, actId: act.id },
      })
    }
  }
  const contest = checkContestedRoll({
    tuning,
    first: { player: author, statName: act.check.stat },
    second: { player: recipient, statName: act.check.opposedStat },
    rng,
  })
  const succeeded = contest.winner === CONTEST_WINNERS.first
  return resultOk({ succeeded, branch: succeeded ? act.success : act.failure, contest })
}
