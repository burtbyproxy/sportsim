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
 * Adds XP to a stat. If XP crosses the threshold, increments the stat base.
 * Returns the updated stat object (does NOT mutate input).
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

  const updatedStat = {
    ...stat,
    xp: stat.xp + amount,
    modifiers: [...(stat.modifiers || [])],
  }

  const threshold = _xpThreshold(updatedStat.base)
  let leveledUp = false

  if (updatedStat.xp >= threshold) {
    updatedStat.xp -= threshold
    updatedStat.base = Math.min(updatedStat.base + 1, 100)
    leveledUp = true
  }

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
 * Calculates natural stat decay over time.
 * Hunger and energy decrease with time; sobriety slowly returns to baseline.
 * Returns status changes to apply (does NOT mutate state).
 *
 * Decay rates per tick (1 tick = 15 minutes game time):
 *   hunger:   -1 (always hungry)
 *   energy:   -0.5 (slow drain)
 *   sobriety: +2 (sobering up)
 *
 * @param {Object} player
 * @param {number} ticksElapsed
 * @returns {Object<string, number>} - status deltas to apply
 */
export function getStatDecayEffects(player, ticksElapsed) {
  if (!ticksElapsed || ticksElapsed <= 0) return {}

  const status = player.status || {}

  const changes = {}

  // Hunger decreases over time
  const hungerDelta = -1 * ticksElapsed
  const newHunger = Math.max(0, (status.hunger ?? 50) + hungerDelta)
  changes.hunger = newHunger - (status.hunger ?? 50)

  // Energy decreases over time (slower)
  const energyDelta = -0.5 * ticksElapsed
  const newEnergy = Math.max(0, (status.energy ?? 80) + energyDelta)
  changes.energy = parseFloat((newEnergy - (status.energy ?? 80)).toFixed(2))

  // Sobriety slowly returns to baseline (100) if not at max
  const currentSobriety = status.sobriety ?? 100
  if (currentSobriety < 100) {
    const sobrietyDelta = 2 * ticksElapsed
    const newSobriety = Math.min(100, currentSobriety + sobrietyDelta)
    changes.sobriety = parseFloat((newSobriety - currentSobriety).toFixed(2))
  }

  return changes
}
