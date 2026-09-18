import { defineStore } from 'pinia'
import { createClock, advanceClock } from '../engine/clock.js'
import { blendCompute, blendDecay, dosesApply, sobrietyDerive } from '../engine/blend.js'
import { skillGain } from '../engine/skills.js'
import {
  inspirationActive,
  inspirationStrike,
  inspirationTick,
  inspirationInterrupt,
  inspirationSpend,
} from '../engine/inspiration.js'
import { voiceLine } from '../engine/voice.js'
import { scavengeSearch, scavengedCounterName } from '../engine/scavenge.js'
import { addItem, removeItem, addModifier, incrementCounter } from '../models/player.js'
import { incrementVisitCount } from '../models/location.js'
import { itemUseResolve } from '../engine/items.js'
import { statXpApply } from '../engine/stats.js'

/**
 * Add a map of deltas onto a map of levels, dropping any key that reaches zero.
 * @param {{ levels: Object<string, number>, changes: Object<string, number> }} input
 * @returns {void}
 */
function _levelsApply({ levels, changes }) {
  for (const [id, delta] of Object.entries(changes)) {
    const next = parseFloat(((levels[id] ?? 0) + delta).toFixed(2))
    if (next <= 0) {
      delete levels[id]
    } else {
      levels[id] = next
    }
  }
}

/**
 * Primary game state store.
 * Holds player, game time, location, NPC states, fired events, and counters.
 */
export const useGameStore = defineStore('game', {
  state: () => ({
    /** @type {import('../engine/clock.js').GameTime} */
    time: createClock(),

    /** @type {import('../../comms/docs/data-contracts.js').Player|null} */
    player: null,

    /** Current location ID */
    currentLocationId: null,

    /** @type {Object<string, import('../../comms/docs/data-contracts.js').Location>} */
    locations: {},

    /** @type {Object<string, import('../../comms/docs/data-contracts.js').Character>} */
    characters: {},

    /** IDs of one-time events that have fired this run */
    firedEventIds: [],

    /** An event waiting on the player's choice, or null. One at a time. */
    activeEvent: null,

    /** General-purpose counters */
    counters: {},

    /** @type {Object<string, import('../../comms/docs/data-contracts.js').Item>} */
    items: {},

    /** Substance definitions, keyed by id. Loaded once at init from content/substances. */
    substances: {},

    /** Condition definitions, keyed by id. Loaded once at init from content/conditions. */
    conditions: {},

    /** Medium definitions, keyed by id. Loaded once at init from content/mediums. */
    mediums: {},

    /** Voice catalogs, keyed by persona id. Loaded once at init from content/voices. */
    voices: {},

    /** Scavenge loot tables, keyed by id. Loaded once at init from content/scavenge. */
    scavengeTables: {},

    /** Actions currently available at this location */
    availableActions: [],

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

    /** @deprecated use charactersAtCurrentLocation */
    npcsAtCurrentLocation: (state) => {
      if (!state.currentLocationId) return []
      return Object.values(state.characters).filter(
        (c) => c.currentLocationId === state.currentLocationId
      )
    },

    playerMoney: (state) => state.player?.status?.money ?? 0,
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
        quantity: item.quantity ?? 1,
        description: item.description ?? '',
      })),

    /** The inspiration moving the player right now, or null. */
    inspirationActive: (state) =>
      state.player ? inspirationActive({ player: state.player }) : null,

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
      return line.ok ? line.data.text : ''
    },
  },

  actions: {
    /**
     * Start a new game with the given player.
     * @param {Object} player
     * @param {string} startLocationId
     */
    startNewGame(player, startLocationId) {
      this.player = player
      this.currentLocationId = startLocationId
      this.time = createClock()
      this.firedEventIds = []
      this.activeEvent = null
      this.counters = {}
      this.characters = {}
      this.availableActions = []
      this.isRunning = true
      this.blendRefresh()
      // Note: items registry persists across game reset — item definitions don't change per-run
    },

    /**
     * Advance game time by N ticks (1 tick = 15 min).
     * @param {number} ticks
     */
    advanceTime(ticks = 1) {
      this.time = advanceClock(this.time, ticks)
    },

    /**
     * Move player to a new location.
     * @param {string} locationId
     * @param {number} travelTicks
     */
    moveTo(locationId, travelTicks = 0) {
      if (travelTicks > 0) {
        this.advanceTime(travelTicks)
      }
      this.currentLocationId = locationId
      if (this.player) {
        this.player.currentLocationId = locationId
      }
      if (this.locations[locationId]) {
        incrementVisitCount(this.locations[locationId])
      }
    },

    /**
     * Apply status changes to the player.
     * Money is excluded — use adjustMoney for that. Sobriety is excluded — it
     * is derived from intoxications; use applyDoses. All other status values
     * clamp 0-100. Conditions depend on status, so the blend is refreshed.
     * @param {Object<string, number>} changes
     */
    applyStatusChanges(changes) {
      if (!this.player) return
      for (const [key, delta] of Object.entries(changes)) {
        if (key === 'money' || key === 'sobriety') continue
        if (key in this.player.status) {
          this.player.status[key] = Math.max(0, Math.min(100, this.player.status[key] + delta))
        }
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
          console.warn(
            `[game] blendRefresh (${subject.id}): ${result.error.code}`,
            result.error.message
          )
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
    applyDoses({ doses, rng = Math.random }) {
      if (!this.player)
        return { ok: false, data: null, error: { code: 'PLAYER_MISSING', message: 'No player' } }
      this.player.intoxications ??= {}
      this.player.habituations ??= {}
      const result = dosesApply({ player: this.player, substances: this.substances, doses, rng })
      if (!result.ok) {
        console.warn(`[game] applyDoses: ${result.error.code}`, result.error.message)
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
    applyBlendDecay({ ticksElapsed }) {
      const subjects = [this.player, ...Object.values(this.characters)].filter(
        (subject) => subject && subject.status
      )
      for (const subject of subjects) {
        subject.intoxications ??= {}
        subject.habituations ??= {}
        const result = blendDecay({ player: subject, substances: this.substances, ticksElapsed })
        if (!result.ok) {
          console.warn(
            `[game] applyBlendDecay (${subject.id}): ${result.error.code}`,
            result.error.message
          )
          continue
        }
        _levelsApply({ levels: subject.intoxications, changes: result.data.intoxicationChanges })
        _levelsApply({ levels: subject.habituations, changes: result.data.habituationChanges })
      }
      this.blendRefresh()
    },

    /**
     * Adjust player money by delta. Can go negative. No clamping.
     * @param {number} delta
     */
    adjustMoney(delta) {
      if (!this.player) return
      this.player.status.money += delta
    },

    /**
     * Apply stat changes to the player.
     * @param {Object<string, number>} changes
     */
    applyStatChanges(changes) {
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
    applyStatXp({ statName, amount }) {
      const stat = this.player?.stats?.[statName]
      if (!stat) {
        return {
          ok: false,
          data: null,
          error: { code: 'STAT_UNKNOWN', message: `No stat '${statName}' to train` },
        }
      }
      const { stat: next, leveledUp } = statXpApply({ stat, amount })
      this.player.stats[statName] = next
      return { ok: true, data: { leveledUp }, error: null }
    },

    /**
     * Use one of something the player carries. Effects land on statuses or
     * become timed stat modifiers, doses go to the blend, and one is used up.
     * @param {{ itemId: string, rng?: () => number }} input
     * @returns {{ ok: boolean, data: Object|null, error: Object|null }} the items engine's result
     */
    applyItemUse({ itemId, rng = Math.random }) {
      const result = itemUseResolve({ player: this.player, itemId })
      if (!result.ok) {
        console.warn(`[game] applyItemUse: ${result.error.code}`, result.error.message)
        return result
      }
      const { statusChanges, statModifiers, doses } = result.data
      for (const { statName, modifier } of statModifiers) {
        addModifier(this.player, statName, modifier)
      }
      if (doses.length > 0) this.applyDoses({ doses, rng })
      removeItem(this.player, itemId)
      this.applyStatusChanges(statusChanges)
      return result
    },

    /**
     * Mark a one-time event as fired.
     * @param {string} eventId
     */
    markEventFired(eventId) {
      if (!this.firedEventIds.includes(eventId)) {
        this.firedEventIds.push(eventId)
      }
    },

    /**
     * Put an event in front of the player until they choose.
     * @param {Object} event
     */
    setActiveEvent(event) {
      this.activeEvent = event
    },

    clearActiveEvent() {
      this.activeEvent = null
    },

    /**
     * Increment a counter by delta (default 1).
     * @param {string} key
     * @param {number} delta
     */
    incrementCounter(key, delta = 1) {
      this.counters[key] = (this.counters[key] ?? 0) + delta
    },

    /**
     * Set available actions for the current location.
     * @param {Array} actions
     */
    setAvailableActions(actions) {
      this.availableActions = actions
    },

    /**
     * Register a location in state (used when loading save or discovering).
     * @param {Object} location
     */
    registerLocation(location) {
      this.locations[location.id] = location
    },

    /**
     * Register a character in state.
     * @param {Object} character
     */
    registerCharacter(character) {
      this.characters[character.id] = character
    },

    /** @deprecated use registerCharacter */
    registerNpc(npc) {
      this.characters[npc.id] = npc
    },

    /**
     * Register an item definition in the item registry.
     * Called at game init from loadItems() output.
     * @param {Object} item
     */
    registerItem(item) {
      this.items[item.id] = item
    },

    /**
     * Look up an item definition by ID.
     * @param {string} itemId
     * @returns {Object|null}
     */
    getItem(itemId) {
      return this.items[itemId] ?? null
    },

    /**
     * Register a substance definition. Called at init from loadSubstances().
     * @param {{ substance: Object }} input
     */
    registerSubstance({ substance }) {
      this.substances[substance.id] = substance
    },

    /**
     * Register a condition definition. Called at init from loadConditions().
     * @param {{ condition: Object }} input
     */
    registerCondition({ condition }) {
      this.conditions[condition.id] = condition
    },

    /**
     * Register a medium definition. Called at init from loadMediums().
     * @param {{ medium: Object }} input
     */
    registerMedium({ medium }) {
      this.mediums[medium.id] = medium
    },

    /**
     * Register a voice catalog. Called at init from loadVoices().
     * @param {{ voice: Object }} input
     */
    registerVoice({ voice }) {
      this.voices[voice.id] = voice
    },

    /**
     * Register a scavenge loot table. Called at init from loadScavengeTables().
     * @param {{ table: Object }} input
     */
    registerScavengeTable({ table }) {
      this.scavengeTables[table.id] = table
    },

    /**
     * Look around the current location. A find goes into the inventory, is
     * remembered in the counters, and works the spot over.
     * @param {{ rng?: () => number }} input
     * @returns {{ ok: boolean, data: Object|null, error: Object|null }} the scavenge engine's result
     */
    applyScavenge({ rng = Math.random } = {}) {
      if (!this.player) {
        return { ok: false, data: null, error: { code: 'PLAYER_MISSING', message: 'No player' } }
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
        console.warn(`[game] applyScavenge: ${result.error.code}`, result.error.message)
        return result
      }
      this.currentLocation.scavenge = result.data.scavenge
      if (result.data.itemId) {
        addItem(this.player, this.items[result.data.itemId])
        incrementCounter(this.player, scavengedCounterName({ itemId: result.data.itemId }))
      }
      return result
    },

    /**
     * A line of prose for a message code, in the voice of the persona in
     * charge. Empty when nobody has a line, which content validation forbids.
     * @param {{ code: string, params?: Object<string, string> }} input
     * @returns {string}
     */
    voiceLine({ code, params = {} }) {
      const line = voiceLine({
        code,
        personaId: this.personaInCharge,
        voices: this.voices,
        params,
      })
      if (!line.ok) {
        console.warn(`[game] voiceLine: ${line.error.code}`, line.error.message)
        return ''
      }
      return line.data.text
    },

    /**
     * The world strikes. Snapshots the blend as it is right now.
     * @param {{ source: { kind: string, id: string }, mediumId?: string|null, strength: number, ticksTotal: number }} input
     * @returns {{ ok: boolean, data: Object|null, error: Object|null }} the inspiration engine's result
     */
    applyInspirationStrike({ source, mediumId = null, strength, ticksTotal }) {
      if (!this.player) {
        return { ok: false, data: null, error: { code: 'PLAYER_MISSING', message: 'No player' } }
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
        console.warn(`[game] applyInspirationStrike: ${result.error.code}`, result.error.message)
        return result
      }
      this.player.inspirations = result.data.inspirations
      return result
    },

    /**
     * The clock runs down.
     * @param {{ ticksElapsed: number }} input
     * @returns {{ ok: boolean, data: Object|null, error: Object|null }}
     */
    applyInspirationTick({ ticksElapsed }) {
      if (!this.player) {
        return { ok: false, data: null, error: { code: 'PLAYER_MISSING', message: 'No player' } }
      }
      const result = inspirationTick({ player: this.player, ticksElapsed, gameTime: this.time })
      if (!result.ok) {
        console.warn(`[game] applyInspirationTick: ${result.error.code}`, result.error.message)
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
    applyInspirationInterrupt({ reason }) {
      if (!this.player) {
        return { ok: false, data: null, error: { code: 'PLAYER_MISSING', message: 'No player' } }
      }
      const result = inspirationInterrupt({ player: this.player, reason, gameTime: this.time })
      if (!result.ok) {
        console.warn(`[game] applyInspirationInterrupt: ${result.error.code}`, result.error.message)
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
    applyInspirationSpend({ spentOn }) {
      if (!this.player) {
        return { ok: false, data: null, error: { code: 'PLAYER_MISSING', message: 'No player' } }
      }
      const result = inspirationSpend({ player: this.player, spentOn, gameTime: this.time })
      if (!result.ok) {
        console.warn(`[game] applyInspirationSpend: ${result.error.code}`, result.error.message)
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
    applySkillGain({ mediumId, amount }) {
      if (!this.player) {
        return { ok: false, data: null, error: { code: 'PLAYER_MISSING', message: 'No player' } }
      }
      const result = skillGain({ player: this.player, mediumId, mediums: this.mediums, amount })
      if (!result.ok) {
        console.warn(`[game] applySkillGain: ${result.error.code}`, result.error.message)
        return result
      }
      this.player.skills ??= {}
      this.player.skills[mediumId] = result.data.cells
      return result
    },

    /**
     * Update character location (from simulation worker output).
     * @param {string} characterId
     * @param {string} locationId
     */
    setCharacterLocation(characterId, locationId) {
      if (this.characters[characterId]) {
        this.characters[characterId].currentLocationId = locationId
      }
    },

    /** @deprecated use setCharacterLocation */
    setNpcLocation(characterId, locationId) {
      this.setCharacterLocation(characterId, locationId)
    },

    /**
     * Load a full save game into state.
     * @param {Object} save
     */
    loadSave(save) {
      this.player = save.player
      this.time = save.time
      this.currentLocationId = save.player.currentLocationId
      this.locations = save.locations
      // Support both old saves (npcs key) and new saves (characters key)
      this.characters = save.characters ?? save.npcs ?? {}
      this.firedEventIds = save.firedEventIds
      this.activeEvent = save.activeEvent ?? null
      this.counters = save.counters
      this.isRunning = true
      this.blendRefresh()
      // Note: items registry (this.items) is NOT restored from save —
      // it is populated at init via loadItems() and persists across resets.
      // The init flow (TitleScreen.vue) must call loadItems() before or after loadSave().
    },

    resetGame() {
      this.player = null
      this.currentLocationId = null
      this.locations = {}
      this.characters = {}
      this.firedEventIds = []
      this.activeEvent = null
      this.counters = {}
      this.availableActions = []
      this.isRunning = false
      this.time = createClock()
    },
  },
})
