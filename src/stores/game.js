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

    /** @type {Object<string, import('../../comms/docs/data-contracts.js').NPC>} */
    npcs: {},

    /** IDs of one-time events that have fired this run */
    firedEventIds: [],

    /** General-purpose counters */
    counters: {},

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

    npcsAtCurrentLocation: (state) => {
      if (!state.currentLocationId) return []
      return Object.values(state.npcs).filter(
        (npc) => npc.currentLocationId === state.currentLocationId
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
      this.counters = {}
      this.availableActions = []
      this.isRunning = true
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
      if (this.locations[locationId]) {
        this.locations[locationId].visitCount =
          (this.locations[locationId].visitCount ?? 0) + 1
      }
    },

    /**
     * Apply status changes to the player.
     * @param {Object<string, number>} changes
     */
    applyStatusChanges(changes) {
      if (!this.player) return
      for (const [key, delta] of Object.entries(changes)) {
        if (key in this.player.status) {
          this.player.status[key] = Math.max(
            0,
            Math.min(100, this.player.status[key] + delta)
          )
        }
      }
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
     * Register an NPC in state.
     * @param {Object} npc
     */
    registerNpc(npc) {
      this.npcs[npc.id] = npc
    },

    /**
     * Update NPC location (from simulation worker output).
     * @param {string} npcId
     * @param {string} locationId
     */
    setNpcLocation(npcId, locationId) {
      if (this.npcs[npcId]) {
        this.npcs[npcId].currentLocationId = locationId
      }
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
      this.npcs = save.npcs
      this.firedEventIds = save.firedEventIds
      this.counters = save.counters
      this.isRunning = true
    },

    resetGame() {
      this.player = null
      this.currentLocationId = null
      this.locations = {}
      this.npcs = {}
      this.firedEventIds = []
      this.counters = {}
      this.availableActions = []
      this.isRunning = false
      this.time = createClock()
    },
  },
})
