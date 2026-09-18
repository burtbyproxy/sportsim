/**
 * Dice Engine — core resolution mechanic.
 * Every meaningful action goes through this.
 * Pure functions. No side effects. No Vue. No DOM.
 */

import { roll } from '../utils/random.js'

/**
 * Altered state modifier thresholds.
 * Data-driven so they can be tuned without touching engine logic.
 * Each entry: { stat, value } applied when condition is true.
 */
export const ALTERED_STATE_CONFIG = {
  sobriety: [
    {
      below: 30,
      modifiers: [
        { stat: 'wits', value: -5 },
        { stat: 'charm', value: 3 },
      ],
    },
    {
      below: 15,
      modifiers: [
        { stat: 'wits', value: -10 },
        { stat: 'charm', value: 0 },
        { stat: 'toughness', value: 5 },
      ],
      // This threshold supersedes the above — use overrides: true
      overrides: true,
    },
  ],
  energy: [
    {
      below: 20,
      modifiers: [
        { stat: 'stamina', value: -3 },
        { stat: 'toughness', value: -3 },
        { stat: 'wits', value: -3 },
      ],
    },
  ],
  hunger: [
    {
      below: 15,
      modifiers: [
        { stat: 'wits', value: -3 },
        { stat: 'mood', value: -5 },
      ],
    },
  ],
  mood: [
    {
      above: 80,
      modifiers: [
        { stat: 'charm', value: 3 },
        { stat: 'luck', value: 2 },
      ],
    },
    {
      below: 20,
      modifiers: [
        { stat: 'charm', value: -5 },
        { stat: 'creativity', value: 3 },
      ],
    },
  ],
}

/**
 * Rolls a d20. Returns a value from 1 to 20.
 * @param {(() => number)} [rng=Math.random]
 * @returns {number}
 */
export function rollD20(rng = Math.random) {
  return roll(1, 20, rng)
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

/**
 * The effective value of a stat on the 1–100 scale, taking into account:
 * - Base stat value
 * - Active modifiers on the stat
 * - Altered state effects (drunk, exhausted, starving, etc.)
 * - Active abilities' dice modifiers
 * - Trauma effects
 *
 * @param {{ player: Object, statName: string }} input - player per data contract; stat e.g. "charm"
 * @returns {number}
 */
export function statEffective({ player, statName }) {
  let total = 0

  // Base stat value
  const statObj = player.stats?.[statName]
  if (statObj) {
    total += statObj.base

    // Active modifiers on the stat
    if (statObj.modifiers) {
      for (const mod of statObj.modifiers) {
        total += mod.value
      }
    }
  }

  // Altered state modifiers
  total += _calculateAlteredStateModifier(player, statName)

  // Ability effects
  if (player.psyche?.abilities) {
    for (const ability of player.psyche.abilities) {
      if (!ability.active) continue
      const effect = ability.effects?.diceModifiers?.[statName]
      if (effect !== undefined) total += effect
    }
  }

  // Trauma effects
  if (player.psyche?.traumas) {
    for (const trauma of player.psyche.traumas) {
      const effect = trauma.effects?.statModifiers?.[statName]
      if (effect !== undefined) total += effect
    }
  }

  return total
}

/**
 * The number added to a d20 for a check on this stat: one per ten points of
 * effective stat, on the 1–100 scale, never below 0 or above 10.
 * @param {{ player: Object, statName: string }} input
 * @returns {number}
 */
export function checkModifier({ player, statName }) {
  const effective = Math.max(0, Math.min(100, statEffective({ player, statName })))
  return Math.floor(effective / STAT_POINTS_PER_MODIFIER)
}

/**
 * Calculates altered state modifier contribution for a given stat.
 * Internal helper.
 *
 * For each status key (sobriety, energy, etc.), iterates thresholds once.
 * If any override threshold matches, it wins outright and replaces all non-override matches.
 * Otherwise, the last matching non-override threshold applies.
 *
 * @param {Object} player
 * @param {string} statName
 * @returns {number}
 */
function _calculateAlteredStateModifier(player, statName) {
  const status = player.status || {}
  let total = 0

  for (const [statusKey, thresholds] of Object.entries(ALTERED_STATE_CONFIG)) {
    const statusValue = status[statusKey]
    if (statusValue === undefined) continue

    let overrideValue = null // set if an override threshold matches
    let lastNonOverride = 0 // last matching non-override value

    for (const threshold of thresholds) {
      const matches =
        (threshold.below !== undefined && statusValue < threshold.below) ||
        (threshold.above !== undefined && statusValue > threshold.above)

      if (!matches) continue

      const mod = threshold.modifiers.find((m) => m.stat === statName)
      if (mod === undefined) continue

      if (threshold.overrides) {
        overrideValue = mod.value
      } else {
        lastNonOverride = mod.value
      }
    }

    total += overrideValue !== null ? overrideValue : lastNonOverride
  }

  return total
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
