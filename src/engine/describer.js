/**
 * Describer — the words for a piece.
 *
 * With no graphics a piece IS a sentence. The describer assembles it from
 * one fragment per dimension (medium, tool, surface, ingredient) and then
 * says how it came out, all in the voice of the one persona in charge.
 *
 * This is the artist's text: what the person who made it sees. What anybody
 * else sees is written once, elsewhere, when the piece is shown.
 *
 * The contract is the input and output structs below. This provider fills
 * them from the voice catalogs, so the game is whole without a model;
 * another provider can sit behind the same contract later.
 *
 * Pure functions. No side effects. Single input struct in, result struct out.
 */

import { voiceLine } from './voice.js'
import { MAKING_TIERS } from './making.js'

/** Enumerated error codes for every describer result. The code is the contract. */
export const DESCRIBER_ERROR_CODES = Object.freeze({
  TIER_UNKNOWN: 'TIER_UNKNOWN',
  PART_MISSING: 'PART_MISSING',
  LINE_MISSING: 'LINE_MISSING',
})

function _fail(code, message) {
  return { ok: false, data: null, error: { code, message } }
}

/**
 * Describe a piece as its maker sees it.
 *
 * Every part reads in a sentence through its `pieceAs` phrase: a medium is
 * "a painting", a tool "watercolour", an ingredient "Brut", and a surface
 * brings its own preposition, "on a cabinet door".
 *
 * @param {{
 *   tier: string,
 *   medium: { pieceAs: string },
 *   tool: { pieceAs: string }|null,
 *   surface: { pieceAs: string },
 *   ingredient: { pieceAs: string }|null,
 *   personaId: string,
 *   voices: Object<string, Object>,
 * }} input
 * @returns {{ ok: boolean, data: { workText: string, artistText: string, personaId: string }|null, error: Object|null }}
 *   workText — the piece as a noun phrase; artistText — the full line.
 */
export function pieceDescribe({
  tier,
  medium,
  tool = null,
  surface,
  ingredient = null,
  personaId,
  voices,
}) {
  if (!Object.values(MAKING_TIERS).includes(tier)) {
    return _fail(DESCRIBER_ERROR_CODES.TIER_UNKNOWN, `Unknown tier '${tier}'`)
  }
  const parts = {
    medium,
    surface,
    ...(tool ? { tool } : {}),
    ...(ingredient ? { ingredient } : {}),
  }
  for (const [name, part] of Object.entries(parts)) {
    if (typeof part?.pieceAs !== 'string' || part.pieceAs.length === 0) {
      return _fail(DESCRIBER_ERROR_CODES.PART_MISSING, `The ${name} has no pieceAs phrase`)
    }
  }

  if (ingredient && !tool) {
    return _fail(DESCRIBER_ERROR_CODES.PART_MISSING, 'An ingredient needs a tool to work it in')
  }

  let workCode = 'piece.work.bare'
  if (tool) workCode = ingredient ? 'piece.work.ingredient' : 'piece.work'
  const params = Object.fromEntries(Object.entries(parts).map(([k, part]) => [k, part.pieceAs]))

  const work = voiceLine({ code: workCode, personaId, voices, params })
  if (!work.ok) return _fail(DESCRIBER_ERROR_CODES.LINE_MISSING, work.error.message)

  const artist = voiceLine({
    code: `piece.artist.${tier}`,
    personaId,
    voices,
    params: { ...params, work: work.data.text },
  })
  if (!artist.ok) return _fail(DESCRIBER_ERROR_CODES.LINE_MISSING, artist.error.message)

  return {
    ok: true,
    data: {
      workText: work.data.text,
      artistText: artist.data.text,
      personaId: artist.data.personaId,
    },
    error: null,
  }
}
