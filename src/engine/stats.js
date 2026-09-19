/**
 * Stats Engine — stat progression, the status rule, and natural decay.
 * Pure functions. No side effects. No Vue. No DOM.
 */

import { numberClamp, numberRound } from '../utils/number.js'

/**
 * Status that changes only through its own door: money through adjustMoney,
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

/** A rolled check trains the stat it rolled on. You learn more when it works. */
export const STAT_XP_CHECK_SUCCESS = 2
export const STAT_XP_CHECK_FAILURE = 1

/**
 * XP required to gain a stat point.
 * Simple linear for now — can be tuned to a curve later.
 * @param {number} currentBase - current stat base value
 * @returns {number}
 */
function _xpThreshold(currentBase) {
  // Costs more XP the higher your stat — diminishing returns
  return 10 + currentBase * 2
}

/**
 * Adds XP to a stat-shaped object ({ base, modifiers, xp }) and levels it
 * for every threshold the XP clears, base capped at 100. Skills cells and
 * player stats share this shape and this curve. Returns a new object.
 *
 * @param {{ stat: { base: number, modifiers?: Object[], xp: number }, amount: number }} input
 * @returns {{ stat: Object, leveledUp: boolean }}
 */
export function statXpApply({ stat, amount }) {
  const next = {
    ...stat,
    xp: stat.xp + amount,
    modifiers: [...(stat.modifiers || [])],
  }
  let leveledUp = false
  while (next.xp >= _xpThreshold(next.base)) {
    next.xp -= _xpThreshold(next.base)
    next.base = Math.min(next.base + 1, 100)
    leveledUp = true
    if (next.base === 100) break
  }
  if (next.base === 100 && next.xp >= _xpThreshold(100)) next.xp = 0
  return { stat: next, leveledUp }
}

/**
 * Decay configuration — tuned for a ~24-hour game day.
 * 1 tick = 15 minutes of game time.
 * Actions cost 1-4 ticks; walking costs 1-3 ticks.
 *
 * Targets:
 *   hunger:   -1/tick    → noticeably hungry after 2-3h (~8-12 ticks), starving after 6h (~24 ticks)
 *   energy:   -0.5/tick  → exhausted after a full active day (~96 ticks of activity)
 *   sobriety: derived from intoxications; each substance wears off on its own
 *             clock in the blend engine (engine/blend.js), not here
 *   mood:     -0.25/tick toward baseline 40 (slow drift; events/actions are main mood drivers)
 */
export const DECAY_CONFIG = {
  hunger: {
    ratePerTick: -1,
    min: 0,
    max: 100,
  },
  energy: {
    ratePerTick: -0.5,
    min: 0,
    max: 100,
  },
  mood: {
    ratePerTick: -0.25, // drift per tick toward baseline
    baseline: 40, // baseline melancholy — Portland 2001
    min: 0,
    max: 100,
  },
}

/**
 * How a status wears down over time: hunger and energy fall, mood drifts
 * back toward its baseline. Returns the changes, not a new status; the
 * caller applies them by the one status rule.
 *
 * @param {{ status: Object<string, number>, ticksElapsed: number, config?: Object }} input
 * @returns {Object<string, number>} changes by status key
 */
export function statusDecayChanges({ status = {}, ticksElapsed, config = DECAY_CONFIG }) {
  if (!ticksElapsed || ticksElapsed <= 0) return {}

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
