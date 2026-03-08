/**
 * Unlock Engine — evaluates unlock conditions against game state.
 * Pure functions. No side effects. No Vue. No DOM.
 */

/**
 * Evaluates a single UnlockCondition against the current game state.
 *
 * Condition types:
 *   "stat"               - player.stats[key].base op value
 *   "counter"            - gameState.counters[key] op value
 *   "event_completed"    - firedEventIds includes key
 *   "location_discovered"- locations[key].discovered === true
 *   "death_by"           - metaState.completedRuns includes run with endType === key
 *   "run_completed"      - metaState.completedRuns.length op value
 *
 * @param {Object} condition - UnlockCondition per data contract
 * @param {Object} gameState - SaveGame per data contract
 * @param {Object} [metaState] - MetaSave per data contract
 * @returns {boolean}
 */
export function evaluateCondition(condition, gameState, metaState = {}) {
  const { type, key, op, value } = condition

  let actual

  switch (type) {
    case 'stat': {
      actual = gameState.player?.stats?.[key]?.base ?? 0
      break
    }
    case 'counter': {
      actual = gameState.counters?.[key] ?? gameState.player?.counters?.[key] ?? 0
      break
    }
    case 'event_completed': {
      return (gameState.firedEventIds ?? []).includes(key)
    }
    case 'location_discovered': {
      return gameState.locations?.[key]?.discovered === true
    }
    case 'death_by': {
      const runs = metaState.completedRuns ?? []
      return runs.some((run) => run.endType === key)
    }
    case 'run_completed': {
      actual = (metaState.completedRuns ?? []).length
      break
    }
    default:
      return false
  }

  return _compareOp(actual, op, value)
}

/**
 * Compares two values with the given operator.
 * @param {*} actual
 * @param {string} op - ">=", "<=", "==", "!="
 * @param {*} value
 * @returns {boolean}
 */
function _compareOp(actual, op, value) {
  switch (op) {
    case '>=': return actual >= value
    case '<=': return actual <= value
    case '==': return actual == value  // intentional loose equality for flexibility
    case '!=': return actual != value
    default: return false
  }
}

/**
 * Evaluates an UnlockTrigger — AND or OR logic over its conditions.
 *
 * @param {Object} trigger - UnlockTrigger per data contract
 * @param {Object} gameState
 * @param {Object} [metaState]
 * @returns {boolean}
 */
export function evaluateTrigger(trigger, gameState, metaState = {}) {
  if (!trigger || !trigger.conditions || trigger.conditions.length === 0) {
    return false
  }

  if (trigger.type === 'all') {
    return trigger.conditions.every((cond) =>
      evaluateCondition(cond, gameState, metaState)
    )
  }

  if (trigger.type === 'any') {
    return trigger.conditions.some((cond) =>
      evaluateCondition(cond, gameState, metaState)
    )
  }

  return false
}

/**
 * Evaluates all unlock definitions against the current state.
 * Returns array of IDs that have newly unlocked (not already in metaState.unlockedIds).
 *
 * @param {Object} gameState - SaveGame
 * @param {Object} metaState - MetaSave
 * @param {Object[]} unlockDefinitions - array of Unlock per data contract
 * @returns {string[]} - newly unlocked IDs
 */
export function evaluateUnlocks(gameState, metaState, unlockDefinitions) {
  const alreadyUnlocked = new Set(metaState.unlockedIds ?? [])
  const newlyUnlocked = []

  for (const unlock of unlockDefinitions) {
    if (alreadyUnlocked.has(unlock.id)) continue
    if (evaluateTrigger(unlock.trigger, gameState, metaState)) {
      newlyUnlocked.push(unlock.id)
    }
  }

  return newlyUnlocked
}
