/**
 * Fight Engine — real fights, as they actually go.
 *
 * A short squaring off, a frantic little moment, and then one person on
 * the other on the ground. Fast, and boring. The squaring off is the only
 * part anyone chooses: each round the player picks a jab (content, a
 * contest of one stat against another), the round's loser takes the jab's
 * heat, and everything gets hotter regardless. The side whose heat reaches
 * the line cracks and swings first, which is bad: the first swing is a
 * penalty, because it makes you reactive. Walking away is always a choice
 * until somebody swings. Swinging first on purpose is too.
 *
 * The swing and the ground are not chosen. The swing is one contest, and
 * the loser takes a knock to the head; past the knockout line the fight is
 * over where they fall. Otherwise it goes to the ground: contest after
 * contest until one side is on top enough times, or whoever is there pulls
 * them apart.
 *
 * A fight is a record on the one who started it (never deleted, like a
 * making), with a status in `ending`. The engine returns what happened
 * (events, by kind and side) and what to apply (a knock here, a knock
 * there); the loop applies, and says it in the voice of whoever is in
 * charge, from whichever side the player is on, or from the bar stool.
 * Either side can be anyone: two people can go at it with the player
 * watching, or the world can come at the player.
 *
 * Pure functions. No side effects. No Vue. No DOM. Every public function
 * takes a single input struct; the ones that can fail return a result
 * struct (ok/data/error).
 */

import { v4 as uuidv4 } from 'uuid'
import { resultOk, resultFail } from './result.js'
import { checkContestedRoll, CONTEST_WINNERS } from './dice.js'
import { randomChance } from '../utils/random.js'

/** Enumerated error codes for every fight result. The code is the contract. */
export const FIGHT_ERROR_CODES = Object.freeze({
  subjectMissing: 'SUBJECT_MISSING',
  fightMissing: 'FIGHT_MISSING',
  alreadyFighting: 'ALREADY_FIGHTING',
  noneInProgress: 'NONE_IN_PROGRESS',
  phaseWrong: 'PHASE_WRONG',
  choiceUnknown: 'CHOICE_UNKNOWN',
  statUnknown: 'STAT_UNKNOWN',
})

/** Where a fight is. */
export const FIGHT_PHASES = Object.freeze({
  // Insults, antagonizing: the only part with choices.
  squaring: 'squaring',
  // Somebody swung; the frantic moment and the ground follow at once.
  swinging: 'swinging',
  over: 'over',
})

/** How a fight ended. */
export const FIGHT_ENDINGS = Object.freeze({
  // The one who started it walked away before anyone swung.
  walked: 'walked',
  // A knock to the head past the line: over where they fell.
  knockout: 'knockout',
  // Rolling around until one was on top enough.
  onTop: 'on_top',
  // Whoever was there pulled them apart. Nobody won.
  pulledApart: 'pulled_apart',
})

/** The two choices on every squaring round that are not a jab. */
export const FIGHT_CHOICES = Object.freeze({
  swing: 'swing',
  walk: 'walk',
})

/** Which side of a fight somebody is on. */
export const FIGHT_SIDES = Object.freeze({ first: 'first', second: 'second' })

/**
 * What happens in a fight, as the engine tells it: a kind and the side it
 * happened to (or for). Whose voice says it, and how, is the loop's.
 */
export const FIGHT_EVENTS = Object.freeze({
  // A jab landed for `side`.
  jab: 'jab',
  // `side` walked away.
  walked: 'walked',
  // `side` swung first, on purpose.
  swungFirst: 'swung_first',
  // `side` cracked, and swings first.
  cracked: 'cracked',
  // `side` landed the swing.
  landed: 'landed',
  // `side` ended up on top.
  onTop: 'on_top',
  // Pulled apart; no side.
  pulledApart: 'pulled_apart',
  // `side` is out.
  knockout: 'knockout',
})

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * The other side.
 * @param {{ side: string }} input
 * @returns {string}
 */
function opposite({ side }) {
  return side === FIGHT_SIDES.first ? FIGHT_SIDES.second : FIGHT_SIDES.first
}

/**
 * Which stat is missing for a contest, or null.
 * @param {{ first: Object, second: Object, statName: string }} input
 * @returns {Object|null} a failure result, or null
 */
function statsMissing({ first, second, statName }) {
  for (const subject of [first, second]) {
    if (!subject.stats?.[statName]) {
      return resultFail({
        code: FIGHT_ERROR_CODES.statUnknown,
        message: `No stat '${statName}' to fight with`,
        params: { stat: statName },
      })
    }
  }
  return null
}

/**
 * A contest between the sides on one stat; a tie goes to nobody, and is
 * rolled again. Returns the winning side.
 * @param {{ tuning: Object, first: Object, second: Object, statName: string, modifiers?: { first: number[], second: number[] }, rng: () => number }} input
 * @returns {string} a FIGHT_SIDES value
 */
function contest({ tuning, first, second, statName, modifiers = { first: [], second: [] }, rng }) {
  const rolled = checkContestedRoll({
    tuning,
    first: { player: first, statName, modifiers: modifiers.first },
    second: { player: second, statName, modifiers: modifiers.second },
    rng,
  })
  if (rolled.winner === CONTEST_WINNERS.first) return FIGHT_SIDES.first
  if (rolled.winner === CONTEST_WINNERS.second) return FIGHT_SIDES.second
  // Nobody got the better of it: a coin, so it ends.
  return rng() < 0.5 ? FIGHT_SIDES.first : FIGHT_SIDES.second
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * The fight the subject is in, or null.
 * @param {{ subject: Object }} input
 * @returns {Object|null}
 */
export function fightActive({ subject }) {
  return (subject?.fights ?? []).find((fight) => fight.phase !== FIGHT_PHASES.over) ?? null
}

/**
 * Somebody starts something with somebody. The one who starts it is the
 * first side, and the fight is on their record. Started with a swing, it
 * skips the squaring off: the first side has already cracked.
 *
 * @param {{
 *   fightDef: Object,
 *   first: Object,
 *   second: Object,
 *   locationId: string|null,
 *   gameTime: { tick: number },
 *   swinging?: boolean,
 * }} input
 *   swinging — the first side comes in swinging, no squaring off
 * @returns {{ ok: boolean, data: { fights: Object[], fight: Object }|null, error: Object|null }}
 */
export function fightStart({ fightDef, first, second, locationId, gameTime, swinging = false }) {
  if (!first || !second) {
    return resultFail({
      code: FIGHT_ERROR_CODES.subjectMissing,
      message: 'fightStart needs two sides',
    })
  }
  if (!fightDef) {
    return resultFail({ code: FIGHT_ERROR_CODES.fightMissing, message: 'fightStart needs a fight' })
  }
  if (fightActive({ subject: first })) {
    return resultFail({
      code: FIGHT_ERROR_CODES.alreadyFighting,
      message: 'Already in a fight',
    })
  }
  const fight = {
    id: uuidv4(),
    fightId: fightDef.id,
    firstId: first.id,
    secondId: second.id,
    locationId,
    phase: swinging ? FIGHT_PHASES.swinging : FIGHT_PHASES.squaring,
    round: 1,
    heat: { first: 0, second: 0 },
    swungFirst: swinging ? FIGHT_SIDES.first : null,
    ground: { first: 0, second: 0 },
    ending: null,
    winner: null,
    startedAtTick: gameTime.tick,
    updatedAtTick: gameTime.tick,
  }
  return resultOk({ fights: [...(first.fights ?? []), fight], fight })
}

/**
 * What the first side may do this squaring round: every jab, the swing,
 * and the walk. Labels carry `{name}` for the loop to fill with the other
 * side's name.
 * @param {{ fightDef: Object, fight: Object }} input
 * @returns {{ ok: boolean, data: { choices: Array<{ id: string, label: string, kind: string }> }|null, error: Object|null }}
 */
export function fightOffer({ fightDef, fight }) {
  if (!fight || fight.phase !== FIGHT_PHASES.squaring) {
    return resultFail({
      code: FIGHT_ERROR_CODES.phaseWrong,
      message: 'Nothing to choose: nobody is squaring off',
    })
  }
  return resultOk({
    choices: [
      ...fightDef.jabs.map((jab) => ({ id: jab.id, label: jab.label, kind: 'jab' })),
      { id: FIGHT_CHOICES.swing, label: fightDef.swing.label, kind: FIGHT_CHOICES.swing },
      { id: FIGHT_CHOICES.walk, label: fightDef.walk.label, kind: FIGHT_CHOICES.walk },
    ],
  })
}

/**
 * One round of squaring off, the first side's choice. A jab is a contest;
 * the loser takes its heat, and both sides take the round's. The side whose
 * heat reaches the line cracks and swings first. Walking ends the fight;
 * swinging starts the swinging.
 *
 * @param {{
 *   tuning: Object,
 *   fightDef: Object,
 *   fight: Object,
 *   first: Object,
 *   second: Object,
 *   choiceId: string,
 *   gameTime: { tick: number },
 *   rng: () => number,
 * }} input
 * @returns {{ ok: boolean, data: {
 *   fight: Object,
 *   events: Array<{ kind: string, side: string|null, jabId?: string }>,
 *   cracked: string|null,
 *   jabWon: boolean|null,
 * }|null, error: Object|null }}
 *   cracked — the side that cracked this round, if one did; jabWon — whether the first side took the jab
 */
export function fightSquareRound({
  tuning,
  fightDef,
  fight,
  first,
  second,
  choiceId,
  gameTime,
  rng,
}) {
  if (!fight || fight.phase !== FIGHT_PHASES.squaring) {
    return resultFail({
      code: FIGHT_ERROR_CODES.phaseWrong,
      message: 'Nobody is squaring off',
    })
  }
  const stamp = (next) => ({ ...fight, ...next, updatedAtTick: gameTime.tick })
  if (choiceId === FIGHT_CHOICES.walk) {
    return resultOk({
      fight: stamp({ phase: FIGHT_PHASES.over, ending: FIGHT_ENDINGS.walked, winner: null }),
      events: [{ kind: FIGHT_EVENTS.walked, side: FIGHT_SIDES.first }],
      cracked: null,
      jabWon: null,
    })
  }
  if (choiceId === FIGHT_CHOICES.swing) {
    return resultOk({
      fight: stamp({ phase: FIGHT_PHASES.swinging, swungFirst: FIGHT_SIDES.first }),
      events: [{ kind: FIGHT_EVENTS.swungFirst, side: FIGHT_SIDES.first }],
      cracked: null,
      jabWon: null,
    })
  }
  const jab = fightDef.jabs.find((j) => j.id === choiceId)
  if (!jab) {
    return resultFail({
      code: FIGHT_ERROR_CODES.choiceUnknown,
      message: `'${choiceId}' is not a way to square off`,
      params: { choiceId },
    })
  }
  const missing =
    statsMissing({ first, second, statName: jab.stat }) ??
    statsMissing({ first, second, statName: jab.opposedStat })
  if (missing) return missing
  const rolled = checkContestedRoll({
    tuning,
    first: { player: first, statName: jab.stat },
    second: { player: second, statName: jab.opposedStat },
    rng,
  })
  const jabWon = rolled.winner === CONTEST_WINNERS.first
  const heat = { ...fight.heat }
  const { heatPerRound, crackAt } = tuning.fight
  // A tie lands on nobody; everything gets hotter anyway.
  if (rolled.winner === CONTEST_WINNERS.first) heat.second += jab.heat
  if (rolled.winner === CONTEST_WINNERS.second) heat.first += jab.heat
  heat.first += heatPerRound
  heat.second += heatPerRound
  const events = [
    {
      kind: FIGHT_EVENTS.jab,
      side: jabWon ? FIGHT_SIDES.first : FIGHT_SIDES.second,
      jabId: jab.id,
    },
  ]
  // The hotter side cracks; at a dead heat, the one who started it.
  let cracked = null
  if (heat.second >= crackAt || heat.first >= crackAt) {
    cracked = heat.second > heat.first ? FIGHT_SIDES.second : FIGHT_SIDES.first
    events.push({ kind: FIGHT_EVENTS.cracked, side: cracked })
  }
  return resultOk({
    fight: stamp({
      heat,
      round: fight.round + 1,
      phase: cracked ? FIGHT_PHASES.swinging : FIGHT_PHASES.squaring,
      swungFirst: cracked,
    }),
    events,
    cracked,
    jabWon,
  })
}

/**
 * The frantic moment, and the ground. The one who swung first swings at a
 * penalty; the swing's loser takes a knock, and past the knockout line it
 * is over where they fell. Otherwise contest after contest on the ground
 * until one side is on top enough times, the bottom taking a knock, or
 * whoever is there pulls them apart. Knocks are returned to be applied.
 *
 * @param {{
 *   tuning: Object,
 *   fight: Object,
 *   first: Object,
 *   second: Object,
 *   bystanders: number,
 *   gameTime: { tick: number },
 *   rng: () => number,
 * }} input
 *   bystanders — how many others are there to pull them apart
 * @returns {{ ok: boolean, data: {
 *   fight: Object,
 *   events: Array<{ kind: string, side: string|null }>,
 *   dazed: { first: number, second: number },
 *   loser: string|null,
 * }|null, error: Object|null }}
 *   loser — the side that lost, or null when they were pulled apart
 */
export function fightResolve({ tuning, fight, first, second, bystanders, gameTime, rng }) {
  if (!fight || fight.phase !== FIGHT_PHASES.swinging || !fight.swungFirst) {
    return resultFail({
      code: FIGHT_ERROR_CODES.phaseWrong,
      message: 'Nobody has swung',
    })
  }
  const { swing, ground, knockoutAt, firstSwingModifier } = tuning.fight
  const missing =
    statsMissing({ first, second, statName: swing.stat }) ??
    statsMissing({ first, second, statName: ground.stat })
  if (missing) return missing
  const dazed = { first: 0, second: 0 }
  const events = []
  const knockedOut = (side) => {
    const subject = side === FIGHT_SIDES.first ? first : second
    return (subject.dazed ?? 0) + dazed[side] >= knockoutAt
  }
  const over = ({ ending, winner, loser, wins = fight.ground }) =>
    resultOk({
      fight: {
        ...fight,
        phase: FIGHT_PHASES.over,
        ending,
        winner,
        ground: wins,
        updatedAtTick: gameTime.tick,
      },
      events,
      dazed,
      loser,
    })

  // The swing: the one who swung first is reactive, and it shows.
  const swinger = fight.swungFirst
  const modifiers = { first: [], second: [] }
  modifiers[swinger] = [firstSwingModifier]
  const landed = contest({ tuning, first, second, statName: swing.stat, modifiers, rng })
  const hit = opposite({ side: landed })
  dazed[hit] += swing.dazedOnHit
  events.push({ kind: FIGHT_EVENTS.landed, side: landed })
  if (knockedOut(hit)) {
    events.push({ kind: FIGHT_EVENTS.knockout, side: hit })
    return over({ ending: FIGHT_ENDINGS.knockout, winner: landed, loser: hit })
  }

  // The ground: fast, and boring.
  const wins = { ...fight.ground }
  for (;;) {
    if (randomChance({ probability: bystanders * ground.pulledApartChancePerBystander, rng })) {
      events.push({ kind: FIGHT_EVENTS.pulledApart, side: null })
      return over({ ending: FIGHT_ENDINGS.pulledApart, winner: null, loser: null, wins })
    }
    const top = contest({ tuning, first, second, statName: ground.stat, rng })
    wins[top] += 1
    if (wins[top] >= ground.onTopAt) {
      const bottom = opposite({ side: top })
      dazed[bottom] += ground.dazedOnTop
      events.push({ kind: FIGHT_EVENTS.onTop, side: top })
      if (knockedOut(bottom)) {
        events.push({ kind: FIGHT_EVENTS.knockout, side: bottom })
        return over({ ending: FIGHT_ENDINGS.knockout, winner: top, loser: bottom, wins })
      }
      return over({ ending: FIGHT_ENDINGS.onTop, winner: top, loser: bottom, wins })
    }
  }
}
