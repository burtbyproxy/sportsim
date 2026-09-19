/**
 * Stats Engine — stat progression, the status rule, and natural decay.
 * Pure functions. No side effects. No Vue. No DOM.
 */

import { numberClamp, numberRound } from '../utils/number.js'

/**
 * Status that changes only through its own door: money through moneyAdjust,
 * sobriety derived from what is in you. Everything else holds 0-100.
 */
const STATUS_IDS_NOT_WRITABLE = Object.freeze(['money', 'sobriety'])

/**
 * A status after changes. The same rule for the player and every character:
 * unknown keys and keys with their own door are ignored, the rest are held
 * to 0-100. Returns a new status; the input is not mutated.
 *
 * @param {{ status: Object<string, number>, changes: Object<string, number> }} input
 * @returns {Object<string, number>}
 */
export function statusChangesApply({ status, changes }) {
  const next = { ...status }
  for (const [key, delta] of Object.entries(changes)) {
    if (STATUS_IDS_NOT_WRITABLE.includes(key) || !(key in next)) continue
    next[key] = numberClamp({ value: next[key] + delta, min: 0, max: 100 })
  }
  return next
}

/**
 * A stat nobody has worked on yet: the shape of every stat and every skill cell.
 * @param {{ base: number }} input
 * @returns {{ base: number, modifiers: Object[], xp: number }}
 */
export function statCreate({ base }) {
  return { base, modifiers: [], xp: 0 }
}

/**
 * XP to the next point: more the higher the stat already is (content/tuning.json `stats`).
 * @param {{ base: number, tuning: Object }} input
 * @returns {number}
 */
function xpThreshold({ base, tuning }) {
  return tuning.stats.xpToNextBase + base * tuning.stats.xpToNextPerPoint
}

/**
 * Adds XP to a stat-shaped object ({ base, modifiers, xp }) and levels it
 * for every threshold the XP clears, base capped at 100. Skills cells and
 * player stats share this shape and this curve. Returns a new object.
 *
 * @param {{ stat: { base: number, modifiers?: Object[], xp: number }, amount: number, tuning: Object }} input
 * @returns {{ stat: Object, leveledUp: boolean }}
 */
export function statXpApply({ stat, amount, tuning }) {
  const next = {
    ...stat,
    xp: stat.xp + amount,
    modifiers: [...(stat.modifiers || [])],
  }
  let leveledUp = false
  while (next.xp >= xpThreshold({ base: next.base, tuning })) {
    next.xp -= xpThreshold({ base: next.base, tuning })
    next.base = Math.min(next.base + 1, 100)
    leveledUp = true
    if (next.base === 100) break
  }
  if (next.base === 100 && next.xp >= xpThreshold({ base: 100, tuning })) next.xp = 0
  return { stat: next, leveledUp }
}

/**
 * How a status wears down over time: hunger and energy fall, mood drifts
 * back toward its baseline, at the rates content sets (tuning.json `decay`).
 * Sobriety is not here: it is derived from what is in you, which wears off
 * in the blend engine. Returns the changes, not a new status; the caller
 * applies them by the one status rule.
 *
 * @param {{ status: Object<string, number>, ticksElapsed: number, tuning: Object }} input
 * @returns {Object<string, number>} changes by status key
 */
export function statusDecayChanges({ status = {}, ticksElapsed, tuning }) {
  if (!ticksElapsed || ticksElapsed <= 0) return {}
  const config = tuning.decay

  const changes = {}

  // Hunger — simple linear decay
  const hungerCfg = config.hunger
  const currentHunger = status.hunger ?? 50
  const newHunger = numberClamp({
    value: currentHunger + hungerCfg.ratePerTick * ticksElapsed,
    min: hungerCfg.min,
    max: hungerCfg.max,
  })
  const hungerDelta = numberRound({ value: newHunger - currentHunger, places: 2 })
  if (hungerDelta !== 0) changes.hunger = hungerDelta

  // Energy — simple linear decay
  const energyCfg = config.energy
  const currentEnergy = status.energy ?? 80
  const newEnergy = numberClamp({
    value: currentEnergy + energyCfg.ratePerTick * ticksElapsed,
    min: energyCfg.min,
    max: energyCfg.max,
  })
  const energyDelta = numberRound({ value: newEnergy - currentEnergy, places: 2 })
  if (energyDelta !== 0) changes.energy = energyDelta

  // Mood — drifts toward baseline (40)
  const moodCfg = config.mood
  const currentMood = status.mood ?? moodCfg.baseline
  if (currentMood !== moodCfg.baseline) {
    // Drift toward baseline regardless of direction
    const driftAmount = Math.abs(moodCfg.ratePerTick) * ticksElapsed
    const newMood =
      currentMood > moodCfg.baseline
        ? Math.max(moodCfg.baseline, currentMood - driftAmount)
        : Math.min(moodCfg.baseline, currentMood + driftAmount)
    const moodDelta = numberRound({ value: newMood - currentMood, places: 2 })
    if (moodDelta !== 0) changes.mood = moodDelta
  }

  return changes
}
