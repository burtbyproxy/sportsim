/**
 * Minigame Engine — the work, played.
 *
 * Every art form is worked through a small game that is an abstract of the
 * form itself: a tag is nerve, a carving is knowing when to stop cutting, a
 * few lines are the words you pick, a performance is a room you read. One
 * round is one sitting. The game never replaces the die: when the work is
 * done it hands the finishing check one itemized modifier, so skill, stat,
 * blend and the idea all still count.
 *
 * A game is content (content/games): a shape, its parameters, its choice
 * labels, the voice codes for what happens, and compulsions — choices the
 * persona in charge will not let the player make. The shapes are the only
 * code. A new art form that plays like an old one is a JSON file.
 *
 * The persona interferes with the input, never the score: it forbids a
 * choice, or it leans on what is offered.
 *
 * State is a plain object the caller stores on the making record. It always
 * carries `offer` — the choices for the coming round, or null when the game
 * is over — so the round the player sees is the round that gets resolved.
 *
 * Pure functions. No side effects. No Vue. No DOM. Single input struct in,
 * result struct out.
 */

import { randomPickWeighted, randomShuffle, randomInt } from '../utils/random.js'
import { resultOk, resultFail } from './result.js'
import { numberClamp } from '../utils/number.js'

/** Enumerated error codes for every minigame result. The code is the contract. */
export const MINIGAME_ERROR_CODES = Object.freeze({
  gameInvalid: 'GAME_INVALID',
  shapeUnknown: 'SHAPE_UNKNOWN',
  gameOver: 'GAME_OVER',
  choiceUnknown: 'CHOICE_UNKNOWN',
  choiceForbidden: 'CHOICE_FORBIDDEN',
})

/** Every shape a game can take. */
export const GAME_SHAPES = Object.freeze({
  steady: 'steady',
  pushLuck: 'push_luck',
  wordPick: 'word_pick',
  readRoom: 'read_room',
})

/** The source id of the modifier a game hands the finishing check. */
export const GAME_MODIFIER_SOURCE_ID = 'game'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * The coming round's choices: the game's labels, minus what the persona in
 * charge will not allow this round.
 */
function offerBuild({ game, choiceIds, round, personaId }) {
  const choices = choiceIds.map((id) => {
    const compulsion = (game.compulsions ?? []).find(
      (c) =>
        c.personaId === personaId &&
        c.choiceId === id &&
        round >= (c.fromRound ?? 1) &&
        round <= (c.toRound ?? Infinity)
    )
    return {
      id,
      label: game.choices[id].label,
      available: !compulsion,
      reason: compulsion ? compulsion.reason : null,
    }
  })
  return { round, choices }
}

// ── steady: you keep at it ──────────────────────────────────────────────────

const shapeSteady = {
  start({ game, personaId }) {
    return {
      state: { offer: offerBuild({ game, choiceIds: ['work'], round: 1, personaId }) },
      promptCode: null,
    }
  },
  resolve({ game, state, personaId }) {
    const round = state.offer.round + 1
    return {
      state: { offer: offerBuild({ game, choiceIds: ['work'], round, personaId }) },
      lineCode: game.lines.work,
      lineParams: {},
      workDone: false,
      promptCode: null,
    }
  },
  score() {
    return 0
  },
}

// ── push_luck: every beat makes it better and makes it likelier to end badly ─

const shapePushLuck = {
  start({ game, personaId }) {
    return {
      state: {
        banked: 0,
        busted: false,
        offer: offerBuild({ game, choiceIds: ['press', 'stop'], round: 1, personaId }),
      },
      promptCode: null,
    }
  },
  resolve({ game, state, choiceId, personaId, skillValue, rng }) {
    const { riskBase, riskStep, skillRelief } = game.params
    if (choiceId === 'stop') {
      return {
        state: { ...state, offer: null },
        lineCode: game.lines.stopped,
        lineParams: {},
        workDone: true,
        promptCode: null,
      }
    }
    const risk = numberClamp({
      value: riskBase + riskStep * state.banked - skillRelief * skillValue,
      min: 0.02,
      max: 0.95,
    })
    if (rng() < risk) {
      return {
        state: { ...state, busted: true, offer: null },
        lineCode: game.lines.busted,
        lineParams: {},
        workDone: true,
        promptCode: null,
      }
    }
    const round = state.offer.round + 1
    return {
      state: {
        ...state,
        banked: state.banked + 1,
        offer: offerBuild({ game, choiceIds: ['press', 'stop'], round, personaId }),
      },
      lineCode: game.lines.pressed,
      lineParams: {},
      workDone: false,
      promptCode: null,
    }
  },
  score({ game, state }) {
    if (state.busted) return game.params.bustModifier
    if (state.banked === 0) return game.params.timidModifier
    return Math.min(state.banked, game.params.bankCap)
  },
}

// ── word_pick: the words you choose are the piece ───────────────────────────

function wordsOffer({ game, state, round, personaId, rng }) {
  const used = new Set(state.words.map((w) => w.word))
  const registers = Object.keys(game.params.registers)
  const lean = game.params.personaLean?.[personaId] ?? null
  // The persona in charge leans on the draw: two of the three come from its register.
  const slots = lean
    ? [lean, lean, ...randomShuffle({ items: registers.filter((r) => r !== lean), rng })]
    : randomShuffle({ items: registers, rng })
  const picks = []
  for (const register of slots) {
    if (picks.length === game.params.picksPerRound) break
    const pool = game.params.registers[register].filter(
      (word) => !used.has(word) && !picks.some((p) => p.word === word)
    )
    if (pool.length === 0) continue
    picks.push({ word: pool[randomInt({ min: 0, max: pool.length - 1, rng })], register })
  }
  return {
    round,
    choices: picks.map((pick) => ({
      id: pick.word,
      label: pick.word,
      available: true,
      reason: null,
      register: pick.register,
    })),
  }
}

const shapeWordPick = {
  start({ game, personaId, rng }) {
    const state = { words: [] }
    return {
      state: { ...state, offer: wordsOffer({ game, state, round: 1, personaId, rng }) },
      promptCode: null,
    }
  },
  resolve({ game, state, choiceId, personaId, rng }) {
    const chosen = state.offer.choices.find((c) => c.id === choiceId)
    const next = { words: [...state.words, { word: chosen.id, register: chosen.register }] }
    const round = state.offer.round + 1
    return {
      state: { ...next, offer: wordsOffer({ game, state: next, round, personaId, rng }) },
      lineCode: game.lines.picked,
      lineParams: { word: chosen.id },
      workDone: false,
      promptCode: null,
    }
  },
  score({ game, state }) {
    // A voice is words that belong together. One of everything is mush.
    const counts = {}
    for (const { register } of state.words) counts[register] = (counts[register] ?? 0) + 1
    const largest = Math.max(0, ...Object.values(counts))
    if (largest <= 1) return state.words.length > 1 ? game.params.mushModifier : 0
    return Math.min(largest - 1, game.params.voiceCap)
  },
}

// ── read_room: push when they are with you, hold when they are not ──────────

const shapeReadRoom = {
  start({ game, personaId }) {
    const crowd = game.params.crowdStart
    return {
      state: {
        crowd,
        total: 0,
        offer: offerBuild({ game, choiceIds: ['push', 'hold', 'bow'], round: 1, personaId }),
      },
      promptCode: game.lines.crowd[crowd],
    }
  },
  resolve({ game, state, choiceId, personaId, rng }) {
    if (choiceId === 'bow') {
      return {
        state: { ...state, offer: null },
        lineCode: game.lines.bowed,
        lineParams: {},
        workDone: true,
        promptCode: null,
      }
    }
    const move = game.params.transitions[state.crowd][choiceId]
    const crowd = randomPickWeighted({ items: move.to, weightOf: (t) => t.weight, rng }).crowd
    const round = state.offer.round + 1
    return {
      state: {
        crowd,
        total: state.total + move.score,
        offer: offerBuild({ game, choiceIds: ['push', 'hold', 'bow'], round, personaId }),
      },
      lineCode: choiceId === 'push' ? game.lines.pushed : game.lines.held,
      lineParams: {},
      workDone: false,
      promptCode: game.lines.crowd[crowd],
    }
  },
  score({ game, state }) {
    return numberClamp({
      value: state.total,
      min: -game.params.scoreCap,
      max: game.params.scoreCap,
    })
  },
}

const SHAPES = {
  [GAME_SHAPES.steady]: shapeSteady,
  [GAME_SHAPES.pushLuck]: shapePushLuck,
  [GAME_SHAPES.wordPick]: shapeWordPick,
  [GAME_SHAPES.readRoom]: shapeReadRoom,
}

function shapeOf(game) {
  if (!game || typeof game !== 'object' || typeof game.shape !== 'string') {
    return resultFail({ code: MINIGAME_ERROR_CODES.gameInvalid, message: 'A game needs a shape' })
  }
  if (!game.lines || typeof game.lines !== 'object') {
    return resultFail({
      code: MINIGAME_ERROR_CODES.gameInvalid,
      message: `Game '${game.id}' has no lines`,
    })
  }
  const shape = SHAPES[game.shape]
  if (!shape)
    return resultFail({
      code: MINIGAME_ERROR_CODES.shapeUnknown,
      message: `Unknown game shape '${game.shape}'`,
    })
  return resultOk(shape)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Begin a game. The state that comes back carries the first round's offer.
 *
 * @param {{ game: Object, personaId: string, rng?: () => number }} input
 * @returns {{ ok: boolean, data: { state: Object, promptCode: string|null }|null, error: Object|null }}
 *   promptCode — a voice code that sets the scene for the first round, when the game has one.
 */
export function gameStart({ game, personaId, rng = Math.random }) {
  const shape = shapeOf(game)
  if (!shape.ok) return shape
  return resultOk(shape.data.start({ game, personaId, rng }))
}

/**
 * Play one round: the player's choice against the offer in the state.
 *
 * @param {{
 *   game: Object,
 *   state: Object,
 *   choiceId: string,
 *   personaId: string,
 *   skillValue?: number,
 *   rng?: () => number,
 * }} input
 *   skillValue — the player's effective skill in the medium, 0–100. Practice steadies the hand.
 * @returns {{ ok: boolean, data: {
 *   state: Object,
 *   lineCode: string,
 *   lineParams: Object<string, string>,
 *   workDone: boolean,
 *   promptCode: string|null,
 * }|null, error: Object|null }}
 *   workDone — the game ended the work early: the player stopped, or it went wrong.
 */
export function gameRoundResolve({
  game,
  state,
  choiceId,
  personaId,
  skillValue = 0,
  rng = Math.random,
}) {
  const shape = shapeOf(game)
  if (!shape.ok) return shape
  if (!state?.offer)
    return resultFail({
      code: MINIGAME_ERROR_CODES.gameOver,
      message: 'This game has no round to play',
    })
  const choice = state.offer.choices.find((c) => c.id === choiceId)
  if (!choice) {
    return resultFail({
      code: MINIGAME_ERROR_CODES.choiceUnknown,
      message: `'${choiceId}' is not on offer this round`,
    })
  }
  if (!choice.available) {
    return resultFail({
      code: MINIGAME_ERROR_CODES.choiceForbidden,
      message: choice.reason ?? `'${choiceId}' is forbidden`,
    })
  }
  return resultOk(shape.data.resolve({ game, state, choiceId, personaId, skillValue, rng }))
}

/**
 * What the game is worth to the finishing check, and any words it produced.
 *
 * @param {{ game: Object, state: Object }} input
 * @returns {{ ok: boolean, data: { modifier: { sourceId: string, value: number }, words: string[] }|null, error: Object|null }}
 */
export function gameScore({ game, state }) {
  const shape = shapeOf(game)
  if (!shape.ok) return shape
  return resultOk({
    modifier: { sourceId: GAME_MODIFIER_SOURCE_ID, value: shape.data.score({ game, state }) },
    words: (state.words ?? []).map((w) => w.word),
  })
}
