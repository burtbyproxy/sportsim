import { useGameStore } from '../stores/game.js'

const SAVE_PREFIX = 'sportsim_save_'
const SAVE_INDEX_KEY = 'sportsim_saves'

/**
 * Save/Load composable.
 *
 * Saves full game state to localStorage.
 * Each save has its own key: sportsim_save_{id}
 * An index of saves is kept at sportsim_saves.
 */
export function useSave() {
  const game = useGameStore()

  /**
   * Save current game state.
   * @param {string} [name] - optional display name
   * @returns {string} save ID
   */
  function save(name) {
    const id = crypto.randomUUID()
    const timestamp = Date.now()
    const displayName = name ?? `Day ${game.time.day} — ${game.time.period}`

    const saveData = {
      id,
      name: displayName,
      timestamp,
      player: game.player,
      time: game.time,
      locations: game.locations,
      npcs: game.npcs,
      firedEventIds: game.firedEventIds,
      counters: game.counters,
    }

    try {
      localStorage.setItem(SAVE_PREFIX + id, JSON.stringify(saveData))
      _indexSave({ id, name: displayName, timestamp })
    } catch (e) {
      console.warn('[save] Failed to write save:', e)
    }

    return id
  }

  /**
   * Load a save by ID.
   * @param {string} id
   * @returns {Object|null} save data, or null if not found
   */
  function load(id) {
    try {
      const raw = localStorage.getItem(SAVE_PREFIX + id)
      if (!raw) return null
      return JSON.parse(raw)
    } catch (e) {
      console.warn('[save] Failed to load save:', e)
      return null
    }
  }

  /**
   * List all saves (index only — id, name, timestamp).
   * @returns {Array<{id: string, name: string, timestamp: number}>}
   */
  function listSaves() {
    try {
      const raw = localStorage.getItem(SAVE_INDEX_KEY)
      if (!raw) return []
      return JSON.parse(raw)
    } catch {
      return []
    }
  }

  /**
   * Delete a save by ID.
   * @param {string} id
   */
  function deleteSave(id) {
    try {
      localStorage.removeItem(SAVE_PREFIX + id)
      const saves = listSaves().filter((s) => s.id !== id)
      localStorage.setItem(SAVE_INDEX_KEY, JSON.stringify(saves))
    } catch (e) {
      console.warn('[save] Failed to delete save:', e)
    }
  }

  /**
   * Auto-save current state (used on location change).
   * Overwrites the auto-save slot.
   */
  function autoSave() {
    const saves = listSaves()
    const existing = saves.find((s) => s.name === 'auto')
    if (existing) {
      deleteSave(existing.id)
    }
    save('auto')
  }

  function _indexSave(entry) {
    const saves = listSaves()
    saves.push(entry)
    localStorage.setItem(SAVE_INDEX_KEY, JSON.stringify(saves))
  }

  return {
    save,
    load,
    listSaves,
    deleteSave,
    autoSave,
  }
}
