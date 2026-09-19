import { defineStore } from 'pinia'
import { clockCreate, clockAdvance } from '../engine/clock.js'
import { blendCompute, blendDecay, dosesApply, sobrietyDerive } from '../engine/blend.js'
import { skillGain } from '../engine/skills.js'
import {
  inspirationActive,
  inspirationStrike,
  inspirationTick,
  inspirationInterrupt,
  inspirationSpend,
  inspirationUrge,
} from '../engine/inspiration.js'
import { voiceLine } from '../engine/voice.js'
import { scavengeSearch, scavengedCounterName } from '../engine/scavenge.js'
import {
  MAKING_SURFACE_KINDS,
  ARTIFACT_KINDS,
  ARTIFACT_STATUSES,
  makingActive,
  makingStart,
  makingWork,
  makingFinish,
  makingAbandon,
  marksCover,
} from '../engine/making.js'
import { pieceDescribe } from '../engine/describer.js'
import { gameStart, gameRoundResolve, gameScore } from '../engine/minigame.js'
import { skillEffective } from '../engine/skills.js'
import { inventoryAdd, inventoryRemove, modifierAdd, counterAdd } from '../models/player.js'
import { locationVisitAdd, locationRestore } from '../models/location.js'
import { itemUseResolve, itemUsable } from '../engine/items.js'
import { moneyFormat } from '../utils/money.js'
import { menuEntriesBuild } from '../utils/menu.js'
import { textFill } from '../utils/text.js'
import { statXpApply, statusChangesApply } from '../engine/stats.js'
import { statusBarFillClass } from '../utils/statusBar.js'
import { resultOk, resultFail } from '../engine/result.js'
import { numberRound } from '../utils/number.js'

/** Enumerated error codes for the store's own refusals. Engine results pass through with theirs. */
export const GAME_ERROR_CODES = Object.freeze({
  NONE_IN_PROGRESS: 'NONE_IN_PROGRESS',
  PLAYER_MISSING: 'PLAYER_MISSING',
  STAT_UNKNOWN: 'STAT_UNKNOWN',
})

/**
 * Add a map of deltas onto a map of levels, dropping any key that reaches zero.
 * @param {{ levels: Object<string, number>, changes: Object<string, number> }} input
 * @returns {void}
 */
function _levelsApply({ levels, changes }) {
  for (const [id, delta] of Object.entries(changes)) {
    const next = numberRound({ value: (levels[id] ?? 0) + delta, places: 2 })
    if (next <= 0) {
      delete levels[id]
    } else {
      levels[id] = next
    }
  }
}

/**
 * Primary game state store.
 * Holds player, game time, location, NPC states, and fired events.
 */
export const useGameStore = defineStore('game', {
  state: () => ({
    /** @type {import('../engine/clock.js').GameTime} */
    time: clockCreate(),

    /** @type {Object|null} */
    player: null,

    /** Current location ID */
    currentLocationId: null,

    /** @type {Object<string, Object>} */
    locations: {},

    /** @type {Object<string, Object>} */
    characters: {},

    /** IDs of one-time events that have fired this run */
    firedEventIds: [],

    /** An event waiting on the player's choice, or null. One at a time. */
    activeEvent: null,

    /**
     * Failures with no caller to hand a result back to, waiting to be shown:
     * { code, message, params, tick }. The loop drains them into play.
     */
    faults: [],

    /** @type {Object<string, Object>} */
    items: {},

    /** Substance definitions, keyed by id. Loaded once at init from content/substances. */
    substances: {},

    /** The map's action definitions, keyed by id. Loaded at boot. */
    actions: {},

    /** The map's event definitions, keyed by id. Loaded at boot. */
    events: {},

    /** Condition definitions, keyed by id. Loaded once at init from content/conditions. */
    conditions: {},

    /** Medium definitions, keyed by id. Loaded once at init from content/mediums. */
    mediums: {},

    /** Voice catalogs, keyed by persona id. Loaded once at init from content/voices. */
    voices: {},

    /** Scavenge loot tables, keyed by id. Loaded once at init from content/scavenge. */
    scavengeTables: {},

    /** Minigame definitions, keyed by id. Loaded once at init from content/games. */
    games: {},

    /** What a new game is: title words, map, starting point. Loaded once from content/game.json. */
    config: null,

    /** The game's words: stats, vitals, types. Loaded once from content/vocabulary.json. */
    vocabulary: null,

    /**
     * The making menu while the player is choosing what to make, or null.
     * { step: 'plan' } or { step: 'ingredient', plan }. Not saved: a load
     * lands on the ordinary menu.
     */
    makingPicker: null,

    /** Actions currently available at this location */
    availableActions: [],

    /** This place's exits, each with available and unavailableReason. The loop fills it. */
    availableExits: [],

    /** The character the player has picked out to deal with, or null. */
    characterSelectedId: null,

    /** Whether a game is actively running */
    isRunning: false,
  }),

  getters: {
    currentLocation: (state) => {
      if (!state.currentLocationId) return null
      return state.locations[state.currentLocationId] ?? null
    },

    charactersAtCurrentLocation: (state) => {
      if (!state.currentLocationId) return []
      return Object.values(state.characters).filter(
        (c) => c.currentLocationId === state.currentLocationId
      )
    },

    playerMoney: (state) => state.player?.status?.money ?? 0,

    /** The player's money as they read it: "$3.50", "-$2.00". */
    playerMoneyText: (state) => moneyFormat({ amount: state.player?.status?.money ?? 0 }),

    /** The screen's own words (content/vocabulary.json `ui`), or null before boot. */
    ui: (state) => state.vocabulary?.ui ?? null,

    /** What heads the menu: the waiting event, the person picked out, or the plain question. */
    menuTitle() {
      if (!this.ui) return ''
      if (this.activeEvent) return this.activeEvent.title ?? this.ui.menu.title
      return this.characterSelected?.name ?? this.ui.menu.title
    },

    /** What the menu says when it has nothing to offer. */
    menuEmptyText() {
      if (!this.ui) return ''
      if (!this.characterSelected) return this.ui.menu.empty
      return textFill({
        text: this.ui.menu.emptyWith,
        params: { name: this.characterSelected.name },
      })
    },

    /** The character picked out, or null. */
    characterSelected: (state) => state.characters[state.characterSelectedId] ?? null,

    /**
     * The actions the menu offers: a picked-out character's own, or, with
     * nobody picked out, the ones that are about the place.
     */
    menuActions: (state) =>
      state.availableActions.filter((action) =>
        state.characterSelectedId
          ? action.characterId === state.characterSelectedId
          : !action.characterId
      ),

    /** The one navigable list the menu shows: event choices, or actions then exits. */
    menuEntries() {
      return menuEntriesBuild({
        actions: this.menuActions,
        exits: this.availableExits,
        choices: this.activeEvent?.choices ?? [],
      })
    },
    playerHealth: (state) => state.player?.status?.health ?? 100,
    playerEnergy: (state) => state.player?.status?.energy ?? 100,
    playerMood: (state) => state.player?.status?.mood ?? 50,
    playerSobriety: (state) => state.player?.status?.sobriety ?? 100,
    playerHunger: (state) => state.player?.status?.hunger ?? 100,

    /** What the player is carrying, as the inventory panel lists it. */
    playerInventory: (state) =>
      (state.player?.inventory ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type,
        usable: itemUsable({ item }),
        quantity: item.quantity ?? 1,
        description: item.description ?? '',
      })),

    /** The inspiration moving the player right now, or null. */
    inspirationActive: (state) =>
      state.player ? inspirationActive({ player: state.player }) : null,

    /**
     * Every persona anything can put in charge, keyed by id: a substance's,
     * its withdrawal's, a condition's.
     */
    personas: (state) => {
      const personas = {}
      for (const substance of Object.values(state.substances)) {
        personas[substance.persona.id] = substance.persona
        if (substance.withdrawal) {
          personas[substance.withdrawal.persona.id] = substance.withdrawal.persona
        }
      }
      for (const condition of Object.values(state.conditions)) {
        personas[condition.persona.id] = condition.persona
      }
      return personas
    },

    /**
     * The vitals panel, in content's order: what each bar is called, where
     * it stands, and whether it has turned colour. The panel only renders.
     */
    statusBars: (state) =>
      (state.vocabulary?.statuses ?? []).map((status) => {
        const value = state.player?.status?.[status.id] ?? 0
        return {
          key: status.id,
          label: status.display,
          icon: status.icon,
          value,
          fillClass: statusBarFillClass({ value, danger: status.danger, warning: status.warning }),
        }
      }),

    /** The vitals content may change directly (not the derived ones). */
    statusIdsWritable: (state) =>
      (state.vocabulary?.statuses ?? []).filter((s) => s.writable).map((s) => s.id),

    /** The making under way, or null. */
    makingActive: (state) => (state.player ? makingActive({ player: state.player }) : null),

    /**
     * Everything the player has made, newest first, as the work panel lists
     * it: what it is, and what became of it, in the voice of whoever is in
     * charge.
     */
    playerWorks(state) {
      const portfolio = state.player?.portfolio ?? []
      return [...(state.player?.experiences ?? [])].reverse().map((experience) => {
        const place = state.locations[experience.locationId]
        const mark = (place?.marks ?? []).find((m) => m.id === experience.artifactId)
        let code = 'work.whereabouts.none'
        if (portfolio.some((a) => a.id === experience.artifactId)) {
          code = 'work.whereabouts.carried'
        } else if (mark) {
          code =
            mark.status === ARTIFACT_STATUSES.FRESH
              ? 'work.whereabouts.fresh'
              : 'work.whereabouts.covered'
        }
        const line = voiceLine({
          code,
          personaId: this.personaInCharge,
          voices: state.voices,
          params: { place: place?.display ?? '' },
        })
        return {
          id: experience.id,
          workText: experience.workText,
          artistText: experience.artistText,
          whereabouts: line.ok ? line.data.text : `[${code}]`,
        }
      })
    },

    /** The persona in charge of the prose right now. */
    personaInCharge: (state) => state.player?.blend?.dominantPersonaId ?? 'sober',

    /**
     * What the sidebar says about the muse, in the voice of whoever is in
     * charge. Words, never a number.
     */
    inspirationLabel(state) {
      const active = this.inspirationActive
      let code = 'inspiration.status.none'
      if (active) {
        code =
          active.ticksRemaining * 2 > active.ticksTotal
            ? 'inspiration.status.fresh'
            : 'inspiration.status.fading'
      }
      const line = voiceLine({ code, personaId: this.personaInCharge, voices: state.voices })
      return line.ok ? line.data.text : `[${code}]`
    },
  },

  actions: {
    /**
     * Start a new game with the given player.
     * @param {{ player: Object, locationId: string }} input
     */
    runStart({ player, locationId }) {
      this.player = player
      this.currentLocationId = locationId
      this.time = clockCreate()
      this.firedEventIds = []
      this.activeEvent = null
      this.characters = {}
      this.availableActions = []
      this.availableExits = []
      this.characterSelectedId = null
      this.makingPicker = null
      this.isRunning = true
      this.blendRefresh()
      // Note: items registry persists across game reset — item definitions don't change per-run
    },

    /**
     * Advance game time by N ticks (1 tick = 15 min).
     * @param {{ ticks?: number }} input
     */
    timeAdvance({ ticks = 1 }) {
      this.time = clockAdvance({ gameTime: this.time, ticks })
    },

    /**
     * Move player to a new location.
     * @param {{ locationId: string }} input
     */
    playerMove({ locationId }) {
      this.characterSelectedId = null
      this.currentLocationId = locationId
      if (this.player) {
        this.player.currentLocationId = locationId
      }
      if (this.locations[locationId]) {
        locationVisitAdd({ location: this.locations[locationId] })
      }
    },

    /**
     * Apply status changes to the player.
     * Money is excluded — use playerMoneyAdjust for that. Sobriety is excluded — it
     * is derived from intoxications; use playerDosesApply. All other status values
     * clamp 0-100. Conditions depend on status, so the blend is refreshed.
     * @param {{ changes: Object<string, number> }} input
     */
    playerStatusApply({ changes }) {
      if (!this.player) return
      this.player.status = statusChangesApply({ status: this.player.status, changes })
      this.blendRefresh()
    },

    /**
     * Apply the simulation's status changes to characters, by the same rule
     * as the player's. A character with no status (fixed tier) is left be.
     * Conditions depend on status, so the blend is refreshed once.
     * @param {{ updates: Array<{ id: string, statusChanges?: Object<string, number> }> }} input
     */
    charactersStatusApply({ updates }) {
      for (const { id, statusChanges } of updates) {
        const character = this.characters[id]
        if (!statusChanges || !character?.status) continue
        character.status = statusChangesApply({ status: character.status, changes: statusChanges })
      }
      this.blendRefresh()
    },

    /**
     * Recompute the blend snapshot and derived sobriety for the player and
     * for every character that carries a status. The blend engine is the
     * only reader of substance and condition definitions.
     */
    blendRefresh() {
      const subjects = [this.player, ...Object.values(this.characters)].filter(
        (subject) => subject && subject.status
      )
      for (const subject of subjects) {
        const result = blendCompute({
          player: subject,
          substances: this.substances,
          conditions: this.conditions,
        })
        if (!result.ok) {
          this.faultRecord({
            error: { ...result.error, params: { ...result.error.params, subjectId: subject.id } },
          })
          continue
        }
        subject.blend = result.data
        subject.status.sobriety = sobrietyDerive({ intoxications: subject.intoxications ?? {} })
      }
    },

    /**
     * Put substances into the player. Each dose names a substance, a value,
     * and optionally a chance that it is really in there.
     * @param {{ doses: { substanceId: string, value: number, chance?: number }[], rng?: () => number }} input
     * @returns {{ ok: boolean, data: Object|null, error: Object|null }} the blend engine's result
     */
    playerDosesApply({ doses, rng = Math.random }) {
      if (!this.player)
        return resultFail({ code: GAME_ERROR_CODES.PLAYER_MISSING, message: 'No player' })
      this.player.intoxications ??= {}
      this.player.habituations ??= {}
      const result = dosesApply({ player: this.player, substances: this.substances, doses, rng })
      if (!result.ok) {
        return result
      }
      _levelsApply({ levels: this.player.intoxications, changes: result.data.intoxicationChanges })
      _levelsApply({ levels: this.player.habituations, changes: result.data.habituationChanges })
      this.blendRefresh()
      return result
    },

    /**
     * Let every substance wear off, and every habituation fade, for the
     * player and every character with a status, over elapsed ticks.
     * @param {{ ticksElapsed: number }} input
     */
    blendDecayApply({ ticksElapsed }) {
      const subjects = [this.player, ...Object.values(this.characters)].filter(
        (subject) => subject && subject.status
      )
      for (const subject of subjects) {
        subject.intoxications ??= {}
        subject.habituations ??= {}
        const result = blendDecay({ player: subject, substances: this.substances, ticksElapsed })
        if (!result.ok) {
          this.faultRecord({
            error: { ...result.error, params: { ...result.error.params, subjectId: subject.id } },
          })
          continue
        }
        _levelsApply({ levels: subject.intoxications, changes: result.data.intoxicationChanges })
        _levelsApply({ levels: subject.habituations, changes: result.data.habituationChanges })
      }
      this.blendRefresh()
    },

    /**
     * Adjust player money by delta. Can go negative. No clamping.
     * @param {{ delta: number }} input
     */
    playerMoneyAdjust({ delta }) {
      if (!this.player) return
      this.player.status.money += delta
    },

    /**
     * Apply stat changes to the player.
     * @param {{ changes: Object<string, number> }} input
     */
    playerStatsApply({ changes }) {
      if (!this.player) return
      for (const [stat, delta] of Object.entries(changes)) {
        if (this.player.stats[stat]) {
          this.player.stats[stat].base = Math.max(
            1,
            Math.min(100, this.player.stats[stat].base + delta)
          )
        }
      }
    },

    /**
     * Using a stat trains it. Experience lands on the stat, and the stat
     * levels on its own curve.
     * @param {{ statName: string, amount: number }} input
     * @returns {{ ok: boolean, data: { leveledUp: boolean }|null, error: Object|null }}
     */
    playerStatXpApply({ statName, amount }) {
      const stat = this.player?.stats?.[statName]
      if (!stat) {
        return resultFail({
          code: GAME_ERROR_CODES.STAT_UNKNOWN,
          message: `No stat '${statName}' to train`,
        })
      }
      const { stat: next, leveledUp } = statXpApply({ stat, amount })
      this.player.stats[statName] = next
      return resultOk({ leveledUp })
    },

    /**
     * Use one of something the player carries. Effects land on statuses or
     * become timed stat modifiers, doses go to the blend, and one is used up.
     * @param {{ itemId: string, rng?: () => number }} input
     * @returns {{ ok: boolean, data: Object|null, error: Object|null }} the items engine's result
     */
    playerItemUse({ itemId, rng = Math.random }) {
      const statusIds = this.statusIdsWritable
      const result = itemUseResolve({
        player: this.player,
        itemId,
        ...(statusIds.length > 0 ? { statusIds } : {}),
      })
      if (!result.ok) {
        return result
      }
      const { statusChanges, statModifiers, doses } = result.data
      for (const { statName, modifier } of statModifiers) {
        modifierAdd({ player: this.player, statName, modifier })
      }
      if (doses.length > 0) this.playerDosesApply({ doses, rng })
      inventoryRemove({ player: this.player, itemId })
      this.playerStatusApply({ changes: statusChanges })
      return result
    },

    /**
     * Mark a one-time event as fired.
     * @param {{ eventId: string }} input
     */
    eventFiredMark({ eventId }) {
      if (!this.firedEventIds.includes(eventId)) {
        this.firedEventIds.push(eventId)
      }
    },

    /**
     * Put an event in front of the player until they choose.
     * @param {{ event: Object }} input
     */
    eventActiveSet({ event }) {
      this.activeEvent = event
    },

    eventActiveClear() {
      this.activeEvent = null
    },

    /**
     * Set available actions for the current location.
     * @param {{ actions: Array }} input
     */
    menuActionsSet({ actions }) {
      this.availableActions = actions
    },

    /**
     * The exits as the menu shows them. Filled by the loop.
     * @param {{ exits: Object[] }} input
     */
    menuExitsSet({ exits }) {
      this.availableExits = exits
    },

    /**
     * Pick out a character to deal with; picking the same one again lets go.
     * @param {{ characterId: string }} input
     */
    characterSelect({ characterId }) {
      this.characterSelectedId = this.characterSelectedId === characterId ? null : characterId
    },

    /**
     * Register a location in state (used when loading save or discovering).
     * @param {{ location: Object }} input
     */
    locationRegister({ location }) {
      this.locations[location.id] = location
    },

    /**
     * Register a character in state.
     * @param {{ character: Object }} input
     */
    characterRegister({ character }) {
      this.characters[character.id] = character
    },

    /**
     * Register an item definition in the item registry.
     * Called at boot.
     * @param {{ item: Object }} input
     */
    itemRegister({ item }) {
      this.items[item.id] = item
    },

    /**
     * Look up an item definition by ID.
     * @param {{ itemId: string }} input
     * @returns {Object|null}
     */
    itemGet({ itemId }) {
      return this.items[itemId] ?? null
    },

    /**
     * Register an action definition. Called at boot.
     * @param {{ action: Object }} input
     */
    actionRegister({ action }) {
      this.actions[action.id] = action
    },

    /**
     * Register an event definition. Called at boot.
     * @param {{ event: Object }} input
     */
    eventRegister({ event }) {
      this.events[event.id] = event
    },

    /**
     * Register a substance definition. Called at boot.
     * @param {{ substance: Object }} input
     */
    substanceRegister({ substance }) {
      this.substances[substance.id] = substance
    },

    /**
     * Register a condition definition. Called at boot.
     * @param {{ condition: Object }} input
     */
    conditionRegister({ condition }) {
      this.conditions[condition.id] = condition
    },

    /**
     * Register a medium definition. Called at boot.
     * @param {{ medium: Object }} input
     */
    mediumRegister({ medium }) {
      this.mediums[medium.id] = medium
    },

    /**
     * Register a voice catalog. Called at boot.
     * @param {{ voice: Object }} input
     */
    voiceRegister({ voice }) {
      this.voices[voice.id] = voice
    },

    /**
     * Register a scavenge loot table. Called at boot.
     * @param {{ table: Object }} input
     */
    scavengeTableRegister({ table }) {
      this.scavengeTables[table.id] = table
    },

    /**
     * Register the game's vocabulary. Called at boot.
     * @param {{ vocabulary: Object }} input
     */
    vocabularyRegister({ vocabulary }) {
      this.vocabulary = vocabulary
    },

    /**
     * Register what a new game is. Called at boot.
     * @param {{ config: Object }} input
     */
    configRegister({ config }) {
      this.config = config
    },

    /**
     * Why not, in words: an engine's refusal code and params, said by whoever
     * is in charge. Ids a player should never read become the thing's name.
     * @param {{ code: string, params?: Object<string, string> }} input
     * @returns {string}
     */
    requirementReason({ code, params = {} }) {
      const named = { ...params }
      if (params.itemId) named.item = this.items[params.itemId]?.name ?? params.itemId
      return this.voiceLine({ code, params: named })
    },

    /**
     * Register a minigame definition. Called at boot.
     * @param {{ game: Object }} input
     */
    minigameRegister({ minigame }) {
      this.games[minigame.id] = minigame
    },

    /**
     * Look around the current location. A find goes into the inventory, is
     * remembered in the counters, and works the spot over.
     * @param {{ rng?: () => number }} input
     * @returns {{ ok: boolean, data: Object|null, error: Object|null }} the scavenge engine's result
     */
    scavengeApply({ rng = Math.random } = {}) {
      if (!this.player) {
        return resultFail({ code: GAME_ERROR_CODES.PLAYER_MISSING, message: 'No player' })
      }
      const result = scavengeSearch({
        player: this.player,
        location: this.currentLocation,
        tables: this.scavengeTables,
        items: this.items,
        gameTime: this.time,
        rng,
      })
      if (!result.ok) {
        return result
      }
      this.currentLocation.scavenge = result.data.scavenge
      if (result.data.itemId) {
        inventoryAdd({ player: this.player, item: this.items[result.data.itemId] })
        counterAdd({
          player: this.player,
          counterName: scavengedCounterName({ itemId: result.data.itemId }),
        })
      }
      return result
    },

    /**
     * A line of prose for a message code, in the voice of the persona in
     * charge. Empty when nobody has a line, which content validation forbids.
     * @param {{ code: string, params?: Object<string, string> }} input
     * @returns {string}
     */
    /**
     * Keep a failure that has no caller to return to, so it can be shown.
     * @param {{ error: { code: string, message: string, params?: Object } }} input
     */
    faultRecord({ error }) {
      this.faults.push({ ...error, params: error.params ?? {}, tick: this.time.tick })
    },

    /**
     * Hand over every recorded failure and forget them.
     * @returns {Array<{ code: string, message: string, params: Object, tick: number }>}
     */
    faultsDrain() {
      const drained = this.faults
      this.faults = []
      return drained
    },

    voiceLine({ code, params = {} }) {
      const line = voiceLine({
        code,
        personaId: this.personaInCharge,
        voices: this.voices,
        params,
      })
      if (!line.ok) {
        // A line nobody wrote shows up as its code, in play, instead of vanishing.
        return `[${code}]`
      }
      return line.data.text
    },

    /**
     * The world strikes. Snapshots the blend as it is right now.
     * @param {{ source: { kind: string, id: string }, mediumId?: string|null, strength: number, ticksTotal: number }} input
     * @returns {{ ok: boolean, data: Object|null, error: Object|null }} the inspiration engine's result
     */
    inspirationStrikeApply({ source, mediumId = null, strength, ticksTotal }) {
      if (!this.player) {
        return resultFail({ code: GAME_ERROR_CODES.PLAYER_MISSING, message: 'No player' })
      }
      const result = inspirationStrike({
        player: this.player,
        source,
        mediumId,
        strength,
        ticksTotal,
        gameTime: this.time,
        locationId: this.currentLocationId,
      })
      if (!result.ok) {
        return result
      }
      this.player.inspirations = result.data.inspirations
      return result
    },

    /**
     * Whoever is in charge may get the urge. When one lands it strikes like
     * any other inspiration, and the persona is its source.
     * @param {{ ticksElapsed: number, rng?: () => number }} input
     * @returns {{ ok: boolean, data: { struck: Object|null }|null, error: Object|null }}
     */
    inspirationUrgeApply({ ticksElapsed, rng = Math.random }) {
      if (!this.player) {
        return resultFail({ code: GAME_ERROR_CODES.PLAYER_MISSING, message: 'No player' })
      }
      const rolled = inspirationUrge({
        player: this.player,
        personas: this.personas,
        ticksElapsed,
        rng,
      })
      if (!rolled.ok) {
        return rolled
      }
      if (!rolled.data.urge) return resultOk({ struck: null })
      const { mediumId, strength, ticksTotal } = rolled.data.urge
      const struck = this.inspirationStrikeApply({
        source: { kind: 'persona', id: rolled.data.personaId },
        mediumId,
        strength,
        ticksTotal,
      })
      if (!struck.ok) return struck
      return resultOk({ struck: struck.data.struck })
    },

    /**
     * The clock runs down.
     * @param {{ ticksElapsed: number }} input
     * @returns {{ ok: boolean, data: Object|null, error: Object|null }}
     */
    inspirationTickApply({ ticksElapsed }) {
      if (!this.player) {
        return resultFail({ code: GAME_ERROR_CODES.PLAYER_MISSING, message: 'No player' })
      }
      const result = inspirationTick({ player: this.player, ticksElapsed, gameTime: this.time })
      if (!result.ok) {
        return result
      }
      this.player.inspirations = result.data.inspirations
      return result
    },

    /**
     * Something got in the way.
     * @param {{ reason: { kind: string, id: string } }} input
     * @returns {{ ok: boolean, data: Object|null, error: Object|null }}
     */
    inspirationInterruptApply({ reason }) {
      if (!this.player) {
        return resultFail({ code: GAME_ERROR_CODES.PLAYER_MISSING, message: 'No player' })
      }
      const result = inspirationInterrupt({ player: this.player, reason, gameTime: this.time })
      if (!result.ok) {
        return result
      }
      this.player.inspirations = result.data.inspirations
      return result
    },

    /**
     * The inspiration went into a piece.
     * @param {{ spentOn: { kind: string, id: string } }} input
     * @returns {{ ok: boolean, data: Object|null, error: Object|null }}
     */
    inspirationSpendApply({ spentOn }) {
      if (!this.player) {
        return resultFail({ code: GAME_ERROR_CODES.PLAYER_MISSING, message: 'No player' })
      }
      const result = inspirationSpend({ player: this.player, spentOn, gameTime: this.time })
      if (!result.ok) {
        return result
      }
      this.player.inspirations = result.data.inspirations
      return result
    },

    /**
     * Practice a medium. Experience lands on the skill cells the current
     * blend touches, split by weight.
     * @param {{ mediumId: string, amount: number }} input
     * @returns {{ ok: boolean, data: Object|null, error: Object|null }} the skills engine's result
     */
    skillGainApply({ mediumId, amount }) {
      if (!this.player) {
        return resultFail({ code: GAME_ERROR_CODES.PLAYER_MISSING, message: 'No player' })
      }
      const result = skillGain({ player: this.player, mediumId, mediums: this.mediums, amount })
      if (!result.ok) {
        return result
      }
      this.player.skills ??= {}
      this.player.skills[mediumId] = result.data.cells
      return result
    },

    /**
     * Open, move, or close the making menu.
     * @param {{ picker: { step: string, plan?: Object }|null }} input
     */
    makingPickerSet({ picker }) {
      this.makingPicker = picker
    },

    /**
     * Begin a piece of work here: the medium's game is dealt, and what the
     * work uses up leaves the inventory.
     * @param {{ plan: Object, rng?: () => number }} input
     * @returns {{ ok: boolean, data: Object|null, error: Object|null }} the making engine's
     *   result, with the game's opening promptCode
     */
    makingStartApply({ plan, rng = Math.random }) {
      const dealt = gameStart({
        game: this.games[this.mediums[plan?.mediumId]?.making?.gameId],
        personaId: this.personaInCharge,
        rng,
      })
      if (!dealt.ok) {
        return dealt
      }
      const result = makingStart({
        player: this.player,
        location: this.currentLocation,
        items: this.items,
        mediums: this.mediums,
        plan,
        gameState: dealt.data.state,
        gameTime: this.time,
      })
      if (!result.ok) {
        return result
      }
      this.player.makings = result.data.makings
      for (const itemId of result.data.itemIdsConsumed)
        inventoryRemove({ player: this.player, itemId })
      if (result.data.moneyCost > 0) this.playerMoneyAdjust({ delta: -result.data.moneyCost })
      return { ...result, data: { ...result.data, promptCode: dealt.data.promptCode } }
    },

    /**
     * A sitting: the player's choice is played against the round on offer,
     * and a sitting's worth of work goes into the piece.
     * @param {{ choiceId: string, rng?: () => number }} input
     * @returns {{ ok: boolean, data: Object|null, error: Object|null }} the making engine's
     *   result, with the round's lineCode, lineParams, promptCode and ticksWorked
     */
    makingRoundApply({ choiceId, rng = Math.random }) {
      const making = this.makingActive
      if (!making) {
        return resultFail({
          code: GAME_ERROR_CODES.NONE_IN_PROGRESS,
          message: 'The player is not making anything',
        })
      }
      const minigame = this.games[making.game.id]
      const skill = skillEffective({
        player: this.player,
        mediumId: making.mediumId,
        mediums: this.mediums,
      })
      const round = gameRoundResolve({
        game: minigame,
        state: making.game.state,
        choiceId,
        personaId: this.personaInCharge,
        skillValue: skill.ok ? skill.data.value : 0,
        rng,
      })
      if (!round.ok) {
        return round
      }
      const ticksWorked = Math.min(minigame.sittingTicks, making.ticksTotal - making.ticksDone)
      const result = makingWork({
        player: this.player,
        ticksWorked,
        gameState: round.data.state,
        workDone: round.data.workDone,
        gameTime: this.time,
      })
      if (!result.ok) {
        return result
      }
      this.player.makings = result.data.makings
      const { lineCode, lineParams, promptCode } = round.data
      return { ...result, data: { ...result.data, lineCode, lineParams, promptCode, ticksWorked } }
    },

    /**
     * The work is done. The check decides what it is, the describer gives it
     * the artist's words, the experience is remembered, the artifact goes in
     * the portfolio or onto the wall, the idea is spent, and the practice
     * lands on the skill grid. Nothing is written unless all of it can be.
     *
     * @param {{ rng?: () => number }} input
     * @returns {{ ok: boolean, data: Object|null, error: Object|null }} the making engine's result, with the words filled in
     */
    makingFinishApply({ rng = Math.random } = {}) {
      const location = this.currentLocation
      const active = this.makingActive
      const played = gameScore({ game: this.games[active?.game?.id], state: active?.game?.state })
      if (!played.ok) {
        return played
      }
      const result = makingFinish({
        player: this.player,
        location,
        mediums: this.mediums,
        modifiers: [played.data.modifier],
        gameTime: this.time,
        rng,
      })
      if (!result.ok) {
        return result
      }
      const { making, tier, experience, artifact, markIdsCovered } = result.data
      const words = pieceDescribe({
        tier,
        medium: this.mediums[making.mediumId],
        tool: making.toolItemId ? this.items[making.toolItemId] : null,
        surface:
          making.surfaceKind === MAKING_SURFACE_KINDS.ITEM
            ? this.items[making.surfaceId]
            : making.surfaceKind === MAKING_SURFACE_KINDS.PLACE
              ? location
              : (location.surfaces ?? []).find((s) => s.id === making.surfaceId),
        ingredient: making.ingredientItemId ? this.items[making.ingredientItemId] : null,
        words: played.data.words,
        personaId: this.personaInCharge,
        voices: this.voices,
      })
      if (!words.ok) {
        return words
      }
      for (const record of [experience, artifact]) {
        if (!record) continue
        record.workText = words.data.workText
        record.artistText = words.data.artistText
        record.words = played.data.words
      }

      this.player.makings = result.data.makings
      this.player.experiences ??= []
      this.player.experiences.push(experience)
      if (artifact?.kind === ARTIFACT_KINDS.PORTABLE) {
        this.player.portfolio ??= []
        this.player.portfolio.push(artifact)
      }
      if (artifact?.kind === ARTIFACT_KINDS.FIXED) {
        location.marks = [
          ...marksCover({
            location,
            markIdsCovered,
            coveredBy: { kind: 'mark', id: artifact.id },
            gameTime: this.time,
          }),
          artifact,
        ]
      }
      this.inspirationSpendApply({ spentOn: { kind: 'experience', id: experience.id } })
      if (result.data.encore) {
        this.inspirationStrikeApply({
          ...result.data.encore,
          source: { kind: 'experience', id: experience.id },
        })
      }
      this.skillGainApply({
        mediumId: making.mediumId,
        amount: this.mediums[making.mediumId].making.xp,
      })
      return result
    },

    /**
     * The work stops short.
     * @param {{ reason: { kind: string, id: string } }} input
     * @returns {{ ok: boolean, data: Object|null, error: Object|null }} the making engine's result
     */
    makingAbandonApply({ reason }) {
      const result = makingAbandon({ player: this.player, reason, gameTime: this.time })
      if (!result.ok) {
        return result
      }
      this.player.makings = result.data.makings
      return result
    },

    /**
     * After a load: rebuild every location on today's content definition,
     * keeping what the save remembers happening there.
     * @param {{ definitions: Object<string, Object> }} input
     */
    locationsRestore({ definitions }) {
      const restored = {}
      for (const definition of Object.values(definitions)) {
        restored[definition.id] = locationRestore({
          definition,
          saved: this.locations[definition.id] ?? null,
        })
      }
      this.locations = restored
    },

    /**
     * Update character location (from simulation worker output).
     * @param {{ characterId: string, locationId: string }} input
     */
    characterLocationSet({ characterId, locationId }) {
      if (this.characters[characterId]) {
        this.characters[characterId].currentLocationId = locationId
      }
    },

    /**
     * Load a full save game into state.
     * @param {{ save: Object }} input
     */
    runLoad({ save }) {
      this.player = save.player
      this.time = save.time
      this.currentLocationId = save.player.currentLocationId
      this.locations = save.locations
      this.characters = save.characters
      this.firedEventIds = save.firedEventIds
      this.activeEvent = save.activeEvent ?? null
      this.makingPicker = null
      this.isRunning = true
      this.blendRefresh()
      // Definitions (items, substances, actions...) are not in the save; boot
      // registered them and they persist across resets.
    },

    runReset() {
      this.player = null
      this.currentLocationId = null
      this.locations = {}
      this.characters = {}
      this.firedEventIds = []
      this.activeEvent = null
      this.availableActions = []
      this.availableExits = []
      this.characterSelectedId = null
      this.makingPicker = null
      this.isRunning = false
      this.time = clockCreate()
    },
  },
})
