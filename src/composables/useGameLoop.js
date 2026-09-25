/**
 * useGameLoop — the game loop: time passing, and the player acting.
 *
 * Everything that involves time passing flows through tick(), in this order:
 *   1. the clock advances
 *   2. the player's vitals decay
 *   3. stat modifiers expire
 *   4. the characters move (the simulation) and live their day: vitals
 *      wear down, and each stop feeds, rests or doses them
 *   4b. what is in everyone wears off, a knock to the head too, and blends
 *       are recomputed
 *   4c. the inspiration clock runs down
 *   4d. whoever is in charge may get an urge
 *   4e. marks go off, and time in charge wears grooves
 *   5. the player moves, if they are travelling, and the new scene starts
 *   5b. a change in how confused the player is changes what they get wrong
 *   6. the people act: anyone, anywhere, may start something
 *   6b. at most one event happens
 *   6c. work whose idea died dies with it
 *   7. failures nobody was told about are told
 *   8. the menu is rebuilt
 *
 * The player's own acts (actions, travel, items, event choices, making)
 * resolve through the engines, apply to the store, and speak through the
 * narrative renderer. The loop decides what the player may do; the
 * components only show it.
 */

import { useGameStore } from '../stores/game.js'
import {
  ACTION_KINDS,
  REQUIREMENT_CODES,
  actionApplies,
  actionResolve,
  actionsAvailable,
  requirementsMeet,
} from '../engine/actions.js'
import { locationOpen, exitRequirementsMeet } from '../models/location.js'
import { statusDecayChanges } from '../engine/stats.js'
import {
  modifiersTick,
  inventoryAdd,
  inventoryRemove,
  archetypeScoreAdd,
  counterAdd,
} from '../models/player.js'
import { MAKING_SURFACE_KINDS, ARTIFACT_STATUSES, makingOptions } from '../engine/making.js'
import { eventsRandomCheck, eventsTriggeredCheck, eventResolve } from '../engine/events.js'
import { actionMisperceived, locationKnown } from '../engine/perception.js'
import { MARK_TARGET_KINDS, psycheAvoids } from '../engine/psyche.js'
import { SUBJECT_KINDS, actsRoll, actResolve } from '../engine/acts.js'
import { cureCandidates } from '../engine/curing.js'
import { checkRoll } from '../engine/dice.js'
import { narrativeAction, narrativeEvent, narrativeLocation } from './useNarrative.js'
import { narrativeTextCreate, textFill } from '../utils/text.js'
import { sim } from '../workers/simulation-api.js'
import { moneyFormat } from '../utils/money.js'
import { listSortBy } from '../utils/list.js'

/** What can go wrong in the loop itself, as opposed to in what it calls. */
export const LOOP_ERROR_CODES = Object.freeze({
  simulationFailed: 'SIMULATION_FAILED',
  itemUnknown: 'ITEM_UNKNOWN',
  exitNone: 'EXIT_NONE',
  exitUnknown: 'EXIT_UNKNOWN',
})

/**
 * @param {{
 *   actionRegistry?: Object[],
 *   eventRegistry?: Object[],
 *   actRegistry?: Object[],
 *   narrative?: ReturnType<import('./useNarrative.js').useNarrative>|null,
 *   save?: ReturnType<import('./useSave.js').useSave>|null,
 *   rng?: () => number,
 *   simulation?: { tick: (input: { gameTime: Object, characters: Object[] }) => Object },
 * }} input
 *   actionRegistry — array of Action objects to evaluate against
 *   eventRegistry — array of GameEvent objects; checked after every tick
 *   actRegistry — array of Act objects; everyone rolls theirs after every tick
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
  actRegistry = [],
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
   * @param {{ ticks?: number, locationId?: string|null }} [input]
   *   locationId — if set, move there after the tick
   * @returns {Promise<void>}
   */
  async function tick({ ticks = 1, locationId = null } = {}) {
    if (!game.player) return

    // 1. Advance clock
    game.timeAdvance({ ticks })

    // 2. Apply stat decay
    const decayChanges = statusDecayChanges({
      tuning: game.tuning,
      status: game.player.status,
      ticksElapsed: ticks,
    })
    if (Object.keys(decayChanges).length > 0) {
      game.playerStatusApply({ changes: decayChanges })
    }

    // 3. Expire modifiers — modifiersTick mutates player in place
    modifiersTick({ player: game.player })

    // 4. Run the simulation — everyone lives the same ticks the player just
    // spent, stop by stop. We await so character positions update before
    // the action refresh, but a worker failure must not crash the game loop.
    try {
      const charactersArray = Object.values(game.characters)
      if (charactersArray.length > 0) {
        const simResult = await simulation.tick({
          tuning: game.tuning,
          gameTime: game.time,
          ticksElapsed: ticks,
          characters: charactersArray,
        })
        for (const update of simResult.characters) {
          // Somebody who can't go back to a place doesn't turn up there.
          const kept = update.locationId
            ? psycheAvoids({
                subject: game.characters[update.id],
                marks: game.marks,
                target: { kind: MARK_TARGET_KINDS.location, id: update.locationId },
              })
            : null
          game.characterLocationSet({
            characterId: update.id,
            locationId: kept ? null : update.locationId,
          })
        }
        game.charactersUpdatesApply({ updates: simResult.characters, rng })
      }
    } catch {
      // The world stands still this tick; the player hears why.
      failureShow({ error: { code: LOOP_ERROR_CODES.simulationFailed, params: {} } })
    }

    // 4b. Substances wear off — player and characters alike — and the blend
    // snapshot every roll reads is recomputed.
    game.blendDecayApply({ ticksElapsed: ticks })
    const daze = game.dazedDecayApply({ ticksElapsed: ticks })
    if (!daze.ok) failureShow(daze)

    // 4c. The inspiration clock runs down. An idea that ran out says so.
    const clock = game.inspirationTickApply({ ticksElapsed: ticks })
    if (!clock.ok) failureShow(clock)
    else if (clock.data.expired) voiceEnqueue({ code: 'inspiration.expired' })

    // 4d. Whoever is in charge may get the urge to do something about it.
    const urge = game.inspirationUrgeApply({ ticksElapsed: ticks, rng })
    if (!urge.ok) failureShow(urge)
    else if (urge.data.struck) voiceEnqueue({ code: 'inspiration.urge' })

    // 4e. What stays with the player goes off when it's set off; what has
    // been in charge too long wears a groove.
    const psyche = game.psycheTickApply({
      ticksElapsed: ticks,
      topicIds: game.availableActions.flatMap((a) => a.topicIds ?? []),
      rng,
    })
    if (!psyche.ok) failureShow(psyche)
    else {
      for (const mark of psyche.data.fitsStarted) {
        voiceEnqueue({
          code: game.marks[mark.markId].fit.lineCode,
          params: { target: game.targetName({ target: mark.target }) },
        })
      }
      for (const worn of psyche.data.grooves) traumaSpeak({ result: worn, quietOnSave: true })
    }

    // 5. Move if requested — the new scene's prose goes into a fresh log
    if (locationId) {
      game.playerMove({ locationId })
      locationEnter()
    }

    // 5b. Drink enough, or sober up enough, and the scene is seen afresh.
    perceptionRefresh({ force: false })

    // 6. The people act. After the move, so whoever is in the room with the
    // player is, and after the scene text so it lands beneath it.
    actsCheck({ ticksElapsed: ticks })

    // 6b. The world happens to the player: at most one event per tick.
    // After decay and after the move, so thresholds and the new place are
    // visible, and after the scene text so the event lands beneath it.
    eventsCheck()

    // 6c. If the idea died — ran out, got barged in on, got replaced — the
    // work on it dies too.
    makingReconcile()

    // 7. Anything that went wrong with nobody to tell is told now.
    faultsShow()

    // 8. Re-evaluate available actions
    refreshActions()
  }

  /**
   * Start a scene: clear the log, describe where the player is, and if an
   * event is still waiting on them (say, after a load), put it back in front.
   */
  function locationEnter() {
    perceptionRefresh({ force: true })
    if (narrative && game.currentLocation && game.player) {
      narrative.clearLog()
      sceneDescribe({ closer: false })
      for (const mark of game.currentLocation.marks ?? []) {
        if (mark.status === ARTIFACT_STATUSES.fresh) {
          voiceEnqueue({ code: 'mark.still_here', params: { work: mark.workText } })
        }
      }
      if (game.activeEvent) {
        narrativeEnqueue(narrativeEvent({ event: game.activeEvent, player: game.player }))
      }
    }
    refreshActions()
  }

  /**
   * Roll what the player gets wrong about the scene: always for a new scene,
   * and in one already under way whenever their band of confusion changes.
   * If that puts them somewhere else, they look up and see where.
   * @param {{ force: boolean }} input
   */
  function perceptionRefresh({ force }) {
    if (!game.player || !game.currentLocation) return
    const before = game.scene?.place.locationId
    const rolled = game.perceptionRollApply({ rng, force })
    if (!rolled.ok) return failureShow(rolled)
    if (!force && rolled.data.rolled && game.scene.place.locationId !== before) {
      sceneDescribe({ closer: true })
    }
  }

  /**
   * Say where the player takes themselves to be. The first time, the whole
   * place (or, somewhere they do not know, its looks); coming back, a line
   * that they are back. Looking closer is the whole place again.
   * @param {{ closer: boolean }} input
   */
  function sceneDescribe({ closer }) {
    const scene = game.scene
    if (!narrative || !scene) return
    if (!closer && game.currentLocation.visitCount > 1) {
      voiceEnqueue({ code: 'location.return', params: { place: game.scenePlace.displayInline } })
      return
    }
    narrative.enqueue(
      narrativeLocation({
        tuning: game.tuning,
        location: game.locations[scene.place.locationId],
        known: scene.place.known,
        player: game.player,
        gameTime: game.time,
      })
    )
  }

  /**
   * Everyone in the world, in their own scene, may start something
   * (engine/acts.js). Whatever comes of it lands where it lands: on the
   * player like any outcome, on anyone else on their body and mind. The
   * player hears of it when they are in the room.
   * @param {{ ticksElapsed: number }} input
   */
  function actsCheck({ ticksElapsed }) {
    if (!game.player || actRegistry.length === 0) return
    const topicIds = game.availableActions.flatMap((a) => a.topicIds ?? [])
    for (const author of Object.values(game.characters)) {
      if (!author.currentLocationId) continue
      const scene = game.sceneOf({
        who: { kind: SUBJECT_KINDS.character, id: author.id },
        topicIds,
      })
      if (!scene.ok) {
        failureShow(scene)
        continue
      }
      const rolled = actsRoll({ acts: actRegistry, author, scene: scene.data, ticksElapsed, rng })
      if (!rolled.ok) {
        failureShow(rolled)
        continue
      }
      const { act, mark, recipient } = rolled.data
      if (!act) continue
      const resolved = actResolve({
        tuning: game.tuning,
        act,
        author,
        recipient: recipient ? game.subjectFind({ who: recipient }) : null,
        rng,
      })
      if (!resolved.ok) {
        failureShow(resolved)
        continue
      }
      actLand({
        act,
        mark,
        author,
        recipient,
        resolved: resolved.data,
        seen: scene.data.playerId !== null,
      })
    }
  }

  /**
   * What an act comes to. The line first, when the player is there to hear
   * it: one for what is done to them or to nobody, another for what is
   * done to somebody else. Then what lands on the recipient, then on the
   * author. A mark left on the recipient is about the author; one left on
   * the author is about the recipient, or, when that was the player, the
   * place. The player's side of a contest trains the stat it rolled.
   * @param {{
   *   act: Object,
   *   mark: Object|null,
   *   author: Object,
   *   recipient: { kind: string, id: string }|null,
   *   resolved: { succeeded: boolean, branch: Object, contest: Object|null },
   *   seen: boolean,
   * }} input
   */
  function actLand({ act, mark, author, recipient, resolved, seen }) {
    const { branch, contest } = resolved
    const source = { kind: 'act', id: act.id }
    const toPlayer = recipient?.kind === SUBJECT_KINDS.player
    const toOther = Boolean(recipient) && !toPlayer
    // The player's side of a contest: a hold is a success, being taken is not.
    if (toPlayer && contest) checkTrain({ ...contest.second, success: !resolved.succeeded })
    if (seen) {
      voiceEnqueue({
        code: toOther ? branch.lineCodeOthers : branch.lineCode,
        params: {
          author: author.name,
          recipient: toOther ? game.characters[recipient.id].name : '',
          target: game.targetName({ target: mark?.target ?? null }),
        },
      })
    }
    const authorWho = { kind: SUBJECT_KINDS.character, id: author.id }
    if (branch.outcome && toPlayer) {
      outcomeApply({ outcome: branch.outcome, source, traumaTarget: authorWho })
    }
    if (branch.outcome && toOther) {
      const landed = game.subjectOutcomeApply({
        who: recipient,
        outcome: branch.outcome,
        traumaTarget: authorWho,
        source,
        rng,
      })
      if (!landed.ok) failureShow(landed)
    }
    if (branch.outcomeAuthor) {
      const landed = game.subjectOutcomeApply({
        who: authorWho,
        outcome: branch.outcomeAuthor,
        traumaTarget: toOther
          ? recipient
          : { kind: MARK_TARGET_KINDS.location, id: author.currentLocationId },
        source,
        rng,
      })
      if (!landed.ok) failureShow(landed)
    }
  }

  /**
   * Fire the first event whose conditions hold. Triggered events take
   * precedence over random ones. Nothing fires while a choice is pending.
   */
  function eventsCheck() {
    if (game.activeEvent || !game.player || !game.currentLocation) return
    const here = { player: game.player, location: game.currentLocation, gameTime: game.time }
    // Head down over the work, chance has a harder time finding you.
    const focus = game.makingActive ? game.tuning.making.focusEventFactor : 1
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
    eventStart(eventRegistry.find((e) => e.id === hit.id))
  }

  function eventStart(event) {
    if (event.oneTime) game.eventFiredMark({ eventId: event.id })
    narrativeEnqueue(narrativeEvent({ event, player: game.player }))
    // The world barging in kills whatever was moving the player — unless
    // the world is what's moving them, in which case the strike replaces it.
    if (!event.outcome?.inspiration) {
      const cut = game.inspirationInterruptApply({ reason: { kind: 'event', id: event.id } })
      if (!cut.ok) failureShow(cut)
      else if (cut.data.interrupted) voiceEnqueue({ code: 'inspiration.interrupted' })
    }
    if (event.choices?.length > 0) {
      game.eventActiveSet({ event })
      return
    }
    const resolved = eventResolve({ tuning: game.tuning, event, player: game.player, rng })
    if (!resolved.ok) return failureShow(resolved)
    eventOutcomeApply({ outcome: resolved.data.outcome, source: { kind: 'event', id: event.id } })
  }

  /**
   * Resolve the pending event with the player's choice.
   * @param {{ choiceIndex: number }} input
   */
  function resolveEventChoice({ choiceIndex }) {
    const event = game.activeEvent
    if (!event || !game.player) return
    const resolved = eventResolve({
      tuning: game.tuning,
      event,
      player: game.player,
      choiceIndex,
      rng,
    })
    // A choice the event never offered resolves nothing: the event keeps waiting, and says why.
    if (!resolved.ok) return failureShow(resolved)
    const { outcome, diceResult } = resolved.data
    checkTrain(diceResult)
    game.eventActiveClear()
    eventOutcomeApply({ outcome, source: { kind: 'event', id: event.id } })
    makingReconcile()
    refreshActions()
  }

  function eventOutcomeApply({ outcome, source }) {
    if (!outcome) return
    if (outcome.narrative) {
      const text =
        typeof outcome.narrative === 'string'
          ? narrativeTextCreate({ text: outcome.narrative })
          : outcome.narrative
      narrativeEnqueue(text)
    }
    outcomeApply({ outcome, source })
  }

  function narrativeEnqueue(narrativeText) {
    if (narrative && narrativeText?.tokens?.length > 0) {
      narrative.enqueue(narrativeText)
    }
  }

  /**
   * What came of a save: a new mark says what it is about, in its own line;
   * the same mark again, or a save that held, say so. A save nobody saw
   * coming (a groove) that held stays quiet.
   * @param {{ result: { saved: boolean, check: Object, mark: Object|null, duplicate: boolean }, quietOnSave: boolean }} input
   */
  function traumaSpeak({ result, quietOnSave }) {
    checkTrain(result.check)
    if (result.mark) {
      voiceEnqueue({
        code: game.marks[result.mark.markId].lineCode,
        params: { target: game.targetName({ target: result.mark.target }) },
      })
    } else if (result.duplicate) {
      voiceEnqueue({ code: 'psyche.mark.again' })
    } else if (!quietOnSave) {
      voiceEnqueue({ code: 'psyche.save.passed' })
    }
  }

  /**
   * A rolled check trains the stat it rolled on, pass or fail.
   * @param {Object|null} diceResult
   */
  function checkTrain(diceResult) {
    if (!diceResult?.stat) return
    game.playerStatXpApply({
      statName: diceResult.stat,
      amount: diceResult.success
        ? game.tuning.stats.xpCheckSuccess
        : game.tuning.stats.xpCheckFailure,
    })
  }

  /**
   * Use one of something the player carries. It takes a tick, like
   * finishing a beer does.
   * @param {{ itemId: string }} input
   */
  async function useItem({ itemId }) {
    if (!game.player || game.activeEvent) return
    const result = game.playerItemUse({ itemId, rng })
    if (!result.ok) return failureShow(result)
    voiceEnqueue({ code: 'item.used', params: { item: result.data.item.name } })
    await tick({ ticks: 1 })
  }

  /** A line in the voice of whoever is in charge, if the renderer is listening. */
  function voiceEnqueue({ code, params = {} }) {
    if (!narrative) return
    const text = game.voiceLine({ code, params })
    if (text) narrativeEnqueue(narrativeTextCreate({ text }))
  }

  /**
   * A failure, in play. Content may give its code a line like any other;
   * a code nobody wrote a line for shows as itself, never as nothing.
   * @param {{ error: { code: string, params?: Object } }} result
   */
  function failureShow(result) {
    voiceEnqueue({ code: result.error.code, params: result.error.params ?? {} })
  }

  /** Everything that went wrong with nobody to tell, told now. */
  function faultsShow() {
    for (const fault of game.faultsDrain()) failureShow({ error: fault })
  }

  /** Prose that is already in somebody's voice: a piece's own words. */
  function voiceLiteralEnqueue(text) {
    if (narrative && text) narrativeEnqueue(narrativeTextCreate({ text }))
  }

  /**
   * Look around the current location and say what turned up. The right
   * object can be the inspiration.
   */
  function scavengeRun() {
    const result = game.scavengeApply({ rng })
    if (!result.ok) return failureShow(result)
    checkTrain(result.data.check)
    const { itemId, entry, pickedClean } = result.data
    if (!itemId) {
      voiceEnqueue({ code: pickedClean ? 'scavenge.picked_clean' : 'scavenge.nothing' })
      return
    }
    const found = game.itemGet({ itemId })
    voiceEnqueue({ code: 'scavenge.found', params: { item: found.foundAs ?? found.name } })
    if (entry.inspiration) {
      const struck = game.inspirationStrikeApply({
        ...entry.inspiration,
        source: { kind: 'item', id: itemId },
      })
      if (!struck.ok) return failureShow(struck)
      if (struck.data.replaced) voiceEnqueue({ code: 'inspiration.replaced' })
      voiceEnqueue({ code: 'inspiration.struck' })
    }
  }

  // ── Making ─────────────────────────────────────────────────────────────────

  /**
   * A making lives exactly as long as the inspiration it was started on.
   * Whatever ended the idea is what ended the work.
   */
  function makingReconcile() {
    const making = game.makingActive
    if (!making || game.inspirationActive?.id === making.inspirationId) return
    const idea = (game.player.inspirations ?? []).find((r) => r.id === making.inspirationId)
    const reason = idea?.endedBy ?? { kind: 'inspiration', id: making.inspirationId }
    const result = game.makingAbandonApply({ reason })
    if (!result.ok) failureShow(result)
    else if (result.data.abandoned) voiceEnqueue({ code: 'making.abandoned.lost' })
  }

  /** What a thing is called on the menu. */
  function surfaceName(plan) {
    if (plan.surfaceKind === MAKING_SURFACE_KINDS.item)
      return game.itemGet({ itemId: plan.surfaceId }).name
    if (plan.surfaceKind === MAKING_SURFACE_KINDS.place) {
      return game.voiceLine({ code: 'menu.making.place' })
    }
    return game.currentLocation.surfaces.find((s) => s.id === plan.surfaceId).name
  }

  /** Why a plan cannot be started, or null when it can. */
  function planBlocked(plan) {
    if (plan.refusedReason) return plan.refusedReason
    if (!plan.affordable) {
      return game.requirementReason({
        code: REQUIREMENT_CODES.money,
        params: {
          cost: moneyFormat({ amount: plan.cost }),
          money: moneyFormat({ amount: game.playerMoney }),
        },
      })
    }
    return plan.enoughTime ? null : game.requirementReason({ code: REQUIREMENT_CODES.time })
  }

  /** A menu entry that is not a content action: the loop resolves it by kind. */
  function makingEntry({ id, label, kind, timeCost = 0, available = true, reason = null, data }) {
    return { id, label, kind, timeCost, weight: 0, available, unavailableReason: reason, ...data }
  }

  /**
   * The menu while the player is choosing what to make or is in the middle
   * of making it, or null when the ordinary menu applies.
   * @returns {Object[]|null}
   */
  function makingMenuBuild() {
    const making = game.makingActive
    if (making) {
      // The round on offer is the menu: the medium's game, one sitting a choice.
      // A game that has ended the work offers nothing; the last sitting is closing.
      const sittingTicks = game.games[making.game.id].sittingTicks
      const ticks = Math.min(sittingTicks, making.ticksTotal - making.ticksDone)
      const choices = making.game.state.offer?.choices ?? []
      return [
        ...choices.map((choice) =>
          makingEntry({
            id: `making_choice_${choice.id}`,
            label: choice.label,
            kind: 'making_choice',
            timeCost: ticks,
            available: choice.available,
            reason: choice.reason,
            data: { choiceId: choice.id },
          })
        ),
        makingEntry({
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
    const cancel = makingEntry({
      id: 'making_cancel',
      label: game.voiceLine({ code: 'menu.making.cancel' }),
      kind: 'making_cancel',
    })

    if (picker.step === 'ingredient') {
      const choose = ({ ingredientItemId, label }) =>
        makingEntry({
          id: `making_ingredient_${ingredientItemId ?? 'none'}`,
          label,
          kind: 'making_ingredient',
          data: { ingredientItemId },
        })
      return [
        choose({
          ingredientItemId: null,
          label: game.voiceLine({ code: 'menu.making.ingredient.none' }),
        }),
        ...options.data.ingredientItemIds.map((itemId) =>
          choose({
            ingredientItemId: itemId,
            label: game.voiceLine({
              code: 'menu.making.ingredient',
              params: { ingredient: game.itemGet({ itemId }).name },
            }),
          })
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
            tool: plan.toolItemId ? game.itemGet({ itemId: plan.toolItemId }).name : '',
            surface: surfaceName(plan),
          },
        })
        return makingEntry({
          id: `making_plan_${plan.mediumId}_${plan.toolItemId ?? 'none'}_${plan.surfaceKind}_${plan.surfaceId}`,
          label,
          kind: 'making_plan',
          timeCost: plan.ticksTotal,
          available: !planBlocked(plan),
          reason: planBlocked(plan),
          data: { plan, ingredientsOffered: medium.making.takesIngredient },
        })
      }),
      cancel,
    ]
  }

  /** The player asked to make something: open the menu, or say why not. */
  function makingPickerOpen() {
    const options = makingOptions({
      player: game.player,
      location: game.currentLocation,
      items: game.items,
      mediums: game.mediums,
      gameTime: game.time,
    })
    if (!options.ok) return failureShow(options)
    if (options.data.plans.length === 0) {
      voiceEnqueue({ code: 'making.nothing_to_work_with' })
      return
    }
    game.makingPickerSet({ picker: { step: 'plan' } })
  }

  /** Start the work. The medium's game deals its first round onto the menu. */
  function makingBegin({ plan }) {
    game.makingPickerSet({ picker: null })
    const started = game.makingStartApply({ plan, rng })
    if (!started.ok) return failureShow(started)
    voiceEnqueue({ code: 'making.started' })
    if (started.data.promptCode) voiceEnqueue({ code: started.data.promptCode })
  }

  /**
   * One sitting: the player's choice is played against the round on offer,
   * the work moves, the time passes, the world gets its look in. If the idea
   * is still there when the work is done, the piece is made.
   * @param {{ choiceId: string }} input
   */
  // ── Curing ─────────────────────────────────────────────────────────────────

  /**
   * The menu while the player is choosing which mark to work on, or null
   * when the ordinary menu applies: one entry per mark the cure can reach,
   * each priced at the session, and a way out.
   * @returns {Object[]|null}
   */
  function cureMenuBuild() {
    const picker = game.curePicker
    if (!picker) return null
    const action = actionRegistry.find((a) => a.id === picker.actionId)
    const cure = game.cures[action?.cureId]
    if (!cure) {
      game.curePickerSet({ picker: null })
      return null
    }
    const candidates = cureCandidates({ subject: game.player, marks: game.marks, cure })
    if (candidates.length === 0) {
      game.curePickerSet({ picker: null })
      return null
    }
    const broke = cure.session.money > game.playerMoney
    const reason = broke
      ? game.requirementReason({
          code: REQUIREMENT_CODES.money,
          params: {
            cost: moneyFormat({ amount: cure.session.money }),
            money: moneyFormat({ amount: game.playerMoney }),
          },
        })
      : null
    return [
      ...candidates.map(({ mark, definition }) =>
        makingEntry({
          id: `cure_mark_${mark.id}`,
          label: game.voiceLine({
            code: mark.target ? 'menu.cure.mark' : 'menu.cure.mark.bare',
            params: { mark: definition.display, target: game.targetName({ target: mark.target }) },
          }),
          kind: 'cure_mark',
          timeCost: cure.session.ticks,
          available: !broke,
          reason,
          data: { cureId: cure.id, markInstanceId: mark.id },
        })
      ),
      makingEntry({
        id: 'cure_cancel',
        label: game.voiceLine({ code: 'menu.cure.cancel' }),
        kind: 'cure_cancel',
      }),
    ]
  }

  /**
   * An entry on the cure menu: out, or a session on the mark picked.
   * @param {Object} entry
   */
  async function cureEntryResolve(entry) {
    if (entry.kind === 'cure_cancel') {
      game.curePickerSet({ picker: null })
    } else if (entry.kind === 'cure_mark') {
      await cureSession({ cureId: entry.cureId, markInstanceId: entry.markInstanceId })
    }
    refreshActions()
  }

  /**
   * A session: the check is rolled and trains its stat, the session takes
   * its price and its toll, the count moves, and the cure says how it went
   * about what the mark is about. One session a visit; the menu closes.
   * @param {{ cureId: string, markInstanceId: string }} input
   */
  async function cureSession({ cureId, markInstanceId }) {
    const cure = game.cures[cureId]
    const roll = checkRoll({
      tuning: game.tuning,
      player: game.player,
      statName: cure.session.check.stat,
      modifiers: [],
      dc: cure.session.check.dc,
      rng,
    })
    checkTrain(roll)
    if (cure.session.money > 0) game.playerMoneyAdjust({ delta: -cure.session.money })
    if (cure.session.statusChanges) game.playerStatusApply({ changes: cure.session.statusChanges })
    const result = game.cureSessionApply({ cureId, markInstanceId, succeeded: roll.success })
    game.curePickerSet({ picker: null })
    if (!result.ok) return failureShow(result)
    const { mark, cured } = result.data
    const code = cured
      ? cure.lineCodes.cured
      : roll.success
        ? cure.lineCodes.took
        : cure.lineCodes.slipped
    voiceEnqueue({
      code,
      params: {
        mark: game.marks[mark.markId].display,
        target: game.targetName({ target: mark.target }),
      },
    })
    await tick({ ticks: cure.session.ticks })
  }

  async function makingSitting({ choiceId }) {
    const before = game.makingActive
    const played = game.makingRoundApply({ choiceId, rng })
    if (!played.ok) return failureShow(played)
    voiceEnqueue({ code: played.data.lineCode, params: played.data.lineParams })
    const cost = game.mediums[before.mediumId].making.statusChanges
    if (cost) game.playerStatusApply({ changes: cost })
    await tick({ ticks: played.data.ticksWorked })

    const after = game.makingActive
    if (!after) return
    if (after.ticksDone < after.ticksTotal) {
      if (played.data.promptCode) voiceEnqueue({ code: played.data.promptCode })
      return
    }
    const finished = game.makingFinishApply({ rng })
    if (!finished.ok) return failureShow(finished)
    checkTrain(finished.data.check)
    voiceLiteralEnqueue(finished.data.experience.artistText)
    if (finished.data.markIdsCovered.length > 0) voiceEnqueue({ code: 'making.covered' })
    if (finished.data.encore) voiceEnqueue({ code: 'making.encore' })
    refreshActions()
  }

  /**
   * Resolve one of the making menu's own entries.
   * @param {Object} entry
   */
  async function makingEntryResolve(entry) {
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
      if (!ingredients.ok) return failureShow(ingredients)
      const offer = entry.ingredientsOffered && ingredients.data.ingredientItemIds.length > 0
      if (offer) {
        game.makingPickerSet({ picker: { step: 'ingredient', plan: entry.plan } })
      } else {
        makingBegin({ plan: entry.plan })
      }
    } else if (entry.kind === 'making_ingredient') {
      makingBegin({
        plan: { ...game.makingPicker.plan, ingredientItemId: entry.ingredientItemId },
      })
    } else if (entry.kind === 'making_choice') {
      await makingSitting({ choiceId: entry.choiceId })
    } else if (entry.kind === 'making_abandon') {
      const result = game.makingAbandonApply({ reason: { kind: 'player', id: 'walked_away' } })
      if (!result.ok) failureShow(result)
      else if (result.data.abandoned) voiceEnqueue({ code: 'making.abandoned.walked_away' })
    }
    refreshActions()
  }

  /**
   * Leave by one of this place's exits. The exit sets how long it takes; the
   * loop decides whether the player may go, and says why not when they can't.
   * @param {{ locationId: string }} input
   * @returns {Promise<void>}
   */
  async function travel({ locationId }) {
    // While an event waits on the player, its choices are the only way on.
    if (game.activeEvent) return
    const way = (game.currentLocation?.exits ?? []).find((e) => e.locationId === locationId)
    if (!way) {
      return failureShow({ error: { code: LOOP_ERROR_CODES.exitNone, params: { locationId } } })
    }
    // Work in progress holds you where you are (walking away is a choice on
    // the making menu); a closed door or a requirement says why.
    const exit = exitEntry({ exit: way })
    if (!exit.available) return voiceLiteralEnqueue(exit.unavailableReason)
    game.makingPickerSet({ picker: null })
    await tick({ ticks: exit.travelTime > 0 ? exit.travelTime : 1, locationId })
    if (save) {
      const saved = save.saveAuto()
      if (!saved.ok) voiceEnqueue({ code: 'save.failed' })
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
    // While an event waits on the player, its choices are the only way on.
    if (game.activeEvent) return
    // An entry the menu greyed out says why instead of doing anything.
    if (action.available === false) return voiceLiteralEnqueue(action.unavailableReason)

    if (action.kind?.startsWith('making_')) {
      await makingEntryResolve(action)
      return
    }
    if (action.kind?.startsWith('cure_')) {
      await cureEntryResolve(action)
      return
    }

    // The player took the place, or the face, for something it isn't. What
    // they reached for is not here; the act runs into what is, and reality
    // gets through.
    const characters = game.charactersAtCurrentLocation
    if (actionMisperceived({ action, location: game.currentLocation, characters })) {
      const here = game.locationDisplay({
        locationId: game.currentLocationId,
        known: locationKnown({ player: game.player, locationId: game.currentLocationId }),
      })
      voiceEnqueue({ code: 'perception.misfire', params: { place: here.displayInline } })
      game.perceptionClear()
      await tick({ ticks: action.timeCost || 1 })
      return
    }

    const result = actionResolve({
      tuning: game.tuning,
      player: game.player,
      action,
      gameTime: game.time,
      location: game.currentLocation,
      characters,
      marks: game.marks,
      cures: game.cures,
      rng,
    })

    narrativeEnqueue(narrativeAction(result))

    if (!result.success && result.requirementFailure) {
      // Requirements not met — shouldn't happen if the menu is correct, but say why.
      const why = game.requirementReason(result.requirementFailure)
      if (narrative && why)
        narrativeEnqueue(narrativeTextCreate({ text: why, style: { style: 'italic' } }))
      return
    }

    const outcome = result.outcome
    if (!outcome) return

    checkTrain(result.diceResult)
    outcomeApply({ outcome, source: { kind: 'action', id: action.id } })

    // Taking stock costs no time: the menu becomes the making menu.
    if (action.kind === ACTION_KINDS.make) {
      makingPickerOpen()
      refreshActions()
      return
    }

    // Walking in costs no time: the menu becomes what the cure can work on.
    if (action.kind === ACTION_KINDS.cure) {
      game.curePickerSet({ picker: { actionId: action.id } })
      refreshActions()
      return
    }

    // A closer look costs no time: the whole place, as the player sees it.
    if (action.kind === ACTION_KINDS.look) {
      sceneDescribe({ closer: true })
      refreshActions()
      return
    }

    // Reading the sign: the player finds out what this place really is.
    if (action.kind === ACTION_KINDS.investigate) {
      const learned = game.locationLearnApply({ locationId: game.currentLocationId })
      if (!learned.ok) failureShow(learned)
      else sceneDescribe({ closer: true })
    }

    // Looking around: what turns up is the engine's call, not the content's.
    if (action.kind === ACTION_KINDS.scavenge) scavengeRun()

    // Some actions are the interruption: sleep, mostly.
    if (action.interruptsInspiration) {
      const cut = game.inspirationInterruptApply({ reason: { kind: 'action', id: action.id } })
      if (!cut.ok) failureShow(cut)
      else if (cut.data.interrupted) voiceEnqueue({ code: 'inspiration.interrupted' })
    }

    // Advance time by action cost
    await tick({ ticks: action.timeCost ?? 1 })
  }

  /**
   * Apply an outcome's state effects to the store. Shared by actions and events.
   * Narrative is the caller's business, except the muse's own lines.
   * @param {Object} outcome
   * @param {{ kind: string, id: string }} source - what produced the outcome
   */
  /**
   * An outcome lands on the player: the whole contract. What it does to a
   * body and a mind goes through the store, the same as for anyone; the
   * rest (money, things, ideas, what the player counts) is the player's alone.
   * @param {{ outcome: Object, source: { kind: string, id: string }, traumaTarget?: { kind: string, id: string }|null }} input
   *   traumaTarget — what a mark left by this is about, when the outcome does
   *   not say; otherwise whoever the player was dealing with, or else the place
   */
  function outcomeApply({ outcome, source, traumaTarget = null }) {
    // Apply money change via store (keeps Pinia reactivity)
    if (outcome.moneyChange != null) {
      game.playerMoneyAdjust({ delta: outcome.moneyChange })
    }

    // Vitals, stats, doses (hidden ones roll here), a knock to the head, and
    // a save against what happened. What a mark it leaves is about: what
    // content says, or else whoever the player was dealing with, or else
    // the place it happened.
    const landed = game.subjectOutcomeApply({
      who: game.playerWho,
      outcome,
      traumaTarget:
        traumaTarget ??
        (actionOf({ source })?.characterId
          ? { kind: MARK_TARGET_KINDS.character, id: actionOf({ source }).characterId }
          : { kind: MARK_TARGET_KINDS.location, id: game.currentLocationId }),
      source,
      rng,
    })
    if (!landed.ok) failureShow(landed)
    else if (landed.data.trauma) traumaSpeak({ result: landed.data.trauma, quietOnSave: false })

    // Inspiration — the world strikes. Snapshots the blend as it is now,
    // after the doses, because whoever you are right now owns the idea.
    if (outcome.inspiration) {
      const struck = game.inspirationStrikeApply({ ...outcome.inspiration, source })
      if (!struck.ok) {
        failureShow(struck)
      } else {
        if (struck.data.replaced) voiceEnqueue({ code: 'inspiration.replaced' })
        voiceEnqueue({ code: 'inspiration.struck' })
      }
    }

    // Grant items — itemsGained is string[] (item IDs per contract)
    // Look up each ID in the item registry before passing to inventoryAdd
    if (outcome.itemsGained?.length > 0) {
      for (const itemId of outcome.itemsGained) {
        const itemDef = game.itemGet({ itemId })
        if (itemDef) {
          inventoryAdd({ player: game.player, item: itemDef })
        } else {
          failureShow({ error: { code: LOOP_ERROR_CODES.itemUnknown, params: { itemId } } })
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

    // Mark one-time events
    if (outcome.eventTriggered) {
      game.eventFiredMark({ eventId: outcome.eventTriggered })
    }

    // Somebody tells the player what a place is.
    if (outcome.locationDiscovered) {
      const learned = game.locationLearnApply({ locationId: outcome.locationDiscovered })
      if (!learned.ok) failureShow(learned)
    }
  }

  /**
   * The content action an outcome came from, or null when it came from something else.
   * @param {{ source: { kind: string, id: string } }} input
   * @returns {Object|null}
   */
  function actionOf({ source }) {
    if (source.kind !== 'action') return null
    return actionRegistry.find((a) => a.id === source.id) ?? null
  }

  /**
   * Refresh available actions for the current location.
   * Called internally after every tick and on location entry.
   */
  function refreshActions() {
    exitsRefresh()
    if (!game.player || !game.currentLocation) {
      game.menuActionsSet({ actions: [] })
      return
    }

    const makingMenu = makingMenuBuild()
    if (makingMenu) {
      game.menuActionsSet({ actions: makingMenu })
      return
    }
    const cureMenu = cureMenuBuild()
    if (cureMenu) {
      game.menuActionsSet({ actions: cureMenu })
      return
    }

    // The menu offers the business of the place the player takes this to be,
    // with the people they take to be here.
    const { menu } = game.scene
    const location = game.locations[menu.locationId]
    const known = menu.known
    const characters = game.scenePeople
    const actions = actionsAvailable({
      player: game.player,
      location,
      known,
      characters,
      gameTime: game.time,
      actionRegistry,
      marks: game.marks,
      cures: game.cures,
    })

    // What can be done, in the engine's order (weight, and whatever the
    // player's marks pull toward), then what cannot yet, heaviest first, each
    // saying why not. Somebody the player can't face is there, and greyed out.
    const annotated = actions.map((a) => {
      const avoided = a.characterId
        ? game.playerAvoids({ target: { kind: MARK_TARGET_KINDS.character, id: a.characterId } })
        : null
      if (!avoided) return { ...a, available: true, unavailableReason: null }
      return { ...a, available: false, unavailableReason: avoidReason({ mark: avoided }) }
    })
    const disabledActions = listSortBy({
      items: actionRegistry.filter(
        (a) =>
          actionApplies({ action: a, location, known, characters }) &&
          !annotated.find((x) => x.id === a.id)
      ),
      keyOf: (a) => a.weight ?? 0,
      descending: true,
    }).map((a) => {
      const why = requirementsMeet({
        player: game.player,
        action: a,
        gameTime: game.time,
        location,
        marks: game.marks,
        cures: game.cures,
      })
      return {
        ...a,
        available: false,
        unavailableReason: game.requirementReason({
          code: why.reasonCode,
          params: why.reasonParams,
        }),
      }
    })

    game.menuActionsSet({ actions: [...annotated, ...disabledActions] })
  }

  /**
   * An exit as the menu shows it: named for where the player takes it to
   * lead, whether they can go, and if not, why.
   * @param {{ exit: Object }} input
   * @returns {Object} the exit with its label filled, available and unavailableReason
   */
  function exitEntry({ exit: way }) {
    const destination = game.locations[way.locationId]
    if (!destination) {
      return { ...way, available: false, unavailableReason: `[${LOOP_ERROR_CODES.exitUnknown}]` }
    }
    const seen = game.scene.exits.find((e) => e.locationId === way.locationId)
    const place = game.locationDisplay({
      locationId: seen.perceivedLocationId,
      known: seen.known,
    })
    const exit = {
      ...way,
      label: textFill({ text: way.label, params: { place: place.displayInline } }),
    }
    const blocked = (unavailableReason) => ({ ...exit, available: false, unavailableReason })
    if (game.makingActive) {
      return blocked(game.requirementReason({ code: REQUIREMENT_CODES.busy }))
    }
    if (!locationOpen({ location: destination, hour: game.time.hour })) {
      // A place's own words about being shut name it: they are for a place
      // the player knows, and knows this is the way to. Anywhere else is just shut.
      const named = seen.known && seen.perceivedLocationId === way.locationId
      return blocked(
        (named && destination.availability?.closedMessage) ||
          game.requirementReason({ code: REQUIREMENT_CODES.closed })
      )
    }
    // A place the player can't go back to: they can see the way, and can't take it.
    const avoided = game.playerAvoids({
      target: { kind: MARK_TARGET_KINDS.location, id: seen.perceivedLocationId },
    })
    if (avoided) return blocked(avoidReason({ mark: avoided }))
    const why = exitRequirementsMeet({
      exit: way,
      player: game.player,
      gameTime: game.time,
      location: game.currentLocation,
    })
    if (!why.meets) {
      return blocked(game.requirementReason({ code: why.reasonCode, params: why.reasonParams }))
    }
    return { ...exit, available: true, unavailableReason: null }
  }

  /**
   * Why the player won't, when a mark won't let them: about what it is about.
   * @param {{ mark: Object }} input
   * @returns {string}
   */
  function avoidReason({ mark }) {
    return game.requirementReason({
      code: REQUIREMENT_CODES.avoid,
      params: { target: game.targetName({ target: mark.target }) },
    })
  }

  /** The ways out of here, each saying whether it is open to the player now. */
  function exitsRefresh() {
    const exits = game.scene ? game.currentLocation.exits : []
    game.menuExitsSet({ exits: exits.map((exit) => exitEntry({ exit })) })
  }

  /**
   * Call this when the game screen mounts (new game, or a loaded save).
   * Moves made through travel() start their scene themselves.
   */
  function onLocationEntered() {
    locationEnter()
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
