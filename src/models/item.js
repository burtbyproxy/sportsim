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
    effects: Array.isArray(data.effects) ? data.effects.map(e => ({ ...e })) : [],
  };
}

/**
 * Return the stat/status changes that would result from using this item.
 * Does NOT mutate the player — that is the engine's responsibility.
 * Pure.
 *
 * @param {import('./types').Item} item
 * @param {import('./types').Player} _player - reserved for future conditional effects
 * @returns {import('./types').ItemEffect[]}
 */
export function applyEffects(item, _player) {
  return item.effects.map(e => ({ ...e }));
}
