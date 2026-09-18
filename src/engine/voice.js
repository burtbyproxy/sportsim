/**
 * Voice Engine — who is talking.
 *
 * Every persona can own a catalog of lines keyed by message code, like a
 * translation bundle. A line is resolved against the one persona in charge
 * (the blend's dominant persona) and falls back to the sober catalog when
 * that persona has nothing to say for the code. Winner take all: prose is
 * never blended by weight.
 *
 * Catalogs are content (content/voices, one file per persona).
 * Pure functions. No side effects. Single input struct in, result struct out.
 */

import { SOBER_PERSONA_ID } from './blend.js'
import { resultOk, resultFail } from './result.js'

/** Enumerated error codes for every voice result. The code is the contract. */
export const VOICE_ERROR_CODES = Object.freeze({
  CODE_UNKNOWN: 'CODE_UNKNOWN',
  SOBER_MISSING: 'SOBER_MISSING',
})

/**
 * Fill a line's {tokens} from params. A token with no param is left as
 * written, so a missing value shows up in play instead of vanishing.
 * @param {{ text: string, params: Object<string, string> }} input
 * @returns {string}
 */
function _interpolate({ text, params }) {
  return text.replace(/\{(\w+)\}/g, (token, name) =>
    params[name] === undefined || params[name] === null ? token : String(params[name])
  )
}

/**
 * The line for a message code in the voice of the persona in charge, with
 * any {tokens} in it filled from params.
 *
 * @param {{
 *   code: string,
 *   personaId: string,
 *   voices: Object<string, { id: string, lines: Object<string, string> }>,
 *   params?: Object<string, string>,
 * }} input
 * @returns {{ ok: boolean, data: { text: string, personaId: string }|null, error: Object|null }}
 */
export function voiceLine({ code, personaId = SOBER_PERSONA_ID, voices = {}, params = {} }) {
  const sober = voices[SOBER_PERSONA_ID]
  if (!sober) {
    return resultFail({ code: VOICE_ERROR_CODES.SOBER_MISSING, message: 'No sober voice catalog' })
  }
  const own = voices[personaId]?.lines?.[code]
  if (typeof own === 'string') {
    return resultOk({ text: _interpolate({ text: own, params }), personaId })
  }
  const fallback = sober.lines?.[code]
  if (typeof fallback === 'string') {
    return resultOk({ text: _interpolate({ text: fallback, params }), personaId: SOBER_PERSONA_ID })
  }
  return resultFail({ code: VOICE_ERROR_CODES.CODE_UNKNOWN, message: `No line for '${code}'` })
}
