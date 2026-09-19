/**
 * Text utilities — templating, variant selection, and NarrativeText construction.
 */

/**
 * Fill {name} placeholders from params: the one placeholder syntax content
 * uses, in voices, descriptions, and the title screen alike. A name with no
 * value (missing, null, undefined) stays as it is, so a gap shows.
 * @param {{ text: string, params: Object<string, *> }} input
 * @returns {string}
 */
export function textFill({ text, params }) {
  let filled = ''
  let from = 0
  for (const match of text.matchAll(/\{(\w+)\}/g)) {
    const value = params[match[1]]
    const shown = value === undefined || value === null ? match[0] : String(value)
    filled += text.slice(from, match.index) + shown
    from = match.index + match[0].length
  }
  return filled + text.slice(from)
}

/**
 * Given a descriptions object and a context object, pick the best matching variant.
 * Most specific match wins — context keys are checked in order, first match wins.
 * Falls back to "default" if no context key matches.
 *
 * @param {{ variants: Object<string, string>, context?: Object<string, *> }} input
 *   variants — e.g. { default: "...", night: "...", drunk: "..." }
 *   context — e.g. { period: "night", sobriety: 20 }
 *   Special context keys checked (in priority order):
 *     - context keys whose names directly match variant keys (e.g. "drunk", "exhausted")
 *     - "period" value (e.g. "night")
 *     - "repeat" if context.visitCount > 1
 * @returns {string}
 */
export function textVariantPick({ variants, context = {} }) {
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
 * Text the narrative log renders: tokens, each with how it looks and how it types.
 * @typedef {Object} NarrativeText
 * @property {Array<{ text: string, style: string, color: string|null, speed: string, pauseAfter: number, effect: string }>} tokens
 */

/**
 * Converts a plain string into a NarrativeText object with default token settings.
 * @param {{ text: string, style?: Partial<NarrativeToken> }} input
 *   style — token overrides
 * @returns {NarrativeText}
 */
export function narrativeTextCreate({ text, style = {} }) {
  return {
    tokens: [
      {
        text,
        style: style.style || 'normal',
        color: style.color || null,
        speed: style.speed || 'normal',
        pauseAfter: style.pauseAfter !== undefined ? style.pauseAfter : 0,
        effect: style.effect || 'none',
      },
    ],
  }
}
