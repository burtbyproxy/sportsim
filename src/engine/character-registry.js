/**
 * Character Registry — indexing and lookup helpers for the simulation engine.
 * Pure functions. No side effects. No Vue. No DOM.
 */

/**
 * Builds an indexed character registry from a raw character array.
 * Groups characters by simulation tier for efficient per-tier processing.
 *
 * @param {Object[]} characterData - array of Character objects
 * @returns {{
 *   byId: Object<string, Object>,
 *   byTier: { fixed: Object[], routine: Object[], full: Object[] },
 *   byLocation: Object<string, Object[]>
 * }}
 */
export function buildCharacterRegistry(characterData) {
  const byId = {}
  const byTier = { fixed: [], routine: [], full: [] }
  const byLocation = {}

  for (const character of characterData) {
    byId[character.id] = character

    const tier = character.simulation || 'fixed'
    if (byTier[tier]) {
      byTier[tier].push(character)
    } else {
      // Unknown tier — treat as fixed
      byTier.fixed.push(character)
    }

    const loc = character.currentLocationId
    if (loc) {
      if (!byLocation[loc]) byLocation[loc] = []
      byLocation[loc].push(character)
    }
  }

  return { byId, byTier, byLocation }
}

/**
 * Returns all characters currently at a given location.
 * Uses the byLocation index — O(1) lookup.
 *
 * @param {Object} registry - result of buildCharacterRegistry
 * @param {string} locationId
 * @returns {Object[]}
 */
export function getCharactersAtLocation(registry, locationId) {
  return registry.byLocation[locationId] || []
}

/**
 * Returns all characters of a given simulation tier.
 *
 * @param {Object} registry - result of buildCharacterRegistry
 * @param {'fixed'|'routine'|'full'} tier
 * @returns {Object[]}
 */
export function getCharactersByTier(registry, tier) {
  return registry.byTier[tier] || []
}

/**
 * Updates the byLocation index after a character moves.
 * Returns a new registry (does not mutate input).
 *
 * @param {Object} registry
 * @param {string} characterId
 * @param {string|null} newLocationId - null = off-map
 * @returns {Object}
 */
export function updateCharacterLocation(registry, characterId, newLocationId) {
  const character = registry.byId[characterId]
  if (!character) return registry

  const oldLocationId = character.currentLocationId

  // Build updated byLocation
  const byLocation = { ...registry.byLocation }

  // Remove from old location
  if (oldLocationId && byLocation[oldLocationId]) {
    byLocation[oldLocationId] = byLocation[oldLocationId].filter((c) => c.id !== characterId)
    if (byLocation[oldLocationId].length === 0) delete byLocation[oldLocationId]
  }

  // Updated character
  const updatedCharacter = { ...character, currentLocationId: newLocationId }

  // Add to new location
  if (newLocationId) {
    byLocation[newLocationId] = [...(byLocation[newLocationId] || []), updatedCharacter]
  }

  return {
    ...registry,
    byId: { ...registry.byId, [characterId]: updatedCharacter },
    byLocation,
  }
}
