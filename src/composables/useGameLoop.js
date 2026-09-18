/**
 * useGameLoop — central game loop composable.
 *
 * Orchestrates what happens each tick:
 *   1. Advance clock
 *   2. Apply stat decay
 *   3. Expire modifiers
 *   4. Re-evaluate available actions at current location
 *
 * Also handles action resolution, applying outcomes to the store,
 * and feeding narrative results to the renderer.
 *
 * Everything that involves time passing flows through tick().
 * Everything that involves resolving player actions flows through resolveAction().
 */

import { inject } from 'vue'
import { useGameStore } from '../stores/game.js'
import { resolveAction, getAvailableActions } from '../engine/actions.js'
import { getStatDecayEffects } from '../engine/stats.js'
import {
  tickModifiers,
  addItem,
  removeItem,
  feedObsession,
  updateArchetypeScore,
  incrementCounter,
} from '../models/player.js'
import { generateActionNarrative } from './useNarrative.js'
import { sim } from '../workers/simulation-api.js'

/**
 * @param {Object} actionRegistry - array of Action objects to evaluate against
 */
export function useGameLoop(actionRegistry = []) {
  const game = useGameStore()
  const narrative = inject('narrative', null)

  /**
   * Advance game time by N ticks, applying decay and expiring modifiers.
   * Optionally move to a new location first.
   *
   * Async because the simulation worker call returns a Promise.
   *
   * @param {number} ticks
   * @param {string|null} toLocationId - if set, move to this location after tick
   * @returns {Promise<void>}
   */
  async function tick(ticks = 1, toLocationId = null) {
    if (!game.player) return

    // 1. Advance clock
    game.advanceTime(ticks)

    // 2. Apply stat decay
    const decayChanges = getStatDecayEffects(game.player, ticks)
    if (Object.keys(decayChanges).length > 0) {
      game.applyStatusChanges(decayChanges)
    }

    // 3. Expire modifiers — tickModifiers mutates player in place
    tickModifiers(game.player)

    // 4. Run simulation worker — move characters, apply full-sim status decay
    // We await so character positions update before action refresh,
    // but a worker failure must not crash the game loop.
    try {
      const charactersArray = Object.values(game.characters)
      if (charactersArray.length > 0) {
        const simResult = await sim.tick(game.time, charactersArray)
        for (const update of simResult.characters) {
          game.setCharacterLocation(update.id, update.locationId)
          // Apply status changes for full-sim characters (stat decay, etc.)
          if (update.statusChanges && game.characters[update.id]) {
            const char = game.characters[update.id]
            for (const [key, delta] of Object.entries(update.statusChanges)) {
              if (char.status && key in char.status) {
                char.status[key] = Math.max(0, Math.min(100, char.status[key] + delta))
              }
            }
          }
        }
      }
    } catch (err) {
      // Worker failure is non-fatal — log and continue
      console.warn('[useGameLoop] simulation worker tick failed:', err)
    }

    // 5. Check random/triggered events (stub — full implementation Phase 4)
    // Events must fire AFTER decay so altered-state thresholds from decay are visible
    // _checkEvents()

    // 6. Move if requested
    if (toLocationId) {
      game.moveTo(toLocationId)
    }

    // 7. Re-evaluate available actions
    _refreshActions()
  }

  /**
   * Travel to a location — advances time by travel cost, then moves.
   * @param {string} locationId
   * @param {number} travelTicks
   * @returns {Promise<void>}
   */
  async function travel(locationId, travelTicks = 0) {
    await tick(travelTicks > 0 ? travelTicks : 1, locationId)
  }

  /**
   * Resolve a player action through the dice engine.
   * Applies outcomes to the store and enqueues narrative.
   *
   * @param {Object} action - Action definition
   */
  async function resolvePlayerAction(action) {
    if (!game.player) return

    const characters = game.charactersAtCurrentLocation
    const result = resolveAction(game.player, action, game.time, characters)

    // Feed outcome narrative to renderer
    if (narrative) {
      const narrativeText = generateActionNarrative(result)
      if (narrativeText?.tokens?.length > 0) {
        narrative.enqueue(narrativeText)
      }
    }

    if (!result.success && result.requirementFailure) {
      // Requirements not met — shouldn't happen if menu is correct, but handle gracefully
      return
    }

    const outcome = result.outcome
    if (!outcome) return

    // Apply status changes
    if (outcome.statusChanges) {
      game.applyStatusChanges(outcome.statusChanges)
    }

    // Apply stat changes
    if (outcome.statChanges) {
      game.applyStatChanges(outcome.statChanges)
    }

    // Apply money change via store (keeps Pinia reactivity)
    if (outcome.moneyChange != null) {
      game.adjustMoney(outcome.moneyChange)
    }

    // Grant items — itemsGained is string[] (item IDs per contract)
    // Look up each ID in the item registry before passing to addItem
    if (outcome.itemsGained?.length > 0) {
      for (const itemId of outcome.itemsGained) {
        const itemDef = game.getItem(itemId)
        if (itemDef) {
          addItem(game.player, itemDef)
        } else {
          console.warn(`[useGameLoop] itemsGained: unknown item ID '${itemId}'`)
        }
      }
    }

    // Remove items
    if (outcome.itemsLost?.length > 0) {
      for (const itemId of outcome.itemsLost) {
        removeItem(game.player, itemId)
      }
    }

    // Archetype changes
    if (outcome.archetypeChanges) {
      for (const [archetypeId, delta] of Object.entries(outcome.archetypeChanges)) {
        updateArchetypeScore(game.player, archetypeId, delta)
      }
    }

    // Counter changes
    if (outcome.counterChanges) {
      for (const [key, delta] of Object.entries(outcome.counterChanges)) {
        incrementCounter(game.player, key, delta)
      }
    }

    // Trauma
    if (outcome.traumaGained) {
      // Trauma definition lookup would go here — for now skip if no registry
    }

    // Obsession feeding
    if (outcome.obsessionFed) {
      feedObsession(game.player, outcome.obsessionFed, 5)
    }

    // Mark one-time events
    if (outcome.eventTriggered) {
      game.markEventFired(outcome.eventTriggered)
    }

    // Location discovery
    if (outcome.locationDiscovered) {
      const loc = game.locations[outcome.locationDiscovered]
      if (loc) loc.discovered = true
    }

    // Advance time by action cost
    await tick(action.timeCost ?? 1)
  }

  /**
   * Refresh available actions for the current location.
   * Called internally after every tick and on location entry.
   */
  function _refreshActions() {
    if (!game.player || !game.currentLocation) {
      game.setAvailableActions([])
      return
    }

    const actions = getAvailableActions(
      game.player,
      game.currentLocation,
      game.time,
      actionRegistry
    )

    // Annotate with availability flag (for ActionMenu disabled state)
    const annotated = actions.map((a) => ({ ...a, available: true }))

    // Also add disabled actions so they show as greyed-out
    // (actions at this location that fail requirements)
    const locationActionIds = new Set(game.currentLocation.actionIds || [])
    const disabledActions = actionRegistry
      .filter(
        (a) =>
          (locationActionIds.has(a.id) || a.locationId === 'any') &&
          !annotated.find((x) => x.id === a.id)
      )
      .map((a) => ({ ...a, available: false }))

    game.setAvailableActions([...annotated, ...disabledActions])
  }

  /**
   * Call this when entering a new location (from LocationView).
   * Refreshes the action list for the new context.
   */
  function onLocationEntered() {
    _refreshActions()
  }

  return {
    tick,
    travel,
    resolvePlayerAction,
    onLocationEntered,
  }
}
