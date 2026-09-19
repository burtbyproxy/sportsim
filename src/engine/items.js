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

import { itemEffectsCopy } from '../models/item.js'
import { STATUS_IDS_WRITABLE_DEFAULT } from '../models/defaults.js'
import { resultOk, resultFail } from './result.js'

/** Enumerated error codes for every items result. The code is the contract. */
/**
 * Whether an inventory holds at least one of an item.
 *
 * @param {{ inventory: Object[], itemId: string }} input
 * @returns {boolean}
 */
export function inventoryHas({ inventory, itemId }) {
  return (inventory ?? []).some((i) => i.id === itemId && i.quantity > 0)
}

/**
 * Whether an item is something the player uses up by using it.
 * @param {{ item: Object }} input
 * @returns {boolean}
 */
export function itemUsable({ item }) {
  return item?.type === 'consumable'
}

export const ITEM_ERROR_CODES = Object.freeze({
  PLAYER_MISSING: 'PLAYER_MISSING',
  ITEM_MISSING: 'ITEM_MISSING',
  ITEM_NOT_CONSUMABLE: 'ITEM_NOT_CONSUMABLE',
  EFFECT_TARGET_UNKNOWN: 'EFFECT_TARGET_UNKNOWN',
})

/** Statuses an effect may change directly. Sobriety is derived; money has its own door. */
export const ITEM_EFFECT_STATUSES = STATUS_IDS_WRITABLE_DEFAULT

/**
 * Work out what using one of an item does.
 *
 * @param {{ player: Object, itemId: string, statusIds?: string[] }} input
 *   statusIds — the vitals an effect may change directly (content/vocabulary.json, writable ones)
 * @returns {{ ok: boolean, data: {
 *   item: Object,
 *   statusChanges: Object<string, number>,
 *   statModifiers: { statName: string, modifier: { source: string, value: number, duration: number|null } }[],
 *   doses: Object[],
 * }|null, error: Object|null }}
 */
export function itemUseResolve({ player, itemId, statusIds = ITEM_EFFECT_STATUSES }) {
  if (!player || typeof player !== 'object') {
    return resultFail({
      code: ITEM_ERROR_CODES.PLAYER_MISSING,
      message: 'itemUseResolve needs a player',
    })
  }
  const item = (player.inventory ?? []).find((i) => i.id === itemId)
  if (!inventoryHas({ inventory: player.inventory, itemId })) {
    return resultFail({ code: ITEM_ERROR_CODES.ITEM_MISSING, message: `Not carrying '${itemId}'` })
  }
  if (!itemUsable({ item })) {
    return resultFail({
      code: ITEM_ERROR_CODES.ITEM_NOT_CONSUMABLE,
      message: `'${itemId}' is not something you use up`,
    })
  }

  const statusChanges = {}
  const statModifiers = []
  for (const effect of itemEffectsCopy({ item })) {
    if (statusIds.includes(effect.target)) {
      statusChanges[effect.target] = (statusChanges[effect.target] ?? 0) + effect.value
    } else if (player.stats?.[effect.target]) {
      statModifiers.push({
        statName: effect.target,
        modifier: { source: item.id, value: effect.value, duration: effect.duration ?? null },
      })
    } else {
      return resultFail({
        code: ITEM_ERROR_CODES.EFFECT_TARGET_UNKNOWN,
        message: `'${itemId}' has an effect on '${effect.target}', which is neither a status nor a stat`,
      })
    }
  }

  return resultOk({
    item: { ...item },
    statusChanges,
    statModifiers,
    doses: (item.doses ?? []).map((d) => ({ ...d })),
  })
}
