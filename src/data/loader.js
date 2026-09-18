/**
 * Content Loader — the ONLY code that imports from content/.
 *
 * Reads JSON files from content/ using Vite's import.meta.glob.
 * Validates basic structure on load (warns on malformed JSON, does not crash).
 * Returns plain JS objects keyed by ID.
 *
 * Consumers: TitleScreen.vue (game init), simulation worker (characters)
 */

// ---------------------------------------------------------------------------
// Vite glob imports — all content/ JSON files, eagerly loaded
// ---------------------------------------------------------------------------

const _locationFiles = import.meta.glob('/content/maps/*/locations/*.json', { eager: true })
const _actionFiles = import.meta.glob('/content/maps/*/actions/*.json', { eager: true })
const _eventFiles = import.meta.glob('/content/maps/*/events/*.json', { eager: true })
const _characterFiles = import.meta.glob('/content/characters/*.json', { eager: true })
const _itemFiles = import.meta.glob('/content/items/*.json', { eager: true })
const _substanceFiles = import.meta.glob('/content/substances/*.json', { eager: true })
const _conditionFiles = import.meta.glob('/content/conditions/*.json', { eager: true })

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extract the map ID from a path like /content/maps/kenton/locations/foo.json
 * @param {string} path
 * @returns {string}
 */
function _mapIdFromPath(path) {
  const match = path.match(/\/content\/maps\/([^/]+)\//)
  return match ? match[1] : 'unknown'
}

/**
 * Merge an array of JSON module values into a single object keyed by item ID.
 * Warns on entries without an `id` field.
 * @param {Object[]} modules - array of parsed JSON values
 * @param {string} context - for warning messages
 * @returns {Object<string, Object>}
 */
function _mergeById(modules, context) {
  const result = {}
  for (const module of modules) {
    const items = Array.isArray(module) ? module : [module]
    for (const item of items) {
      if (!item || typeof item !== 'object') {
        console.warn(`[loader] ${context}: skipping non-object entry`)
        continue
      }
      if (!item.id) {
        console.warn(`[loader] ${context}: entry missing id field`, item)
        continue
      }
      result[item.id] = item
    }
  }
  return result
}

/**
 * Pull all default exports from a glob result object.
 * Each value is a Vite module with { default: ... }.
 * @param {Object} globResult
 * @returns {Array}
 */
function _extractModules(globResult) {
  return Object.values(globResult).map((m) => m.default ?? m)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load all locations for a given map.
 * @param {string} mapId - e.g. "kenton"
 * @returns {Object<string, import('../../comms/docs/data-contracts.js').Location>}
 */
export function loadLocations(mapId) {
  const relevant = Object.entries(_locationFiles)
    .filter(([path]) => _mapIdFromPath(path) === mapId)
    .map(([, m]) => m.default ?? m)

  return _mergeById(relevant, `loadLocations(${mapId})`)
}

/**
 * Load all actions for a given map.
 * Action files can contain arrays or single objects.
 * @param {string} mapId - e.g. "kenton"
 * @returns {Object<string, import('../../comms/docs/data-contracts.js').Action>}
 */
export function loadActions(mapId) {
  const relevant = Object.entries(_actionFiles)
    .filter(([path]) => _mapIdFromPath(path) === mapId)
    .map(([, m]) => m.default ?? m)

  return _mergeById(relevant, `loadActions(${mapId})`)
}

/**
 * Load all events for a given map.
 * @param {string} mapId - e.g. "kenton"
 * @returns {Object<string, import('../../comms/docs/data-contracts.js').GameEvent>}
 */
export function loadEvents(mapId) {
  const relevant = Object.entries(_eventFiles)
    .filter(([path]) => _mapIdFromPath(path) === mapId)
    .map(([, m]) => m.default ?? m)

  return _mergeById(relevant, `loadEvents(${mapId})`)
}

/**
 * Load all characters (global — not map-scoped).
 * @returns {Object<string, import('../../comms/docs/data-contracts.js').Character>}
 */
export function loadCharacters() {
  const modules = _extractModules(_characterFiles)
  return _mergeById(modules, 'loadCharacters()')
}

/**
 * Load all items (global).
 * @returns {Object<string, import('../../comms/docs/data-contracts.js').Item>}
 */
export function loadItems() {
  const modules = _extractModules(_itemFiles)
  return _mergeById(modules, 'loadItems()')
}

/**
 * Load all substances (global). One file per substance.
 * @returns {Object<string, Object>}
 */
export function loadSubstances() {
  const modules = _extractModules(_substanceFiles)
  return _mergeById(modules, 'loadSubstances()')
}

/**
 * Load all status-driven conditions (global). One file per condition.
 * @returns {Object<string, Object>}
 */
export function loadConditions() {
  const modules = _extractModules(_conditionFiles)
  return _mergeById(modules, 'loadConditions()')
}
