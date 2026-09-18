import { defineStore } from 'pinia'
import { createClock, advanceClock } from '../engine/clock.js'

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
        this.locations[locationId].visitCount = (this.locations[locationId].visitCount ?? 0) + 1
      }
    },

    /**
     * Apply status changes to the player.
     * Money is excluded — use adjustMoney for that.
     * All other status values clamp 0-100.
     * @param {Object<string, number>} changes
     */
    applyStatusChanges(changes) {
      if (!this.player) return
      for (const [key, delta] of Object.entries(changes)) {
        if (key === 'money') continue // use adjustMoney
        if (key in this.player.status) {
          this.player.status[key] = Math.max(0, Math.min(100, this.player.status[key] + delta))
        }
      }
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
