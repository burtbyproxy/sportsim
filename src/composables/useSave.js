import { useGameStore } from '../stores/game.js'
import { blendSober, sobrietyDerive } from '../engine/blend.js'
import { MAKING_STATUSES } from '../engine/making.js'
import { resultOk, resultFail } from '../engine/result.js'

const SAVE_PREFIX = 'sportsim_save_'
const SAVE_INDEX_KEY = 'sportsim_saves'

/**
 * Current save format version.
 * Bump this whenever the save shape changes in a breaking way.
 */
export const SAVE_VERSION = 7

/**
 * Maximum number of save slots.
 * localStorage is ~5MB. Don't let greedy players fill the deep.
 */
export const MAX_SAVES = 20

/** Display name that marks the single auto-save slot. */
export const AUTO_SAVE_NAME = 'auto'

/**
 * Why a save could not be written, read, or taken in. The code is the
 * contract; the message is for whoever is debugging.
 */
export const SAVE_ERROR_CODES = Object.freeze({
  LIMIT_REACHED: 'SAVE_LIMIT_REACHED',
  NOT_FOUND: 'SAVE_NOT_FOUND',
  UNREADABLE: 'SAVE_UNREADABLE',
  FIELD_MISSING: 'SAVE_FIELD_MISSING',
  VERSION_INVALID: 'SAVE_VERSION_INVALID',
  STORAGE_FAILED: 'SAVE_STORAGE_FAILED',
})

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
]

/**
 * Whether parsed data is a save: every required field, and a version.
 * @param {{ save: * }} input
 * @returns {{ ok: boolean, data: Object|null, error: { code: string, message: string, params?: Object }|null }}
 */
export function saveValidate({ save }) {
  if (!save || typeof save !== 'object') {
    return resultFail({ code: SAVE_ERROR_CODES.UNREADABLE, message: 'Not an object' })
  }
  for (const field of REQUIRED_SAVE_FIELDS) {
    if (!(field in save)) {
      return resultFail({
        code: SAVE_ERROR_CODES.FIELD_MISSING,
        message: `Missing field "${field}"`,
        params: { field },
      })
    }
  }
  if (typeof save.version !== 'number' || save.version < 1) {
    return resultFail({
      code: SAVE_ERROR_CODES.VERSION_INVALID,
      message: `Invalid version "${save.version}"`,
    })
  }
  return resultOk(save)
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
 * v5 → v6: the work is played. A making from before has no game on it, so
 * work caught in progress cannot be picked back up: it is abandoned, which
 * is what would have happened to it anyway.
 * v6 → v7: fields nothing ever read are gone: the save's own counters (the
 * player's counters are the live ones), the player's level and xp, a
 * character's level, dialogue trees and description variants, and a
 * location's variant, npc slots and action list. Nothing is lost that
 * anything used.
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
  if (migrated.version < 6) {
    for (const making of migrated.player?.makings ?? []) {
      if (making.game) continue
      making.game = null
      if (making.status === MAKING_STATUSES.IN_PROGRESS) {
        making.status = MAKING_STATUSES.ABANDONED
        making.endedBy = { kind: 'migration', id: 'v6' }
        making.updatedAtTick = migrated.time?.tick ?? making.updatedAtTick
      }
    }
    migrated.version = 6
  }
  if (migrated.version < 7) {
    delete migrated.counters
    if (migrated.player) {
      delete migrated.player.level
      delete migrated.player.xp
    }
    for (const character of Object.values(migrated.characters ?? {})) {
      if (!character) continue
      delete character.level
      delete character.dialogueTreeIds
      delete character.descriptionVariants
    }
    for (const location of Object.values(migrated.locations ?? {})) {
      if (!location) continue
      delete location.variant
      delete location.npcSlots
      delete location.actionIds
    }
    migrated.version = 7
  }
  return migrated
}

/**
 * Save/Load composable.
 *
 * Saves full game state to localStorage. Each save has its own key,
 * sportsim_save_{id}, and an index of saves is kept at sportsim_saves.
 * Saves are validated and versioned, and can be exported and imported.
 * Every function returns a result; nothing throws, nothing logs.
 */
export function useSave() {
  const game = useGameStore()

  /**
   * Write the current game as a new save.
   * @param {{ name?: string }} [input] - display name; defaults to the day and period
   * @returns {{ ok: boolean, data: { id: string }|null, error: Object|null }}
   */
  function saveWrite({ name } = {}) {
    const listed = savesList()
    if (listed.data.length >= MAX_SAVES) {
      return resultFail({
        code: SAVE_ERROR_CODES.LIMIT_REACHED,
        message: `${MAX_SAVES} saves already; delete one first`,
        params: { limit: MAX_SAVES },
      })
    }
    const id = crypto.randomUUID()
    const timestamp = Date.now()
    const saveData = {
      id,
      name: name ?? `Day ${game.time.day} — ${game.time.period}`,
      timestamp,
      version: SAVE_VERSION,
      player: game.player,
      time: game.time,
      locations: game.locations,
      characters: game.characters,
      firedEventIds: game.firedEventIds,
      activeEvent: game.activeEvent,
    }
    return _saveStore({ save: saveData, index: listed.data })
  }

  /**
   * Read a save by id, validated and brought up to the current version.
   * @param {{ id: string }} input
   * @returns {{ ok: boolean, data: Object|null, error: Object|null }}
   */
  function saveRead({ id }) {
    const raw = _storageGet({ key: SAVE_PREFIX + id })
    if (!raw.ok) return raw
    if (raw.data === null) {
      return resultFail({
        code: SAVE_ERROR_CODES.NOT_FOUND,
        message: `No save "${id}"`,
        params: { id },
      })
    }
    const parsed = _jsonParse({ text: raw.data })
    if (!parsed.ok) return parsed
    const valid = saveValidate({ save: parsed.data })
    if (!valid.ok) return valid
    return resultOk(saveMigrate({ save: valid.data }))
  }

  /**
   * Every save: id, name, timestamp. A missing index is no saves; an
   * unreadable one is rebuilt from the saves themselves, so a broken index
   * never strands a save.
   * @returns {{ ok: boolean, data: Array<{ id: string, name: string, timestamp: number }>, error: Object|null }}
   */
  function savesList() {
    const raw = _storageGet({ key: SAVE_INDEX_KEY })
    if (raw.ok && raw.data === null) return resultOk([])
    const parsed = raw.ok ? _jsonParse({ text: raw.data }) : raw
    if (parsed.ok && Array.isArray(parsed.data)) return resultOk(parsed.data)
    return resultOk(_indexRebuild())
  }

  /**
   * Delete a save by id.
   * @param {{ id: string }} input
   * @returns {{ ok: boolean, data: { id: string }|null, error: Object|null }}
   */
  function saveDelete({ id }) {
    const index = savesList().data.filter((entry) => entry.id !== id)
    try {
      localStorage.removeItem(SAVE_PREFIX + id)
      localStorage.setItem(SAVE_INDEX_KEY, JSON.stringify(index))
    } catch (e) {
      return resultFail({ code: SAVE_ERROR_CODES.STORAGE_FAILED, message: String(e) })
    }
    return resultOk({ id })
  }

  /**
   * Auto-save. There is one auto-save slot; each call replaces it. The game
   * loop calls this on arrival at a location.
   * @returns {{ ok: boolean, data: { id: string }|null, error: Object|null }}
   */
  function saveAuto() {
    const existing = savesList().data.find((entry) => entry.name === AUTO_SAVE_NAME)
    if (existing) {
      const deleted = saveDelete({ id: existing.id })
      if (!deleted.ok) return deleted
    }
    return saveWrite({ name: AUTO_SAVE_NAME })
  }

  /**
   * A save as a JSON string, for backing up or moving between browsers.
   * @param {{ id: string }} input
   * @returns {{ ok: boolean, data: { json: string }|null, error: Object|null }}
   */
  function saveExport({ id }) {
    const read = saveRead({ id })
    if (!read.ok) return read
    return resultOk({ json: JSON.stringify(read.data, null, 2) })
  }

  /**
   * Take in an exported save. It gets a fresh id so it never overwrites one.
   * @param {{ json: string }} input
   * @returns {{ ok: boolean, data: { id: string }|null, error: Object|null }}
   */
  function saveImport({ json }) {
    const parsed = _jsonParse({ text: json })
    if (!parsed.ok) return parsed
    const valid = saveValidate({ save: parsed.data })
    if (!valid.ok) return valid
    const listed = savesList()
    if (listed.data.length >= MAX_SAVES) {
      return resultFail({
        code: SAVE_ERROR_CODES.LIMIT_REACHED,
        message: `${MAX_SAVES} saves already; delete one first`,
        params: { limit: MAX_SAVES },
      })
    }
    const imported = { ...saveMigrate({ save: valid.data }), id: crypto.randomUUID() }
    return _saveStore({ save: imported, index: listed.data })
  }

  /**
   * Write a save and its index entry.
   * @param {{ save: Object, index: Array<Object> }} input
   * @returns {{ ok: boolean, data: { id: string }|null, error: Object|null }}
   */
  function _saveStore({ save, index }) {
    try {
      localStorage.setItem(SAVE_PREFIX + save.id, JSON.stringify(save))
      const entry = { id: save.id, name: save.name, timestamp: save.timestamp }
      localStorage.setItem(SAVE_INDEX_KEY, JSON.stringify([...index, entry]))
    } catch (e) {
      return resultFail({ code: SAVE_ERROR_CODES.STORAGE_FAILED, message: String(e) })
    }
    return resultOk({ id: save.id })
  }

  /**
   * The index, rebuilt from every readable save in storage, and written back.
   * @returns {Array<{ id: string, name: string, timestamp: number }>}
   */
  function _indexRebuild() {
    const index = []
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key?.startsWith(SAVE_PREFIX)) continue
        const parsed = _jsonParse({ text: localStorage.getItem(key) })
        if (!parsed.ok || !saveValidate({ save: parsed.data }).ok) continue
        const { id, name, timestamp } = parsed.data
        index.push({ id, name, timestamp })
      }
      localStorage.setItem(SAVE_INDEX_KEY, JSON.stringify(index))
    } catch {
      // Storage itself is failing; the saves found so far are all there is to list.
    }
    return index
  }

  return { saveWrite, saveRead, savesList, saveDelete, saveAuto, saveExport, saveImport }
}

/**
 * Read a key from storage. A missing key is data: null.
 * @param {{ key: string }} input
 * @returns {{ ok: boolean, data: string|null, error: Object|null }}
 */
function _storageGet({ key }) {
  try {
    return resultOk(localStorage.getItem(key))
  } catch (e) {
    return resultFail({ code: SAVE_ERROR_CODES.STORAGE_FAILED, message: String(e) })
  }
}

/**
 * Parse JSON as a result.
 * @param {{ text: string }} input
 * @returns {{ ok: boolean, data: *, error: Object|null }}
 */
function _jsonParse({ text }) {
  try {
    return resultOk(JSON.parse(text))
  } catch (e) {
    return resultFail({ code: SAVE_ERROR_CODES.UNREADABLE, message: String(e) })
  }
}
