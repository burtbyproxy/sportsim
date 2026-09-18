/**
 * Text utilities — templating, variant selection, and NarrativeText construction.
 */

/**
 * Simple {{var}} template replacement.
 * Unknown keys are left as-is.
 * @param {string} str
 * @param {Object<string, *>} vars
 * @returns {string}
 */
export function template(str, vars) {
  return str.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return key in vars ? String(vars[key]) : match
  })
}

/**
 * Given a descriptions object and a context object, pick the best matching variant.
 * Most specific match wins — context keys are checked in order, first match wins.
 * Falls back to "default" if no context key matches.
 *
 * @param {Object<string, string>} variants - e.g. { default: "...", night: "...", drunk: "..." }
 * @param {Object<string, *>} context - e.g. { period: "night", sobriety: 20 }
 *   Special context keys checked (in priority order):
 *     - context keys whose names directly match variant keys (e.g. "drunk", "exhausted")
 *     - "period" value (e.g. "night")
 *     - "repeat" if context.visitCount > 1
 * @returns {string}
 */
export function pickVariant(variants, context = {}) {
  if (!variants) return ''

  // Direct context key match — check each context key to see if it's a variant name
  // Priority: explicit boolean/truthy context flags first
  const directKeys = Object.keys(context).filter((k) => k in variants && context[k])
  if (directKeys.length > 0) {
    return variants[directKeys[0]]
  }

  // Period match (e.g. "night", "morning")
  if (context.period && context.period in variants) {
    return variants[context.period]
  }

  // Repeat visit
  if (context.visitCount > 1 && 'repeat' in variants) {
    return variants.repeat
  }

  // Default
  return variants.default || ''
}

/**
 * Converts a plain string into a NarrativeText object with default token settings.
 * @param {string} str
 * @param {Partial<NarrativeToken>} [style] - token overrides
 * @returns {NarrativeText}
 */
export function toNarrativeText(str, style = {}) {
  return {
    tokens: [
      {
        text: str,
        style: style.style || 'normal',
        color: style.color || null,
        speed: style.speed || 'normal',
        pauseAfter: style.pauseAfter !== undefined ? style.pauseAfter : 0,
        effect: style.effect || 'none',
      },
    ],
  }
}

/**
 * Builds a NarrativeText from an array of token definitions.
 * Each entry can be a string (uses defaults) or a partial NarrativeToken object.
 * @param {Array<string|Partial<NarrativeToken>>} entries
 * @returns {NarrativeText}
 */
export function buildNarrativeText(entries) {
  const tokens = entries.map((entry) => {
    if (typeof entry === 'string') {
      return {
        text: entry,
        style: 'normal',
        color: null,
        speed: 'normal',
        pauseAfter: 0,
        effect: 'none',
      }
    }
    return {
      text: entry.text || '',
      style: entry.style || 'normal',
      color: entry.color || null,
      speed: entry.speed || 'normal',
      pauseAfter: entry.pauseAfter !== undefined ? entry.pauseAfter : 0,
      effect: entry.effect || 'none',
    }
  })
  return { tokens }
}
