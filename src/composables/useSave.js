import { useGameStore } from '../stores/game.js'
import { blendSober, sobrietyDerive } from '../engine/blend.js'

const SAVE_PREFIX = 'sportsim_save_'
const SAVE_INDEX_KEY = 'sportsim_saves'

/**
 * Current save format version.
 * Bump this whenever the save shape changes in a breaking way.
 */
export const SAVE_VERSION = 5

/**
 * Maximum number of save slots.
 * localStorage is ~5MB. Don't let greedy players fill the deep.
 */
export const MAX_SAVES = 20

/** Display name that marks the single auto-save slot. */
export const AUTO_SAVE_NAME = 'auto'

/**
 * Required top-level fields for a save to be considered valid.
 * These are the bones of the save. Without them it is nothing.
 */
const REQUIRED_SAVE_FIELDS = [
  'id',
  'name',
  'timestamp',
  'version',
  'player',
  'time',
  'locations',
  'characters',
  'firedEventIds',
  'counters',
]

/**
 * Validate a parsed save object.
 * Returns true if the save has all required fields and recognisable version.
 * @param {*} data
 * @returns {boolean}
 */
export function validateSave(data) {
  if (!data || typeof data !== 'object') return false
  for (const field of REQUIRED_SAVE_FIELDS) {
    if (!(field in data)) {
      console.warn(`[save] Validation failed: missing field "${field}"`)
      return false
    }
  }
  if (typeof data.version !== 'number' || data.version < 1) {
    console.warn(`[save] Validation failed: invalid version "${data.version}"`)
    return false
  }
  return true
}

/**
 * Bring a validated save up to the current version. Returns a new object;
 * the input is not mutated. A save already at the current version comes
 * back as a copy.
 *
 * v1 → v2: sobriety became derived from per-substance intoxications. A v1
 * save knows only a sobriety number, which cannot name what was drunk, so
 * everyone wakes up sober with an empty blend.
 * v2 → v3: the skill grid. Nobody had trained anything, so it is empty.
 * v3 → v4: the inspiration log. Nothing had struck yet, so it is empty.
 * v4 → v5: making. Nobody had made anything: no makings, no experiences, an
 * empty portfolio, and no marks on any location.
 *
 * @param {{ save: Object }} input
 * @returns {Object}
 */
export function saveMigrate({ save }) {
  const migrated = JSON.parse(JSON.stringify(save))
  if (migrated.version < 2) {
    const subjects = [migrated.player, ...Object.values(migrated.characters ?? {})]
    for (const subject of subjects) {
      if (!subject) continue
      subject.intoxications = {}
      subject.habituations = {}
      subject.blend = blendSober()
      if (subject.status) subject.status.sobriety = sobrietyDerive({ intoxications: {} })
    }
    migrated.version = 2
  }
  if (migrated.version < 3) {
    for (const subject of [migrated.player, ...Object.values(migrated.characters ?? {})]) {
      if (subject) subject.skills = {}
    }
    migrated.version = 3
  }
  if (migrated.version < 4) {
    for (const subject of [migrated.player, ...Object.values(migrated.characters ?? {})]) {
      if (subject) subject.inspirations = []
    }
    migrated.version = 4
  }
  if (migrated.version < 5) {
    if (migrated.player) {
      migrated.player.makings = []
      migrated.player.experiences = []
      migrated.player.portfolio = []
    }
    for (const location of Object.values(migrated.locations ?? {})) {
      if (location) location.marks = []
    }
    migrated.version = 5
  }
  return migrated
}

/**
 * Save/Load composable.
 *
 * Saves full game state to localStorage.
 * Each save has its own key: sportsim_save_{id}
 * An index of saves is kept at sportsim_saves.
 * Saves are validated and versioned, and can be exported and imported.
 */
export function useSave() {
  const game = useGameStore()

  /**
   * Save current game state.
   * @param {string} [name] - optional display name
   * @returns {string|null} save ID, or null if at capacity or write failed
   */
  function save(name) {
    const saves = listSaves()
    if (saves.length >= MAX_SAVES) {
      console.warn(`[save] Save limit reached (${MAX_SAVES}). Delete a save before saving again.`)
      return null
    }

    const id = crypto.randomUUID()
    const timestamp = Date.now()
    const displayName = name ?? `Day ${game.time.day} — ${game.time.period}`

    const saveData = {
      id,
      name: displayName,
      timestamp,
      version: SAVE_VERSION,
      player: game.player,
      time: game.time,
      locations: game.locations,
      characters: game.characters,
      firedEventIds: game.firedEventIds,
      activeEvent: game.activeEvent,
      counters: game.counters,
    }

    try {
      localStorage.setItem(SAVE_PREFIX + id, JSON.stringify(saveData))
      _indexSave({ id, name: displayName, timestamp })
    } catch (e) {
      console.warn('[save] Failed to write save:', e)
      return null
    }

    return id
  }

  /**
   * Load a save by ID.
   * Validates the save before returning it.
   * Returns null if not found, malformed, or from an incompatible version.
   * @param {string} id
   * @returns {Object|null} save data, or null if not found/invalid
   */
  function load(id) {
    try {
      const raw = localStorage.getItem(SAVE_PREFIX + id)
      if (!raw) return null
      const data = JSON.parse(raw)
      if (!validateSave(data)) {
        console.warn(`[save] Save "${id}" failed validation — discarding.`)
        return null
      }
      return saveMigrate({ save: data })
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
   * Auto-save current state. The game loop calls this on arrival at a
   * location. There is one auto-save slot; each call replaces it.
   * @returns {string|null} save ID, or null if the write failed
   */
  function autoSave() {
    const saves = listSaves()
    const existing = saves.find((s) => s.name === AUTO_SAVE_NAME)
    if (existing) {
      deleteSave(existing.id)
    }
    return save(AUTO_SAVE_NAME)
  }

  /**
   * Export a save as a JSON string.
   * Useful for players to back up their games or move between browsers.
   * @param {string} id
   * @returns {string|null} JSON string, or null if save not found/invalid
   */
  function exportSave(id) {
    const data = load(id)
    if (!data) return null
    return JSON.stringify(data, null, 2)
  }

  /**
   * Import a save from a JSON string.
   * Validates the data before writing it to localStorage.
   * Returns the new save ID if successful, null otherwise.
   * @param {string} jsonString
   * @returns {string|null} save ID, or null if invalid
   */
  function importSave(jsonString) {
    let data
    try {
      data = JSON.parse(jsonString)
    } catch (e) {
      console.warn('[save] importSave: invalid JSON —', e)
      return null
    }

    if (!validateSave(data)) {
      console.warn('[save] importSave: save data failed validation.')
      return null
    }

    const saves = listSaves()
    if (saves.length >= MAX_SAVES) {
      console.warn(`[save] importSave: save limit reached (${MAX_SAVES}). Delete a save first.`)
      return null
    }

    // Give it a fresh ID so it doesn't stomp an existing save
    const newId = crypto.randomUUID()
    const importedData = { ...saveMigrate({ save: data }), id: newId }

    try {
      localStorage.setItem(SAVE_PREFIX + newId, JSON.stringify(importedData))
      _indexSave({ id: newId, name: importedData.name, timestamp: importedData.timestamp })
    } catch (e) {
      console.warn('[save] importSave: failed to write to localStorage:', e)
      return null
    }

    return newId
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
    exportSave,
    importSave,
  }
}
