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
 * Everything that involves resolving player actions flows through actionResolve().
 */

import { useGameStore } from '../stores/game.js'
import {
  REQUIREMENT_CODES,
  actionResolve,
  actionsAvailable,
  actionApplies,
} from '../engine/actions.js'
import {
  statusDecayChanges,
  STAT_XP_CHECK_SUCCESS,
  STAT_XP_CHECK_FAILURE,
} from '../engine/stats.js'
import {
  modifiersTick,
  inventoryAdd,
  inventoryRemove,
  obsessionFeed,
  archetypeScoreAdd,
  counterAdd,
} from '../models/player.js'
import {
  MAKING_FOCUS_EVENT_FACTOR,
  MAKING_SURFACE_KINDS,
  ARTIFACT_STATUSES,
  makingOptions,
} from '../engine/making.js'
import { eventsRandomCheck, eventsTriggeredCheck, eventResolve } from '../engine/events.js'
import {
  generateActionNarrative,
  generateEventNarrative,
  generateLocationNarrative,
} from './useNarrative.js'
import { narrativeTextCreate } from '../utils/text.js'
import { sim } from '../workers/simulation-api.js'
import { moneyFormat } from '../utils/money.js'

/** What can go wrong in the loop itself, as opposed to in what it calls. */
export const LOOP_ERROR_CODES = Object.freeze({
  SIMULATION_FAILED: 'SIMULATION_FAILED',
  ITEM_UNKNOWN: 'ITEM_UNKNOWN',
})

/**
 * @param {{
 *   actionRegistry?: Object[],
 *   eventRegistry?: Object[],
 *   narrative?: ReturnType<import('./useNarrative.js').useNarrative>|null,
 *   save?: ReturnType<import('./useSave.js').useSave>|null,
 *   rng?: () => number,
 *   simulation?: { tick: (input: { gameTime: Object, characters: Object[] }) => Object },
 * }} input
 *   actionRegistry — array of Action objects to evaluate against
 *   eventRegistry — array of GameEvent objects; checked after every tick
 *   rng — random source for event rolls; injectable so tests are deterministic
 *   simulation — moves the characters each tick: the worker by default, or
 *   simulation-local.js in-process, which is the same code behind the same contract
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
  simulation = sim,
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
    const decayChanges = statusDecayChanges({ status: game.player.status, ticksElapsed: ticks })
    if (Object.keys(decayChanges).length > 0) {
      game.applyStatusChanges(decayChanges)
    }

    // 3. Expire modifiers — modifiersTick mutates player in place
    modifiersTick({ player: game.player })

    // 4. Run simulation worker — move characters, apply full-sim status decay
    // We await so character positions update before action refresh,
    // but a worker failure must not crash the game loop.
    try {
      const charactersArray = Object.values(game.characters)
      if (charactersArray.length > 0) {
        const simResult = await simulation.tick({
          gameTime: game.time,
          characters: charactersArray,
        })
        for (const update of simResult.characters) {
          game.setCharacterLocation(update.id, update.locationId)
        }
        game.charactersStatusApply({ updates: simResult.characters })
      }
    } catch (err) {
      // The world stands still this tick; the player hears why.
      _failureShow({ error: { code: LOOP_ERROR_CODES.SIMULATION_FAILED, params: {} } })
    }

    // 4b. Substances wear off — player and characters alike — and the blend
    // snapshot every roll reads is recomputed.
    game.applyBlendDecay({ ticksElapsed: ticks })

    // 4c. The inspiration clock runs down. An idea that ran out says so.
    const clock = game.applyInspirationTick({ ticksElapsed: ticks })
    if (!clock.ok) _failureShow(clock)
    else if (clock.data.expired) _voiceEnqueue({ code: 'inspiration.expired' })

    // 4d. Whoever is in charge may get the urge to do something about it.
    const urge = game.applyInspirationUrge({ ticksElapsed: ticks, rng })
    if (!urge.ok) _failureShow(urge)
    else if (urge.data.struck) _voiceEnqueue({ code: 'inspiration.urge' })

    // 5. Move if requested — the new scene's prose goes into a fresh log
    if (toLocationId) {
      game.moveTo(toLocationId)
      _locationEnter()
    }

    // 6. The world happens to the player: at most one event per tick.
    // After decay and after the move, so thresholds and the new place are
    // visible, and after the scene text so the event lands beneath it.
    _eventsCheck()

    // 6b. If the idea died — ran out, got barged in on, got replaced — the
    // work on it dies too.
    _makingReconcile()

    // 7. Anything that went wrong with nobody to tell is told now.
    _faultsShow()

    // 8. Re-evaluate available actions
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
      for (const mark of game.currentLocation.marks ?? []) {
        if (mark.status === ARTIFACT_STATUSES.FRESH) {
          _voiceEnqueue({ code: 'mark.still_here', params: { work: mark.workText } })
        }
      }
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
    const here = { player: game.player, location: game.currentLocation, gameTime: game.time }
    // Head down over the work, chance has a harder time finding you.
    const focus = game.makingActive ? MAKING_FOCUS_EVENT_FACTOR : 1
    const odds = eventRegistry.map((e) =>
      e.type === 'random' ? { ...e, probability: (e.probability ?? 0) * focus } : e
    )
    const [hit] = [
      ...eventsTriggeredCheck({
        ...here,
        events: eventRegistry,
        firedEventIds: game.firedEventIds,
      }),
      ...eventsRandomCheck({ ...here, events: odds, firedEventIds: game.firedEventIds, rng }),
    ]
    if (!hit) return
    _eventStart(eventRegistry.find((e) => e.id === hit.id))
  }

  function _eventStart(event) {
    if (event.oneTime) game.markEventFired(event.id)
    _narrativeEnqueue(generateEventNarrative(event, game.player))
    // The world barging in kills whatever was moving the player — unless
    // the world is what's moving them, in which case the strike replaces it.
    if (!event.outcome?.inspiration) {
      const cut = game.applyInspirationInterrupt({ reason: { kind: 'event', id: event.id } })
      if (!cut.ok) _failureShow(cut)
      else if (cut.data.interrupted) _voiceEnqueue({ code: 'inspiration.interrupted' })
    }
    if (event.choices?.length > 0) {
      game.setActiveEvent(event)
      return
    }
    const resolved = eventResolve({ event, player: game.player, rng })
    if (!resolved.ok) return _failureShow(resolved)
    _eventOutcomeApply({ outcome: resolved.data.outcome, source: { kind: 'event', id: event.id } })
  }

  /**
   * Resolve the pending event with the player's choice.
   * @param {{ choiceIndex: number }} input
   */
  function resolveEventChoice({ choiceIndex }) {
    const event = game.activeEvent
    if (!event || !game.player) return
    const resolved = eventResolve({ event, player: game.player, choiceIndex, rng })
    // A choice the event never offered resolves nothing: the event keeps waiting, and says why.
    if (!resolved.ok) return _failureShow(resolved)
    const { outcome, diceResult } = resolved.data
    _checkTrain(diceResult)
    game.clearActiveEvent()
    _eventOutcomeApply({ outcome, source: { kind: 'event', id: event.id } })
    _makingReconcile()
    _refreshActions()
  }

  function _eventOutcomeApply({ outcome, source }) {
    if (!outcome) return
    if (outcome.narrative) {
      const text =
        typeof outcome.narrative === 'string'
          ? narrativeTextCreate({ text: outcome.narrative })
          : outcome.narrative
      _narrativeEnqueue(text)
    }
    _outcomeApply({ outcome, source })
  }

  function _narrativeEnqueue(narrativeText) {
    if (narrative && narrativeText?.tokens?.length > 0) {
      narrative.enqueue(narrativeText)
    }
  }

  /**
   * A rolled check trains the stat it rolled on, pass or fail.
   * @param {Object|null} diceResult
   */
  function _checkTrain(diceResult) {
    if (!diceResult?.stat) return
    game.applyStatXp({
      statName: diceResult.stat,
      amount: diceResult.success ? STAT_XP_CHECK_SUCCESS : STAT_XP_CHECK_FAILURE,
    })
  }

  /**
   * Use one of something the player carries. It takes a tick, like
   * finishing a beer does.
   * @param {{ itemId: string }} input
   */
  async function useItem({ itemId }) {
    if (!game.player || game.activeEvent) return
    const result = game.applyItemUse({ itemId, rng })
    if (!result.ok) return _failureShow(result)
    _voiceEnqueue({ code: 'item.used', params: { item: result.data.item.name } })
    await tick(1)
  }

  /** A line in the voice of whoever is in charge, if the renderer is listening. */
  function _voiceEnqueue({ code, params = {} }) {
    if (!narrative) return
    const text = game.voiceLine({ code, params })
    if (text) _narrativeEnqueue(narrativeTextCreate({ text }))
  }

  /**
   * A failure, in play. Content may give its code a line like any other;
   * a code nobody wrote a line for shows as itself, never as nothing.
   * @param {{ error: { code: string, params?: Object } }} result
   */
  function _failureShow(result) {
    _voiceEnqueue({ code: result.error.code, params: result.error.params ?? {} })
  }

  /** Everything that went wrong with nobody to tell, told now. */
  function _faultsShow() {
    for (const fault of game.faultsDrain()) _failureShow({ error: fault })
  }

  /** Prose that is already in somebody's voice: a piece's own words. */
  function _voiceLiteralEnqueue(text) {
    if (narrative && text) _narrativeEnqueue(narrativeTextCreate({ text }))
  }

  /**
   * Look around the current location and say what turned up. The right
   * object can be the inspiration.
   */
  function _scavenge() {
    const result = game.applyScavenge({ rng })
    if (!result.ok) return _failureShow(result)
    _checkTrain(result.data.check)
    const { itemId, entry, pickedClean } = result.data
    if (!itemId) {
      _voiceEnqueue({ code: pickedClean ? 'scavenge.picked_clean' : 'scavenge.nothing' })
      return
    }
    const found = game.getItem(itemId)
    _voiceEnqueue({ code: 'scavenge.found', params: { item: found.foundAs ?? found.name } })
    if (entry.inspiration) {
      const struck = game.applyInspirationStrike({
        ...entry.inspiration,
        source: { kind: 'item', id: itemId },
      })
      if (!struck.ok) return _failureShow(struck)
      if (struck.data.replaced) _voiceEnqueue({ code: 'inspiration.replaced' })
      _voiceEnqueue({ code: 'inspiration.struck' })
    }
  }

  // ── Making ─────────────────────────────────────────────────────────────────

  /**
   * A making lives exactly as long as the inspiration it was started on.
   * Whatever ended the idea is what ended the work.
   */
  function _makingReconcile() {
    const making = game.makingActive
    if (!making || game.inspirationActive?.id === making.inspirationId) return
    const idea = (game.player.inspirations ?? []).find((r) => r.id === making.inspirationId)
    const reason = idea?.endedBy ?? { kind: 'inspiration', id: making.inspirationId }
    const result = game.applyMakingAbandon({ reason })
    if (!result.ok) _failureShow(result)
    else if (result.data.abandoned) _voiceEnqueue({ code: 'making.abandoned.lost' })
  }

  /** What a thing is called on the menu. */
  function _surfaceName(plan) {
    if (plan.surfaceKind === MAKING_SURFACE_KINDS.ITEM) return game.getItem(plan.surfaceId).name
    if (plan.surfaceKind === MAKING_SURFACE_KINDS.PLACE) {
      return game.voiceLine({ code: 'menu.making.place' })
    }
    return game.currentLocation.surfaces.find((s) => s.id === plan.surfaceId).name
  }

  /** Why a plan cannot be started, or null when it can. */
  function _planBlocked(plan) {
    if (plan.refusedReason) return plan.refusedReason
    if (!plan.affordable) {
      return game.requirementReason({
        code: REQUIREMENT_CODES.MONEY,
        params: {
          cost: moneyFormat({ amount: plan.cost }),
          money: moneyFormat({ amount: game.playerMoney }),
        },
      })
    }
    return plan.enoughTime ? null : game.requirementReason({ code: REQUIREMENT_CODES.TIME })
  }

  /** A menu entry that is not a content action: the loop resolves it by kind. */
  function _makingEntry({ id, label, kind, timeCost = 0, available = true, reason = null, data }) {
    return { id, label, kind, timeCost, weight: 0, available, unavailableReason: reason, ...data }
  }

  /**
   * The menu while the player is choosing what to make or is in the middle
   * of making it, or null when the ordinary menu applies.
   * @returns {Object[]|null}
   */
  function _makingMenu() {
    const making = game.makingActive
    if (making) {
      // The round on offer is the menu: the medium's game, one sitting a choice.
      // A game that has ended the work offers nothing; the last sitting is closing.
      const sittingTicks = game.games[making.game.id].sittingTicks
      const ticks = Math.min(sittingTicks, making.ticksTotal - making.ticksDone)
      const choices = making.game.state.offer?.choices ?? []
      return [
        ...choices.map((choice) =>
          _makingEntry({
            id: `making_choice_${choice.id}`,
            label: choice.label,
            kind: 'making_choice',
            timeCost: ticks,
            available: choice.available,
            reason: choice.reason,
            data: { choiceId: choice.id },
          })
        ),
        _makingEntry({
          id: 'making_abandon',
          label: game.voiceLine({ code: 'menu.making.abandon' }),
          kind: 'making_abandon',
        }),
      ]
    }
    const picker = game.makingPicker
    if (!picker) return null
    const options = makingOptions({
      player: game.player,
      location: game.currentLocation,
      items: game.items,
      mediums: game.mediums,
      gameTime: game.time,
    })
    if (!options.ok) {
      // The idea went while the menu was open; there is nothing to choose.
      game.makingPickerSet({ picker: null })
      return null
    }
    const cancel = _makingEntry({
      id: 'making_cancel',
      label: game.voiceLine({ code: 'menu.making.cancel' }),
      kind: 'making_cancel',
    })

    if (picker.step === 'ingredient') {
      const choose = (ingredientItemId, label) =>
        _makingEntry({
          id: `making_ingredient_${ingredientItemId ?? 'none'}`,
          label,
          kind: 'making_ingredient',
          data: { ingredientItemId },
        })
      return [
        choose(null, game.voiceLine({ code: 'menu.making.ingredient.none' })),
        ...options.data.ingredientItemIds.map((itemId) =>
          choose(
            itemId,
            game.voiceLine({
              code: 'menu.making.ingredient',
              params: { ingredient: game.getItem(itemId).name },
            })
          )
        ),
        cancel,
      ]
    }

    return [
      ...options.data.plans.map((plan) => {
        const medium = game.mediums[plan.mediumId]
        const label = game.voiceLine({
          code: plan.toolItemId ? 'menu.making.plan' : 'menu.making.plan.bare',
          params: {
            medium: medium.display,
            tool: plan.toolItemId ? game.getItem(plan.toolItemId).name : '',
            surface: _surfaceName(plan),
          },
        })
        return _makingEntry({
          id: `making_plan_${plan.mediumId}_${plan.toolItemId ?? 'none'}_${plan.surfaceKind}_${plan.surfaceId}`,
          label,
          kind: 'making_plan',
          timeCost: plan.ticksTotal,
          available: !_planBlocked(plan),
          reason: _planBlocked(plan),
          data: { plan, ingredientsOffered: medium.making.takesIngredient },
        })
      }),
      cancel,
    ]
  }

  /** The player asked to make something: open the menu, or say why not. */
  function _makingPickerOpen() {
    const options = makingOptions({
      player: game.player,
      location: game.currentLocation,
      items: game.items,
      mediums: game.mediums,
      gameTime: game.time,
    })
    if (!options.ok) return _failureShow(options)
    if (options.data.plans.length === 0) {
      _voiceEnqueue({ code: 'making.nothing_to_work_with' })
      return
    }
    game.makingPickerSet({ picker: { step: 'plan' } })
  }

  /** Start the work. The medium's game deals its first round onto the menu. */
  function _makingBegin({ plan }) {
    game.makingPickerSet({ picker: null })
    const started = game.applyMakingStart({ plan, rng })
    if (!started.ok) return _failureShow(started)
    _voiceEnqueue({ code: 'making.started' })
    if (started.data.promptCode) _voiceEnqueue({ code: started.data.promptCode })
  }

  /**
   * One sitting: the player's choice is played against the round on offer,
   * the work moves, the time passes, the world gets its look in. If the idea
   * is still there when the work is done, the piece is made.
   * @param {{ choiceId: string }} input
   */
  async function _makingSitting({ choiceId }) {
    const before = game.makingActive
    const played = game.applyMakingRound({ choiceId, rng })
    if (!played.ok) return _failureShow(played)
    _voiceEnqueue({ code: played.data.lineCode, params: played.data.lineParams })
    const cost = game.mediums[before.mediumId].making.statusChanges
    if (cost) game.applyStatusChanges(cost)
    await tick(played.data.ticksWorked)

    const after = game.makingActive
    if (!after) return
    if (after.ticksDone < after.ticksTotal) {
      if (played.data.promptCode) _voiceEnqueue({ code: played.data.promptCode })
      return
    }
    const finished = game.applyMakingFinish({ rng })
    if (!finished.ok) return _failureShow(finished)
    _checkTrain(finished.data.check)
    _voiceLiteralEnqueue(finished.data.experience.artistText)
    if (finished.data.markIdsCovered.length > 0) _voiceEnqueue({ code: 'making.covered' })
    if (finished.data.encore) _voiceEnqueue({ code: 'making.encore' })
    _refreshActions()
  }

  /**
   * Resolve one of the making menu's own entries.
   * @param {Object} entry
   */
  async function _makingEntryResolve(entry) {
    if (entry.kind === 'making_cancel') {
      game.makingPickerSet({ picker: null })
    } else if (entry.kind === 'making_plan') {
      const ingredients = makingOptions({
        player: game.player,
        location: game.currentLocation,
        items: game.items,
        mediums: game.mediums,
        gameTime: game.time,
      })
      if (!ingredients.ok) return _failureShow(ingredients)
      const offer = entry.ingredientsOffered && ingredients.data.ingredientItemIds.length > 0
      if (offer) {
        game.makingPickerSet({ picker: { step: 'ingredient', plan: entry.plan } })
      } else {
        _makingBegin({ plan: entry.plan })
      }
    } else if (entry.kind === 'making_ingredient') {
      _makingBegin({
        plan: { ...game.makingPicker.plan, ingredientItemId: entry.ingredientItemId },
      })
    } else if (entry.kind === 'making_choice') {
      await _makingSitting({ choiceId: entry.choiceId })
    } else if (entry.kind === 'making_abandon') {
      const result = game.applyMakingAbandon({ reason: { kind: 'player', id: 'walked_away' } })
      if (!result.ok) _failureShow(result)
      else if (result.data.abandoned) _voiceEnqueue({ code: 'making.abandoned.walked_away' })
    }
    _refreshActions()
  }

  /**
   * Travel to a location — advances time by travel cost, then moves.
   * @param {string} locationId
   * @param {number} travelTicks
   * @returns {Promise<void>}
   */
  async function travel(locationId, travelTicks = 0) {
    // Work in progress holds you where you are; walking away is a choice.
    if (game.makingActive) return
    game.makingPickerSet({ picker: null })
    await tick(travelTicks > 0 ? travelTicks : 1, locationId)
    if (save) {
      const saved = save.saveAuto()
      if (!saved.ok) _voiceEnqueue({ code: 'save.failed' })
    }
  }

  /**
   * Resolve a player action through the dice engine.
   * Applies outcomes to the store and enqueues narrative.
   *
   * @param {Object} action - Action definition
   */
  async function resolvePlayerAction(action) {
    if (!game.player) return

    if (action.kind?.startsWith('making_')) {
      await _makingEntryResolve(action)
      return
    }

    const characters = game.charactersAtCurrentLocation
    const result = actionResolve({
      player: game.player,
      action,
      gameTime: game.time,
      location: game.currentLocation,
      characters,
      rng,
    })

    _narrativeEnqueue(generateActionNarrative(result))

    if (!result.success && result.requirementFailure) {
      // Requirements not met — shouldn't happen if the menu is correct, but say why.
      const why = game.requirementReason(result.requirementFailure)
      if (narrative && why)
        _narrativeEnqueue(narrativeTextCreate({ text: why, style: { style: 'italic' } }))
      return
    }

    const outcome = result.outcome
    if (!outcome) return

    _checkTrain(result.diceResult)
    _outcomeApply({ outcome, source: { kind: 'action', id: action.id } })

    // Taking stock costs no time: the menu becomes the making menu.
    if (action.kind === 'make') {
      _makingPickerOpen()
      _refreshActions()
      return
    }

    // Looking around: what turns up is the engine's call, not the content's.
    if (action.kind === 'scavenge') _scavenge()

    // Some actions are the interruption: sleep, mostly.
    if (action.interruptsInspiration) {
      const cut = game.applyInspirationInterrupt({ reason: { kind: 'action', id: action.id } })
      if (!cut.ok) _failureShow(cut)
      else if (cut.data.interrupted) _voiceEnqueue({ code: 'inspiration.interrupted' })
    }

    // Advance time by action cost
    await tick(action.timeCost ?? 1)
  }

  /**
   * Apply an outcome's state effects to the store. Shared by actions and events.
   * Narrative is the caller's business, except the muse's own lines.
   * @param {Object} outcome
   * @param {{ kind: string, id: string }} source - what produced the outcome
   */
  function _outcomeApply({ outcome, source }) {
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

    // Doses — what went into the player. Hidden doses roll here.
    if (outcome.doses?.length > 0) {
      game.applyDoses({ doses: outcome.doses, rng })
    }

    // Inspiration — the world strikes. Snapshots the blend as it is now,
    // after the doses, because whoever you are right now owns the idea.
    if (outcome.inspiration) {
      const struck = game.applyInspirationStrike({ ...outcome.inspiration, source })
      if (!struck.ok) {
        _failureShow(struck)
      } else {
        if (struck.data.replaced) _voiceEnqueue({ code: 'inspiration.replaced' })
        _voiceEnqueue({ code: 'inspiration.struck' })
      }
    }

    // Grant items — itemsGained is string[] (item IDs per contract)
    // Look up each ID in the item registry before passing to inventoryAdd
    if (outcome.itemsGained?.length > 0) {
      for (const itemId of outcome.itemsGained) {
        const itemDef = game.getItem(itemId)
        if (itemDef) {
          inventoryAdd({ player: game.player, item: itemDef })
        } else {
          _failureShow({ error: { code: LOOP_ERROR_CODES.ITEM_UNKNOWN, params: { itemId } } })
        }
      }
    }

    // Remove items
    if (outcome.itemsLost?.length > 0) {
      for (const itemId of outcome.itemsLost) {
        inventoryRemove({ player: game.player, itemId })
      }
    }

    // Archetype changes
    if (outcome.archetypeChanges) {
      for (const [archetypeId, delta] of Object.entries(outcome.archetypeChanges)) {
        archetypeScoreAdd({ player: game.player, archetypeId, delta })
      }
    }

    // Counter changes
    if (outcome.counterChanges) {
      for (const [key, delta] of Object.entries(outcome.counterChanges)) {
        counterAdd({ player: game.player, counterName: key, delta })
      }
    }

    // Obsession feeding
    if (outcome.obsessionFed) {
      obsessionFeed({ player: game.player, obsessionId: outcome.obsessionFed, amount: 5 })
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

    const makingMenu = _makingMenu()
    if (makingMenu) {
      game.setAvailableActions(makingMenu)
      return
    }

    const location = game.currentLocation
    const characters = game.charactersAtCurrentLocation
    const actions = actionsAvailable({
      player: game.player,
      location,
      characters,
      gameTime: game.time,
      actionRegistry,
    })

    // Annotate with availability flag (for ActionMenu disabled state)
    const annotated = actions.map((a) => ({ ...a, available: true }))

    // Also add disabled actions so they show as greyed-out
    // (actions at this location that fail requirements)
    const disabledActions = actionRegistry
      .filter(
        (a) =>
          actionApplies({ action: a, location, characters }) &&
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
    useItem,
    onLocationEntered,
  }
}
