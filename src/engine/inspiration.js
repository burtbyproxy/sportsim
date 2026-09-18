/**
 * Inspiration Engine — the clock.
 *
 * Something in the world hits the player and an inspiration record is
 * struck: a source, a medium it wants, a strength, a countdown in ticks, and
 * a snapshot of the blend at the moment it struck. Whoever you were when the
 * idea came owns the idea. There is one active inspiration at a time; a new
 * one replaces the old, an event or an action can interrupt it, the clock
 * can run it out, and making something spends it.
 *
 * Records are never deleted. Each carries a status and the tick it last
 * changed, so the log of lost ideas is part of the player.
 *
 * Pure functions. No side effects. No Vue. No DOM. Single input struct in,
 * result struct out; every function returns the player's new list of
 * inspirations rather than mutating.
 */

import { v4 as uuidv4 } from 'uuid'
import { blendSober } from './blend.js'

/** Enumerated error codes for every inspiration result. The code is the contract. */
export const INSPIRATION_ERROR_CODES = Object.freeze({
  PLAYER_MISSING: 'PLAYER_MISSING',
  SOURCE_INVALID: 'SOURCE_INVALID',
  STRENGTH_INVALID: 'STRENGTH_INVALID',
  TICKS_INVALID: 'TICKS_INVALID',
  NONE_ACTIVE: 'NONE_ACTIVE',
})

/** Every state an inspiration record can be in. */
export const INSPIRATION_STATUSES = Object.freeze({
  ACTIVE: 'active',
  EXPIRED: 'expired',
  INTERRUPTED: 'interrupted',
  REPLACED: 'replaced',
  SPENT: 'spent',
})

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _ok(data) {
  return { ok: true, data, error: null }
}

function _fail(code, message) {
  return { ok: false, data: null, error: { code, message } }
}

function _playerCheck(player, fn) {
  if (!player || typeof player !== 'object') {
    return _fail(INSPIRATION_ERROR_CODES.PLAYER_MISSING, `${fn} needs a player`)
  }
  return null
}

function _copies(player) {
  return (player.inspirations ?? []).map((record) => ({
    ...record,
    personaSnapshot: JSON.parse(JSON.stringify(record.personaSnapshot)),
    endedBy: record.endedBy ? { ...record.endedBy } : null,
  }))
}

function _sourceValid(source) {
  return (
    source &&
    typeof source === 'object' &&
    typeof source.kind === 'string' &&
    source.kind.length > 0 &&
    typeof source.id === 'string' &&
    source.id.length > 0
  )
}

/**
 * Close the active record with a status and what did it. Mutates the copy
 * it is handed. Returns the closed record or null.
 */
function _activeClose({ inspirations, status, endedBy, tick }) {
  const active = inspirations.find((r) => r.status === INSPIRATION_STATUSES.ACTIVE)
  if (!active) return null
  active.status = status
  active.endedBy = endedBy ? { ...endedBy } : null
  active.updatedAtTick = tick
  return active
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * The inspiration currently moving the player, or null. A copy.
 * @param {{ player: Object }} input
 * @returns {Object|null}
 */
export function inspirationActive({ player }) {
  const active = player?.inspirations?.find((r) => r.status === INSPIRATION_STATUSES.ACTIVE)
  return active ? _copies(player).find((r) => r.id === active.id) : null
}

/**
 * The world strikes. A new active record is created carrying a snapshot of
 * the player's blend, and any inspiration already active is marked replaced
 * by the new one. Distraction is inspiration with worse timing.
 *
 * @param {{
 *   player: Object,
 *   source: { kind: string, id: string },
 *   mediumId: string|null,
 *   strength: number,
 *   ticksTotal: number,
 *   gameTime: { tick: number },
 *   locationId: string|null,
 * }} input
 * @returns {{ ok: boolean, data: { inspirations: Object[], struck: Object, replaced: Object|null }|null, error: Object|null }}
 */
export function inspirationStrike({
  player,
  source,
  mediumId = null,
  strength,
  ticksTotal,
  gameTime,
  locationId = null,
}) {
  const bad = _playerCheck(player, 'inspirationStrike')
  if (bad) return bad
  if (!_sourceValid(source)) {
    return _fail(INSPIRATION_ERROR_CODES.SOURCE_INVALID, 'source needs a kind and an id')
  }
  if (!Number.isFinite(strength) || strength < 1 || strength > 100) {
    return _fail(
      INSPIRATION_ERROR_CODES.STRENGTH_INVALID,
      `strength must be 1–100, got ${strength}`
    )
  }
  if (!Number.isInteger(ticksTotal) || ticksTotal < 1) {
    return _fail(
      INSPIRATION_ERROR_CODES.TICKS_INVALID,
      `ticksTotal must be >= 1, got ${ticksTotal}`
    )
  }

  const tick = gameTime?.tick ?? 0
  const inspirations = _copies(player)
  const replaced = _activeClose({
    inspirations,
    status: INSPIRATION_STATUSES.REPLACED,
    endedBy: { kind: source.kind, id: source.id },
    tick,
  })
  const blend = player.blend ?? blendSober()
  const struck = {
    id: uuidv4(),
    status: INSPIRATION_STATUSES.ACTIVE,
    sourceKind: source.kind,
    sourceId: source.id,
    mediumId,
    strength,
    ticksTotal,
    ticksRemaining: ticksTotal,
    struckAtTick: tick,
    struckAtLocationId: locationId,
    personaSnapshot: JSON.parse(JSON.stringify(blend)),
    dominantPersonaId: blend.dominantPersonaId,
    endedBy: null,
    updatedAtTick: tick,
  }
  inspirations.push(struck)

  return _ok({ inspirations, struck: { ...struck }, replaced: replaced ? { ...replaced } : null })
}

/**
 * Time passes. The active inspiration's clock runs down, and at zero it has
 * expired.
 *
 * @param {{ player: Object, ticksElapsed: number, gameTime: { tick: number } }} input
 * @returns {{ ok: boolean, data: { inspirations: Object[], expired: Object|null }|null, error: Object|null }}
 */
export function inspirationTick({ player, ticksElapsed, gameTime }) {
  const bad = _playerCheck(player, 'inspirationTick')
  if (bad) return bad
  if (!Number.isFinite(ticksElapsed) || ticksElapsed < 0) {
    return _fail(
      INSPIRATION_ERROR_CODES.TICKS_INVALID,
      `ticksElapsed must be >= 0, got ${ticksElapsed}`
    )
  }

  const inspirations = _copies(player)
  const active = inspirations.find((r) => r.status === INSPIRATION_STATUSES.ACTIVE)
  if (!active || ticksElapsed === 0) return _ok({ inspirations, expired: null })

  const tick = gameTime?.tick ?? active.updatedAtTick
  active.ticksRemaining = Math.max(0, active.ticksRemaining - ticksElapsed)
  active.updatedAtTick = tick
  if (active.ticksRemaining > 0) return _ok({ inspirations, expired: null })

  active.status = INSPIRATION_STATUSES.EXPIRED
  active.endedBy = { kind: 'clock', id: 'clock' }
  return _ok({ inspirations, expired: { ...active } })
}

/**
 * Something got in the way. The active inspiration, if any, is marked
 * interrupted by it. Interrupting nothing is not an error; the world barges
 * in constantly.
 *
 * @param {{ player: Object, reason: { kind: string, id: string }, gameTime: { tick: number } }} input
 * @returns {{ ok: boolean, data: { inspirations: Object[], interrupted: Object|null }|null, error: Object|null }}
 */
export function inspirationInterrupt({ player, reason, gameTime }) {
  const bad = _playerCheck(player, 'inspirationInterrupt')
  if (bad) return bad
  if (!_sourceValid(reason)) {
    return _fail(INSPIRATION_ERROR_CODES.SOURCE_INVALID, 'reason needs a kind and an id')
  }
  const inspirations = _copies(player)
  const interrupted = _activeClose({
    inspirations,
    status: INSPIRATION_STATUSES.INTERRUPTED,
    endedBy: reason,
    tick: gameTime?.tick ?? 0,
  })
  return _ok({ inspirations, interrupted: interrupted ? { ...interrupted } : null })
}

/**
 * The inspiration was used to make something. Spending nothing is an
 * error: a maker without a muse is a caller bug.
 *
 * @param {{ player: Object, spentOn: { kind: string, id: string }, gameTime: { tick: number } }} input
 * @returns {{ ok: boolean, data: { inspirations: Object[], spent: Object }|null, error: Object|null }}
 */
export function inspirationSpend({ player, spentOn, gameTime }) {
  const bad = _playerCheck(player, 'inspirationSpend')
  if (bad) return bad
  if (!_sourceValid(spentOn)) {
    return _fail(INSPIRATION_ERROR_CODES.SOURCE_INVALID, 'spentOn needs a kind and an id')
  }
  const inspirations = _copies(player)
  const spent = _activeClose({
    inspirations,
    status: INSPIRATION_STATUSES.SPENT,
    endedBy: spentOn,
    tick: gameTime?.tick ?? 0,
  })
  if (!spent) {
    return _fail(INSPIRATION_ERROR_CODES.NONE_ACTIVE, 'Nothing is moving the player')
  }
  return _ok({ inspirations, spent: { ...spent } })
}
