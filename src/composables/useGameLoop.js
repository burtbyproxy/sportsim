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
import { checkRandomEvents, checkTriggeredEvents, resolveEvent } from '../engine/events.js'
import {
  generateActionNarrative,
  generateEventNarrative,
  generateLocationNarrative,
} from './useNarrative.js'
import { toNarrativeText } from '../utils/text.js'
import { sim } from '../workers/simulation-api.js'

/**
 * @param {{
 *   actionRegistry?: Object[],
 *   eventRegistry?: Object[],
 *   narrative?: ReturnType<import('./useNarrative.js').useNarrative>|null,
 *   save?: ReturnType<import('./useSave.js').useSave>|null,
 *   rng?: () => number,
 * }} input
 *   actionRegistry — array of Action objects to evaluate against
 *   eventRegistry — array of GameEvent objects; checked after every tick
 *   rng — random source for event rolls; injectable so tests are deterministic
 *   narrative — the renderer that receives action and event prose. Passed in
 *   explicitly: the screen that owns the loop also owns the renderer, and a
 *   component cannot inject what it provided itself.
 *   save — the save module; when present, arriving somewhere writes the
 *   auto-save slot so a closed tab costs at most the current scene.
 */
export function useGameLoop({
  actionRegistry = [],
  eventRegistry = [],
  narrative = null,
  save = null,
  rng = Math.random,
} = {}) {
  const game = useGameStore()

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

    // 5. Move if requested — the new scene's prose goes into a fresh log
    if (toLocationId) {
      game.moveTo(toLocationId)
      _locationEnter()
    }

    // 6. The world happens to the player: at most one event per tick.
    // After decay and after the move, so thresholds and the new place are
    // visible, and after the scene text so the event lands beneath it.
    _eventsCheck()

    // 7. Re-evaluate available actions
    _refreshActions()
  }

  /**
   * Start a scene: clear the log, describe where the player is, and if an
   * event is still waiting on them (say, after a load), put it back in front.
   */
  function _locationEnter() {
    if (narrative && game.currentLocation && game.player) {
      narrative.clearLog()
      narrative.enqueue(generateLocationNarrative(game.currentLocation, game.player, game.time))
      if (game.activeEvent) {
        _narrativeEnqueue(generateEventNarrative(game.activeEvent, game.player))
      }
    }
    _refreshActions()
  }

  /**
   * Fire the first event whose conditions hold. Triggered events take
   * precedence over random ones. Nothing fires while a choice is pending.
   */
  function _eventsCheck() {
    if (game.activeEvent || !game.player || !game.currentLocation) return
    const args = [game.player, game.currentLocation, game.time, eventRegistry, game.firedEventIds]
    const [event] = [...checkTriggeredEvents(...args), ...checkRandomEvents(...args, rng)]
    if (!event) return
    _eventStart(event)
  }

  function _eventStart(event) {
    if (event.oneTime) game.markEventFired(event.id)
    _narrativeEnqueue(generateEventNarrative(event, game.player))
    if (event.choices?.length > 0) {
      game.setActiveEvent(event)
      return
    }
    const { outcome } = resolveEvent(event, game.player, null, rng)
    _eventOutcomeApply(outcome)
  }

  /**
   * Resolve the pending event with the player's choice.
   * @param {{ choiceIndex: number }} input
   */
  function resolveEventChoice({ choiceIndex }) {
    const event = game.activeEvent
    if (!event || !game.player) return
    const { outcome } = resolveEvent(event, game.player, choiceIndex, rng)
    game.clearActiveEvent()
    _eventOutcomeApply(outcome)
    _refreshActions()
  }

  function _eventOutcomeApply(outcome) {
    if (!outcome) return
    if (outcome.narrative) {
      const text =
        typeof outcome.narrative === 'string'
          ? toNarrativeText(outcome.narrative)
          : outcome.narrative
      _narrativeEnqueue(text)
    }
    _outcomeApply(outcome)
  }

  function _narrativeEnqueue(narrativeText) {
    if (narrative && narrativeText?.tokens?.length > 0) {
      narrative.enqueue(narrativeText)
    }
  }

  /**
   * Travel to a location — advances time by travel cost, then moves.
   * @param {string} locationId
   * @param {number} travelTicks
   * @returns {Promise<void>}
   */
  async function travel(locationId, travelTicks = 0) {
    await tick(travelTicks > 0 ? travelTicks : 1, locationId)
    if (save) save.autoSave()
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

    _narrativeEnqueue(generateActionNarrative(result))

    if (!result.success && result.requirementFailure) {
      // Requirements not met — shouldn't happen if menu is correct, but handle gracefully
      return
    }

    const outcome = result.outcome
    if (!outcome) return

    _outcomeApply(outcome)

    // Advance time by action cost
    await tick(action.timeCost ?? 1)
  }

  /**
   * Apply an outcome's state effects to the store. Shared by actions and events.
   * Narrative is the caller's business.
   * @param {Object} outcome
   */
  function _outcomeApply(outcome) {
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
   * Call this when the game screen mounts (new game, or a loaded save).
   * Moves made through travel() start their scene themselves.
   */
  function onLocationEntered() {
    _locationEnter()
  }

  return {
    tick,
    travel,
    resolvePlayerAction,
    resolveEventChoice,
    onLocationEntered,
  }
}
