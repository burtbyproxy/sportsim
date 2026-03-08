import { defineStore } from 'pinia'

const META_KEY = 'sportsim_meta'

/**
 * Meta-save store. Persists across playthroughs.
 * Survives game resets.
 */
export const useMetaStore = defineStore('meta', {
  state: () => ({
    /** @type {string[]} IDs of unlocked content */
    unlockedIds: [],

    /** @type {Array} completed run records */
    completedRuns: [],

    /** @type {Object<string, number>} counters across all runs */
    globalCounters: {},
  }),

  getters: {
    isUnlocked: (state) => (id) => state.unlockedIds.includes(id),
  },

  actions: {
    /**
     * Load meta-save from localStorage.
     */
    load() {
      try {
        const raw = localStorage.getItem(META_KEY)
        if (!raw) return
        const data = JSON.parse(raw)
        this.unlockedIds = data.unlockedIds ?? []
        this.completedRuns = data.completedRuns ?? []
        this.globalCounters = data.globalCounters ?? {}
      } catch (e) {
        console.warn('[meta] Failed to load meta-save:', e)
      }
    },

    /**
     * Persist current meta-save to localStorage.
     */
    save() {
      try {
        localStorage.setItem(
          META_KEY,
          JSON.stringify({
            unlockedIds: this.unlockedIds,
            completedRuns: this.completedRuns,
            globalCounters: this.globalCounters,
          })
        )
      } catch (e) {
        console.warn('[meta] Failed to save meta-save:', e)
      }
    },

    /**
     * Unlock an ID (archetype, location, perk, etc.).
     * @param {string} id
     */
    unlock(id) {
      if (!this.unlockedIds.includes(id)) {
        this.unlockedIds.push(id)
        this.save()
      }
    },

    /**
     * Record a completed run.
     * @param {Object} runRecord
     */
    recordRun(runRecord) {
      this.completedRuns.push(runRecord)
      this.save()
    },

    /**
     * Increment a global counter.
     * @param {string} key
     * @param {number} delta
     */
    incrementGlobal(key, delta = 1) {
      this.globalCounters[key] = (this.globalCounters[key] ?? 0) + delta
      this.save()
    },
  },
})
