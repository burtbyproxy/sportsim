/**
 * Dice Engine — core resolution mechanic.
 * Every meaningful action goes through this.
 * Pure functions. No side effects. No Vue. No DOM.
 */

import { randomInt } from '../utils/random.js'
import { numberClamp, numberSum } from '../utils/number.js'

/**
 * Everything acting on a player — every substance, every condition — reaches
 * the dice through the blend snapshot the engine writes to `player.blend`
 * (see engine/blend.js). The dice never learn what whiskey is.
 */

/**
 * Rolls a d20. Returns a value from 1 to 20.
 * @param {{ rng?: (() => number) }} input
 * @returns {number}
 */
export function diceD20({ rng = Math.random } = {}) {
  return randomInt({ min: 1, max: 20, rng })
}

/** Where a stat's modifier item came from. */
export const STAT_ITEM_SOURCES = Object.freeze({
  base: 'base',
  modifier: 'modifier',
  ability: 'ability',
})

/**
 * Everything that makes up a stat's effective value, itemized: the base,
 * each temporary modifier, each persona in the blend that touches the stat
 * (a mark's standing effect comes through the blend too), each active
 * ability. There is no cap on the count. The sum
 * is the effective stat; the list is for the story.
 *
 * @param {{ player: Object, statName: string }} input
 * @returns {{ source: string, sourceId: string, value: number }[]}
 */
export function statModifierItems({ player, statName }) {
  const items = []

  const statObj = player.stats?.[statName]
  if (statObj) {
    items.push({ source: STAT_ITEM_SOURCES.base, sourceId: statName, value: statObj.base })
    for (const mod of statObj.modifiers ?? []) {
      items.push({
        source: STAT_ITEM_SOURCES.modifier,
        sourceId: mod.source ?? statName,
        value: mod.value,
      })
    }
  }

  for (const entry of player.blend?.modifierSources ?? []) {
    if (entry.stat !== statName) continue
    items.push({
      source: entry.source,
      sourceId: entry.personaId ?? entry.sourceId,
      value: entry.value,
    })
  }

  for (const ability of player.psyche?.abilities ?? []) {
    if (!ability.active) continue
    const effect = ability.effects?.diceModifiers?.[statName]
    if (effect !== undefined) {
      items.push({ source: STAT_ITEM_SOURCES.ability, sourceId: ability.id, value: effect })
    }
  }

  return items
}

/**
 * The effective value of a stat on the 1–100 scale: the sum of every item
 * statModifierItems reports.
 *
 * @param {{ player: Object, statName: string }} input - player per data contract; stat e.g. "charm"
 * @returns {number}
 */
export function statEffective({ player, statName }) {
  return numberSum({ values: statModifierItems({ player, statName }).map((item) => item.value) })
}

/**
 * The modifier a stat adds to a d20: one point for every
 * tuning.dice.statPointsPerModifier points of effective stat (10 today).
 *
 * Stats live on a 1–100 scale: a starting player rolls 10–20, the locals
 * sit anywhere from 25 to 85, and 100 is mastery. At ten points a modifier
 * the difficulty scale reads like any d20 game:
 *
 *   DC  5  trivial      DC 10  easy for anyone
 *   DC 15  hard for a beginner, routine for a pro
 *   DC 20  a pro's good day     DC 25  legendary
 *
 * A fresh player (+1 or +2) passes DC 10 a little over half the time and
 * DC 15 about a third of the time. Maurice's charm (85, so +8) passes
 * DC 15 seven times in ten.
 *
 * @param {{ player: Object, statName: string, tuning: Object }} input
 * @returns {number}
 */
export function checkModifier({ player, statName, tuning }) {
  const effective = numberClamp({ value: statEffective({ player, statName }), min: 0, max: 100 })
  return Math.floor(effective / tuning.dice.statPointsPerModifier)
}

/**
 * Returns true if the natural roll is a critical success.
 * @param {{ natural: number }} input
 * @returns {boolean}
 */
export function diceCriticalSuccess({ natural }) {
  return natural === 20
}

/**
 * Returns true if the natural roll is a critical failure.
 * @param {{ natural: number }} input
 * @returns {boolean}
 */
export function diceCriticalFailure({ natural }) {
  return natural === 1
}

/**
 * Rolls a stat check against a difficulty class.
 * @param {{ player: Object, statName: string, modifiers: number[], dc: number, rng?: (() => number), tuning: Object }} input
 *   statName — which stat to check
 *   modifiers — additional flat modifiers (situational bonuses/penalties)
 *   dc — difficulty class
 * @returns {DiceResult}
 */
export function checkRoll({ player, statName, modifiers, dc, rng = Math.random, tuning }) {
  const natural = diceD20({ rng })
  const statModifier = checkModifier({ player, statName, tuning })
  const extraModifiers = numberSum({ values: modifiers })
  const totalModifier = statModifier + extraModifiers
  const total = natural + totalModifier

  return {
    natural,
    modifier: totalModifier,
    total,
    dc,
    success: total >= dc,
    criticalSuccess: diceCriticalSuccess({ natural }),
    criticalFailure: diceCriticalFailure({ natural }),
    stat: statName,
    // Everything behind the stat, itemized, plus each situational modifier.
    modifierItems: [
      ...statModifierItems({ player, statName }),
      ...modifiers.map((value) => ({ source: 'situational', sourceId: null, value })),
    ],
  }
}

/** Who took a contest. */
export const CONTEST_WINNERS = Object.freeze({ first: 'first', second: 'second', tie: 'tie' })

/**
 * Two sides roll against each other; the higher total takes it.
 * @param {{
 *   first: { player: Object, statName: string, modifiers?: number[] },
 *   second: { player: Object, statName: string, modifiers?: number[] },
 *   rng?: (() => number),
 *   tuning: Object,
 * }} input
 * @returns {{ winner: string, first: Object, second: Object }} winner is a CONTEST_WINNERS value
 */
export function checkContestedRoll({ first, second, rng = Math.random, tuning }) {
  // A contest has no target to beat, only the other side, so neither roll has a DC.
  const side = ({ player, statName, modifiers = [] }) =>
    checkRoll({ player, statName, modifiers, dc: 0, rng, tuning })
  const rolledFirst = side(first)
  const rolledSecond = side(second)
  let winner = CONTEST_WINNERS.tie
  if (rolledFirst.total > rolledSecond.total) winner = CONTEST_WINNERS.first
  if (rolledSecond.total > rolledFirst.total) winner = CONTEST_WINNERS.second
  return { winner, first: rolledFirst, second: rolledSecond }
}
