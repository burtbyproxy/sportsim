/**
 * Dice Engine — core resolution mechanic.
 * Every meaningful action goes through this.
 * Pure functions. No side effects. No Vue. No DOM.
 */

import { randomInt } from '../utils/random.js'
import { numberClamp } from '../utils/number.js'

/**
 * Everything acting on a player — every substance, every condition — reaches
 * the dice through the blend snapshot the engine writes to `player.blend`
 * (see engine/blend.js). The dice never learn what whiskey is.
 */

/**
 * Rolls a d20. Returns a value from 1 to 20.
 * @param {(() => number)} [rng=Math.random]
 * @returns {number}
 */
export function rollD20(rng = Math.random) {
  return randomInt({ min: 1, max: 20, rng })
}

/**
 * Stats live on a 1–100 scale: a starting player rolls 10–20, the locals
 * sit anywhere from 25 to 85, and 100 is mastery. A check adds one point
 * of modifier to a d20 for every ten points of effective stat, so the
 * difficulty scale reads like any d20 game:
 *
 *   DC  5  trivial      DC 10  easy for anyone
 *   DC 15  hard for a beginner, routine for a pro
 *   DC 20  a pro's good day     DC 25  legendary
 *
 * A fresh player (+1 or +2) passes DC 10 a little over half the time and
 * DC 15 about a third of the time. Maurice's charm (85, so +8) passes
 * DC 15 seven times in ten.
 */
export const STAT_POINTS_PER_MODIFIER = 10

/** Where a stat's modifier item came from. */
export const STAT_ITEM_SOURCES = Object.freeze({
  BASE: 'base',
  MODIFIER: 'modifier',
  ABILITY: 'ability',
  TRAUMA: 'trauma',
})

/**
 * Everything that makes up a stat's effective value, itemized: the base,
 * each temporary modifier, each persona in the blend that touches the stat,
 * each active ability, each trauma. There is no cap on the count. The sum
 * is the effective stat; the list is for the story.
 *
 * @param {{ player: Object, statName: string }} input
 * @returns {{ source: string, sourceId: string, value: number }[]}
 */
export function statModifierItems({ player, statName }) {
  const items = []

  const statObj = player.stats?.[statName]
  if (statObj) {
    items.push({ source: STAT_ITEM_SOURCES.BASE, sourceId: statName, value: statObj.base })
    for (const mod of statObj.modifiers ?? []) {
      items.push({
        source: STAT_ITEM_SOURCES.MODIFIER,
        sourceId: mod.source ?? statName,
        value: mod.value,
      })
    }
  }

  for (const entry of player.blend?.modifierSources ?? []) {
    if (entry.stat !== statName) continue
    items.push({ source: entry.source, sourceId: entry.personaId, value: entry.value })
  }

  for (const ability of player.psyche?.abilities ?? []) {
    if (!ability.active) continue
    const effect = ability.effects?.diceModifiers?.[statName]
    if (effect !== undefined) {
      items.push({ source: STAT_ITEM_SOURCES.ABILITY, sourceId: ability.id, value: effect })
    }
  }

  for (const trauma of player.psyche?.traumas ?? []) {
    const effect = trauma.effects?.statModifiers?.[statName]
    if (effect !== undefined) {
      items.push({ source: STAT_ITEM_SOURCES.TRAUMA, sourceId: trauma.id, value: effect })
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
  return statModifierItems({ player, statName }).reduce((sum, item) => sum + item.value, 0)
}

/**
 * The number added to a d20 for a check on this stat: one per ten points of
 * effective stat, on the 1–100 scale, never below 0 or above 10.
 * @param {{ player: Object, statName: string }} input
 * @returns {number}
 */
export function checkModifier({ player, statName }) {
  const effective = numberClamp({ value: statEffective({ player, statName }), min: 0, max: 100 })
  return Math.floor(effective / STAT_POINTS_PER_MODIFIER)
}

/**
 * Returns true if the natural roll is a critical success.
 * @param {number} natural
 * @returns {boolean}
 */
export function isCriticalSuccess(natural) {
  return natural === 20
}

/**
 * Returns true if the natural roll is a critical failure.
 * @param {number} natural
 * @returns {boolean}
 */
export function isCriticalFailure(natural) {
  return natural === 1
}

/**
 * Rolls a stat check against a difficulty class.
 * @param {Object} player
 * @param {string} statName - which stat to check
 * @param {number[]} modifiers - additional flat modifiers (situational bonuses/penalties)
 * @param {number} dc - difficulty class
 * @param {(() => number)} [rng=Math.random]
 * @returns {DiceResult}
 */
export function rollCheck(player, statName, modifiers, dc, rng = Math.random) {
  const natural = rollD20(rng)
  const statModifier = checkModifier({ player, statName })
  const extraModifiers = modifiers.reduce((sum, m) => sum + m, 0)
  const totalModifier = statModifier + extraModifiers
  const total = natural + totalModifier

  return {
    natural,
    modifier: totalModifier,
    total,
    dc,
    success: total >= dc,
    criticalSuccess: isCriticalSuccess(natural),
    criticalFailure: isCriticalFailure(natural),
    stat: statName,
    // Everything behind the stat, itemized, plus each situational modifier.
    modifierItems: [
      ...statModifierItems({ player, statName }),
      ...modifiers.map((value) => ({ source: 'situational', sourceId: null, value })),
    ],
  }
}

/**
 * Resolves a contested roll between two combatants.
 * @param {Object} player1 - Player or NPC
 * @param {number[]} modifiers1
 * @param {string} stat1
 * @param {Object} player2 - Player or NPC
 * @param {number[]} modifiers2
 * @param {string} stat2
 * @param {(() => number)} [rng=Math.random]
 * @returns {{ winner: 1|2|'tie', result1: DiceResult, result2: DiceResult }}
 */
export function rollContested(
  player1,
  modifiers1,
  stat1,
  player2,
  modifiers2,
  stat2,
  rng = Math.random
) {
  // Use an arbitrarily high DC so we can compare totals directly
  const DUMMY_DC = 0
  const result1 = rollCheck(player1, stat1, modifiers1, DUMMY_DC, rng)
  const result2 = rollCheck(player2, stat2, modifiers2, DUMMY_DC, rng)

  let winner
  if (result1.total > result2.total) {
    winner = 1
  } else if (result2.total > result1.total) {
    winner = 2
  } else {
    winner = 'tie'
  }

  return { winner, result1, result2 }
}
