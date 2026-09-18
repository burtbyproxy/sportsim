/**
 * Items Engine — using what you carry.
 *
 * A consumable's effects land on a status (hunger, energy, mood, health) or,
 * when they name a stat, become a temporary modifier on that stat for the
 * effect's duration. Its doses go to the blend. One is used up.
 *
 * Pure. Single input struct in, result struct out. Returns what should
 * change; the store applies it.
 */

import { applyEffects } from '../models/item.js'

/** Enumerated error codes for every items result. The code is the contract. */
export const ITEM_ERROR_CODES = Object.freeze({
  PLAYER_MISSING: 'PLAYER_MISSING',
  ITEM_MISSING: 'ITEM_MISSING',
  ITEM_NOT_CONSUMABLE: 'ITEM_NOT_CONSUMABLE',
  EFFECT_TARGET_UNKNOWN: 'EFFECT_TARGET_UNKNOWN',
})

/** Statuses an effect may change directly. Sobriety is derived; money has its own door. */
export const ITEM_EFFECT_STATUSES = Object.freeze(['hunger', 'energy', 'mood', 'health'])

function _fail(code, message) {
  return { ok: false, data: null, error: { code, message } }
}

/**
 * Work out what using one of an item does.
 *
 * @param {{ player: Object, itemId: string }} input
 * @returns {{ ok: boolean, data: {
 *   item: Object,
 *   statusChanges: Object<string, number>,
 *   statModifiers: { statName: string, modifier: { source: string, value: number, duration: number|null } }[],
 *   doses: Object[],
 * }|null, error: Object|null }}
 */
export function itemUseResolve({ player, itemId }) {
  if (!player || typeof player !== 'object') {
    return _fail(ITEM_ERROR_CODES.PLAYER_MISSING, 'itemUseResolve needs a player')
  }
  const item = (player.inventory ?? []).find((i) => i.id === itemId && (i.quantity ?? 1) > 0)
  if (!item) {
    return _fail(ITEM_ERROR_CODES.ITEM_MISSING, `Not carrying '${itemId}'`)
  }
  if (item.type !== 'consumable') {
    return _fail(ITEM_ERROR_CODES.ITEM_NOT_CONSUMABLE, `'${itemId}' is not something you use up`)
  }

  const statusChanges = {}
  const statModifiers = []
  for (const effect of applyEffects(item)) {
    if (ITEM_EFFECT_STATUSES.includes(effect.target)) {
      statusChanges[effect.target] = (statusChanges[effect.target] ?? 0) + effect.value
    } else if (player.stats?.[effect.target]) {
      statModifiers.push({
        statName: effect.target,
        modifier: { source: item.id, value: effect.value, duration: effect.duration ?? null },
      })
    } else {
      return _fail(
        ITEM_ERROR_CODES.EFFECT_TARGET_UNKNOWN,
        `'${itemId}' has an effect on '${effect.target}', which is neither a status nor a stat`
      )
    }
  }

  return {
    ok: true,
    data: {
      item: { ...item },
      statusChanges,
      statModifiers,
      doses: (item.doses ?? []).map((d) => ({ ...d })),
    },
    error: null,
  }
}
