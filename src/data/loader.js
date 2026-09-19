/**
 * Content Loader — the ONLY code that imports from content/.
 *
 * Reads the JSON under content/ through Vite's import.meta.glob and hands it
 * back by kind, keyed by id, as a result. Content that is not what it says it
 * is fails with the file it came from; nothing is skipped quietly.
 *
 * Consumer: composables/useBoot.js.
 */
import { resultOk, resultFail } from '../engine/result.js'

/** Why content could not be loaded. */
export const LOADER_ERROR_CODES = Object.freeze({
  KIND_UNKNOWN: 'CONTENT_KIND_UNKNOWN',
  FILE_MISSING: 'CONTENT_FILE_MISSING',
  ENTRY_NOT_OBJECT: 'CONTENT_ENTRY_NOT_OBJECT',
  ENTRY_ID_MISSING: 'CONTENT_ENTRY_ID_MISSING',
  ENTRY_ID_DUPLICATE: 'CONTENT_ENTRY_ID_DUPLICATE',
})

/** What there is to load. */
export const CONTENT_KINDS = Object.freeze({
  LOCATIONS: 'locations',
  ACTIONS: 'actions',
  EVENTS: 'events',
  CHARACTERS: 'characters',
  ITEMS: 'items',
  SUBSTANCES: 'substances',
  CONDITIONS: 'conditions',
  MEDIUMS: 'mediums',
  VOICES: 'voices',
  SCAVENGE_TABLES: 'scavengeTables',
  GAMES: 'games',
  CONFIG: 'config',
  VOCABULARY: 'vocabulary',
})

// Vite resolves these at build time; each value is a module with the JSON as its default.
const _SOURCES = {
  [CONTENT_KINDS.LOCATIONS]: import.meta.glob('/content/maps/*/locations/*.json', { eager: true }),
  [CONTENT_KINDS.ACTIONS]: import.meta.glob('/content/maps/*/actions/*.json', { eager: true }),
  [CONTENT_KINDS.EVENTS]: import.meta.glob('/content/maps/*/events/*.json', { eager: true }),
  [CONTENT_KINDS.CHARACTERS]: import.meta.glob('/content/characters/*.json', { eager: true }),
  [CONTENT_KINDS.ITEMS]: import.meta.glob('/content/items/*.json', { eager: true }),
  [CONTENT_KINDS.SUBSTANCES]: import.meta.glob('/content/substances/*.json', { eager: true }),
  [CONTENT_KINDS.CONDITIONS]: import.meta.glob('/content/conditions/*.json', { eager: true }),
  [CONTENT_KINDS.MEDIUMS]: import.meta.glob('/content/mediums/*.json', { eager: true }),
  [CONTENT_KINDS.VOICES]: import.meta.glob('/content/voices/*.json', { eager: true }),
  [CONTENT_KINDS.SCAVENGE_TABLES]: import.meta.glob('/content/scavenge/*.json', { eager: true }),
  [CONTENT_KINDS.GAMES]: import.meta.glob('/content/games/*.json', { eager: true }),
  [CONTENT_KINDS.CONFIG]: import.meta.glob('/content/game.json', { eager: true }),
  [CONTENT_KINDS.VOCABULARY]: import.meta.glob('/content/vocabulary.json', { eager: true }),
}

/** Kinds that live under a map, and kinds that are one file, not a collection. */
const _KINDS_BY_MAP = [CONTENT_KINDS.LOCATIONS, CONTENT_KINDS.ACTIONS, CONTENT_KINDS.EVENTS]
const _KINDS_SINGLE = [CONTENT_KINDS.CONFIG, CONTENT_KINDS.VOCABULARY]

/**
 * Entries from several files, keyed by id. A file holds one entry or a list
 * of them. Every entry must be an object with an id no other entry has.
 *
 * @param {{ files: Array<{ path: string, value: * }> }} input
 * @returns {{ ok: boolean, data: Object<string, Object>|null, error: Object|null }}
 */
export function contentMerge({ files }) {
  const byId = {}
  const pathById = {}
  for (const { path, value } of files) {
    for (const entry of Array.isArray(value) ? value : [value]) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return resultFail({
          code: LOADER_ERROR_CODES.ENTRY_NOT_OBJECT,
          message: `${path}: an entry is not an object`,
          params: { path },
        })
      }
      if (!entry.id) {
        return resultFail({
          code: LOADER_ERROR_CODES.ENTRY_ID_MISSING,
          message: `${path}: an entry has no id`,
          params: { path },
        })
      }
      if (entry.id in byId) {
        return resultFail({
          code: LOADER_ERROR_CODES.ENTRY_ID_DUPLICATE,
          message: `${path}: '${entry.id}' is already in ${pathById[entry.id]}`,
          params: { path, id: entry.id, pathFirst: pathById[entry.id] },
        })
      }
      byId[entry.id] = entry
      pathById[entry.id] = path
    }
  }
  return resultOk(byId)
}

/**
 * Load one kind of content. Map-scoped kinds take the map; the game config
 * and the vocabulary come back as themselves, everything else keyed by id.
 *
 * @param {{ kind: string, mapId?: string }} input
 * @returns {{ ok: boolean, data: Object|null, error: Object|null }}
 */
export function contentLoad({ kind, mapId }) {
  const source = _SOURCES[kind]
  if (!source) {
    return resultFail({
      code: LOADER_ERROR_CODES.KIND_UNKNOWN,
      message: `No content kind '${kind}'`,
      params: { kind },
    })
  }
  const files = Object.entries(source)
    .filter(([path]) => !_KINDS_BY_MAP.includes(kind) || _mapIdFromPath({ path }) === mapId)
    .map(([path, module]) => ({ path, value: module.default ?? module }))
  if (_KINDS_SINGLE.includes(kind)) {
    if (files.length === 0) {
      return resultFail({
        code: LOADER_ERROR_CODES.FILE_MISSING,
        message: `No ${kind} file`,
        params: { kind },
      })
    }
    return resultOk(files[0].value)
  }
  return contentMerge({ files })
}

/**
 * The map a content path belongs to: /content/maps/kenton/locations/x.json → kenton.
 * @param {{ path: string }} input
 * @returns {string|null}
 */
function _mapIdFromPath({ path }) {
  const match = path.match(/\/content\/maps\/([^/]+)\//)
  return match ? match[1] : null
}
