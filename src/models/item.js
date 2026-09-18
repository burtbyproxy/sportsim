/**
 * Item model — pure JS, no Vue dependencies.
 * Serializable to JSON.
 */

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create an Item from raw JSON data.
 *
 * @param {Object} data - raw item data
 * @returns {import('./types').Item}
 */
export function createItem(data) {
  return {
    id: data.id,
    name: data.name,
    description: data.description ?? '',
    type: data.type ?? 'junk',
    value: data.value ?? 0,
    stackable: data.stackable ?? false,
    quantity: data.quantity ?? 1,
    effects: Array.isArray(data.effects) ? data.effects.map((e) => ({ ...e })) : [],
    doses: Array.isArray(data.doses) ? data.doses.map((d) => ({ ...d })) : [],
    // Mediums a tool can work in, or a surface can take. Empty for everything else.
    mediumIds: Array.isArray(data.mediumIds) ? [...data.mediumIds] : [],
    // How the item reads in a sentence when it turns up: "a shoe. Left. Men's. Wet".
    foundAs: data.foundAs ?? null,
  }
}

/**
 * Return the stat/status changes that would result from using this item.
 * Does NOT mutate the player — that is the engine's responsibility.
 * Pure.
 *
 * @param {import('./types').Item} item
 * @returns {import('./types').ItemEffect[]}
 */
export function applyEffects(item) {
  return item.effects.map((e) => ({ ...e }))
}
