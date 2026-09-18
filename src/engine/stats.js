/**
 * Stats Engine — stat progression, archetype tracking, and natural decay.
 * Pure functions. No side effects. No Vue. No DOM.
 */

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
 * Adds XP to a player stat. Returns the updated stat object (does NOT
 * mutate input).
 *
 * @param {Object} player
 * @param {string} statName
 * @param {number} amount - XP to add
 * @returns {{ updatedStat: Object, leveledUp: boolean }}
 */
export function gainStatXP(player, statName, amount) {
  const stat = player.stats?.[statName]
  if (!stat) {
    return { updatedStat: null, leveledUp: false }
  }
  const { stat: updatedStat, leveledUp } = statXpApply({ stat, amount })
  return { updatedStat, leveledUp }
}

/**
 * Calculates a character level as an aggregate of all stats.
 * Level = average of all stat bases, rounded down.
 *
 * @param {Object} player
 * @returns {number}
 */
export function calculateLevel(player) {
  const stats = player.stats
  if (!stats) return 1

  const statValues = Object.values(stats).map((s) => s.base || 0)
  if (statValues.length === 0) return 1

  const sum = statValues.reduce((acc, v) => acc + v, 0)
  return Math.max(1, Math.floor(sum / statValues.length))
}

/**
 * Checks archetype scores against recognition thresholds.
 * Returns array of archetype IDs that have newly crossed a threshold.
 *
 * Each archetype definition should have:
 *   { id: string, thresholds: number[] } — sorted ascending
 *
 * @param {Object} player
 * @param {Object[]} archetypeDefinitions
 * @param {Object<string, number>} previouslyCrossed - map of archetypeId -> highest crossed threshold
 * @returns {{ archetypeId: string, threshold: number }[]}
 */
export function checkArchetypeThresholds(player, archetypeDefinitions, previouslyCrossed = {}) {
  const newly = []
  const scores = player.archetypeScores || {}

  for (const archetype of archetypeDefinitions) {
    const score = scores[archetype.id] ?? 0
    const crossed = previouslyCrossed[archetype.id] ?? -1

    for (const threshold of archetype.thresholds) {
      if (score >= threshold && crossed < threshold) {
        newly.push({ archetypeId: archetype.id, threshold })
      }
    }
  }

  return newly
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
 * Calculates natural stat decay over time.
 * Returns status changes to apply (does NOT mutate state).
 *
 * @param {Object} player
 * @param {number} ticksElapsed
 * @param {Object} [config=DECAY_CONFIG] - override decay config if needed
 * @returns {Object<string, number>} - status deltas to apply
 */
export function getStatDecayEffects(player, ticksElapsed, config = DECAY_CONFIG) {
  if (!ticksElapsed || ticksElapsed <= 0) return {}

  const status = player.status || {}
  const changes = {}

  // Hunger — simple linear decay
  const hungerCfg = config.hunger
  const currentHunger = status.hunger ?? 50
  const newHunger = Math.min(
    hungerCfg.max,
    Math.max(hungerCfg.min, currentHunger + hungerCfg.ratePerTick * ticksElapsed)
  )
  const hungerDelta = parseFloat((newHunger - currentHunger).toFixed(2))
  if (hungerDelta !== 0) changes.hunger = hungerDelta

  // Energy — simple linear decay
  const energyCfg = config.energy
  const currentEnergy = status.energy ?? 80
  const newEnergy = Math.min(
    energyCfg.max,
    Math.max(energyCfg.min, currentEnergy + energyCfg.ratePerTick * ticksElapsed)
  )
  const energyDelta = parseFloat((newEnergy - currentEnergy).toFixed(2))
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
    const moodDelta = parseFloat((newMood - currentMood).toFixed(2))
    if (moodDelta !== 0) changes.mood = moodDelta
  }

  return changes
}
