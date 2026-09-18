/**
 * Scavenge Engine — the city is littered with shit, and some of it is yours.
 *
 * Every location names a loot table (content/scavenge). Looking around is a
 * check on the table's stat, itemized like every other check. A success
 * draws one entry by weight; a critical success draws from the rare entries
 * when the table has any. Finds deplete the spot, a depleted spot is harder
 * to work, and the city restocks itself over time because the littering
 * never stops. An entry marked unique is found once and never again.
 *
 * Pure functions. No side effects. No Vue. No DOM. Single input struct in,
 * result struct out. The location's new scavenge state is returned, not
 * written.
 */

import { rollCheck } from './dice.js'
import { weightedPick } from '../utils/random.js'
import { resultOk, resultFail } from './result.js'

/** Enumerated error codes for every scavenge result. The code is the contract. */
export const SCAVENGE_ERROR_CODES = Object.freeze({
  PLAYER_MISSING: 'PLAYER_MISSING',
  LOCATION_MISSING: 'LOCATION_MISSING',
  TABLE_UNKNOWN: 'TABLE_UNKNOWN',
  ITEM_UNKNOWN: 'ITEM_UNKNOWN',
})

/** A spot can only be picked so clean. */
export const SCAVENGE_DEPLETION_MAX = 5

/** Ticks for one level of depletion to restock: half a game day. */
export const SCAVENGE_TICKS_PER_RESTOCK = 48

/** Each level of depletion costs this much on the check. */
export const SCAVENGE_DEPLETION_PENALTY = 2

/** At or past this depletion, a failed search reads as picked clean. */
export const SCAVENGE_PICKED_CLEAN_AT = 3

/** The counter that remembers a unique find. */
export function scavengedCounterName({ itemId }) {
  return `scavenged_${itemId}`
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * How picked-over a location is right now. Depletion restocks lazily: one
 * level per SCAVENGE_TICKS_PER_RESTOCK since it was last worked.
 *
 * @param {{ location: Object, gameTime: { tick: number } }} input
 * @returns {number} 0–SCAVENGE_DEPLETION_MAX
 */
export function scavengeDepletion({ location, gameTime }) {
  const state = location?.scavenge
  if (!state || !state.depletion) return 0
  const elapsed = Math.max(0, (gameTime?.tick ?? 0) - (state.updatedAtTick ?? 0))
  const restocked = Math.floor(elapsed / SCAVENGE_TICKS_PER_RESTOCK)
  return Math.max(0, Math.min(SCAVENGE_DEPLETION_MAX, state.depletion - restocked))
}

/**
 * Look around. Returns what was found (or nothing), the itemized check, and
 * the location's new scavenge state for the caller to store.
 *
 * @param {{
 *   player: Object,
 *   location: Object,
 *   tables: Object<string, Object>,
 *   items: Object<string, Object>,
 *   gameTime: { tick: number },
 *   rng?: () => number,
 * }} input
 * @returns {{ ok: boolean, data: {
 *   itemId: string|null,
 *   entry: Object|null,
 *   check: Object,
 *   depletionBefore: number,
 *   pickedClean: boolean,
 *   scavenge: { depletion: number, updatedAtTick: number },
 * }|null, error: Object|null }}
 */
export function scavengeSearch({
  player,
  location,
  tables = {},
  items = {},
  gameTime,
  rng = Math.random,
}) {
  if (!player || typeof player !== 'object') {
    return resultFail({
      code: SCAVENGE_ERROR_CODES.PLAYER_MISSING,
      message: 'scavengeSearch needs a player',
    })
  }
  if (!location || typeof location !== 'object') {
    return resultFail({
      code: SCAVENGE_ERROR_CODES.LOCATION_MISSING,
      message: 'scavengeSearch needs a location',
    })
  }
  const table = tables[location.scavengeTableId]
  if (!table) {
    return resultFail({
      code: SCAVENGE_ERROR_CODES.TABLE_UNKNOWN,
      message: `Location '${location.id}' names no known scavenge table ('${location.scavengeTableId}')`,
    })
  }
  const unknown = table.entries.find((entry) => !items[entry.itemId])
  if (unknown) {
    return resultFail({
      code: SCAVENGE_ERROR_CODES.ITEM_UNKNOWN,
      message: `Unknown item '${unknown.itemId}'`,
    })
  }

  const tick = gameTime?.tick ?? 0
  const depletionBefore = scavengeDepletion({ location, gameTime })
  const situational = depletionBefore > 0 ? [-depletionBefore * SCAVENGE_DEPLETION_PENALTY] : []
  const check = rollCheck(player, table.stat, situational, table.dc, rng)

  let entry = null
  if (check.success) {
    const candidates = table.entries.filter(
      (e) => !(e.unique && (player.counters?.[scavengedCounterName({ itemId: e.itemId })] ?? 0) > 0)
    )
    const rare = candidates.filter((e) => e.rare)
    const pool = check.criticalSuccess && rare.length > 0 ? rare : candidates
    entry = weightedPick(pool, (e) => e.weight, rng)
  }

  // A find works the spot over and restarts its restock clock. Coming up
  // empty changes nothing: the stored state keeps restocking on its own.
  const scavenge = entry
    ? { depletion: Math.min(SCAVENGE_DEPLETION_MAX, depletionBefore + 1), updatedAtTick: tick }
    : {
        depletion: location.scavenge?.depletion ?? 0,
        updatedAtTick: location.scavenge?.updatedAtTick ?? tick,
      }

  return resultOk({
    itemId: entry ? entry.itemId : null,
    entry: entry ? { ...entry } : null,
    check,
    depletionBefore,
    pickedClean: !entry && depletionBefore >= SCAVENGE_PICKED_CLEAN_AT,
    scavenge,
  })
}
