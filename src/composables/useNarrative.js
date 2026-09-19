import { ref, readonly } from 'vue'
import { blendSober, PERSONA_SOURCES } from '../engine/blend.js'
import { inspirationActive } from '../engine/inspiration.js'
import { textFill, textVariantPick, narrativeTextCreate } from '../utils/text.js'
import { randomInt } from '../utils/random.js'

/**
 * Narrative Renderer composable.
 *
 * Accepts NarrativeText objects (arrays of NarrativeToken), renders them
 * character-by-character with variable speed, pauses, and effects.
 * Multiple texts can be queued and are rendered sequentially.
 *
 * @emits 'animation-start' - when a new NarrativeText begins rendering
 * @emits 'animation-complete' - when a NarrativeText finishes
 * @emits 'skip' - when user skips animation
 */

/**
 * A speed tier's per-character delay range in ms (content/tuning.json
 * `narrative.speedsMs`); an unknown tier reads as normal.
 * @param {{ speed: string, tuning: Object }} input
 * @returns {{ min: number, max: number }}
 */
function speedRange({ speed, tuning }) {
  const speeds = tuning.narrative.speedsMs
  return speeds[speed] ?? speeds.normal
}

/**
 * The extra pause after a punctuation character, or null for any other.
 * @param {{ char: string, tuning: Object }} input
 * @returns {{ min: number, max: number }|null}
 */
function punctuationPause({ char, tuning }) {
  return tuning.narrative.punctuationPauseMs.find((pause) => pause.char === char) ?? null
}

/**
 * Mean milliseconds the renderer spends on one character of `text` at `speed`,
 * base delay plus punctuation pauses. Pure — used to prove the throughput contract.
 * @param {{ text: string, speed: string, tuning: Object }} input
 * @returns {number}
 */
export function meanCharDelayMs({ text, speed, tuning }) {
  const setting = speedRange({ speed, tuning })
  if (setting.max === 0 || text.length === 0) return 0
  const baseMean = (setting.min + setting.max) / 2
  let total = 0
  for (const char of text) {
    const extra = punctuationPause({ char, tuning })
    total += baseMean + (extra ? (extra.min + extra.max) / 2 : 0)
  }
  return total / text.length
}

/**
 * A base character delay in ms for a speed tier, picked within its range.
 * @param {{ speed: string, tuning: Object }} input
 * @returns {number}
 */
function resolveSpeedMs({ speed, tuning }) {
  const setting = speedRange({ speed, tuning })
  return randomInt({ min: setting.min, max: setting.max })
}

/**
 * The total delay for rendering a character at a given speed: the base
 * delay plus any punctuation pause after it.
 * @param {{ char: string, speed: string, tuning: Object }} input
 *   char — the character just typed; speed — the tier name
 * @returns {number} ms to wait before rendering the next character
 */
function charDelay({ char, speed, tuning }) {
  const base = resolveSpeedMs({ speed, tuning })
  const extra = punctuationPause({ char, tuning })
  if (!extra) return base
  return base + randomInt({ min: extra.min, max: extra.max })
}

/**
 * The typewriter: a queue of narrative text rendered a character at a time.
 * @param {{ tuning: Object }} input - the game's numbers; speeds and pauses come from it
 */
export function useNarrative({ tuning }) {
  /** Rendered log entries — each is a rendered NarrativeText */
  const log = ref([])

  /** Queue of NarrativeText objects pending render */
  const queue = ref([])

  /** Whether animation is currently running */
  const isAnimating = ref(false)

  /** Whether we should skip the current animation */
  let skipRequested = false

  /**
   * Bumped by clearLog. A render that started under an older generation
   * is discarded when it finishes instead of landing in the fresh log.
   */
  let renderGeneration = 0

  /** Event callbacks */
  const listeners = { 'animation-start': [], 'animation-complete': [], skip: [] }

  function emit({ event, data }) {
    for (const cb of listeners[event] ?? []) cb(data)
  }

  function on({ event, handler }) {
    listeners[event] = listeners[event] ?? []
    listeners[event].push(handler)
  }

  function off({ event, handler }) {
    listeners[event] = (listeners[event] ?? []).filter((c) => c !== handler)
  }

  /**
   * Queue a NarrativeText for rendering.
   * @param {import('../utils/text.js').NarrativeText} narrativeText
   */
  function enqueue(narrativeText) {
    queue.value.push(narrativeText)
    if (!isAnimating.value) {
      processQueue()
    }
  }

  /**
   * Skip current animation — show all queued text instantly.
   */
  function skip() {
    skipRequested = true
    emit({ event: 'skip' })
  }

  /**
   * Clear the log (new game / location transition).
   * Drops everything still queued and aborts the animation in flight so the
   * old scene's prose never keeps typing under the new scene's header.
   */
  function clearLog() {
    log.value = []
    queue.value = []
    renderGeneration++
    skipRequested = true
    activeEntryState.value = null
    tokenProgress.value = ''
  }

  /**
   * Internal: process the queue, one entry at a time.
   */
  async function processQueue() {
    if (queue.value.length === 0) {
      isAnimating.value = false
      return
    }

    isAnimating.value = true
    const narrativeText = queue.value.shift()
    skipRequested = false
    const generation = renderGeneration

    emit({ event: 'animation-start', data: narrativeText })

    const entry = await renderNarrativeText(narrativeText)

    // clearLog ran while this was rendering — the entry belongs to a dead scene
    if (generation !== renderGeneration) {
      processQueue()
      return
    }

    log.value.push(entry)

    emit({ event: 'animation-complete', data: entry })

    // Process next in queue
    processQueue()
  }

  /**
   * Render a NarrativeText into a log entry.
   * Returns a plain object safe to store in log.
   * Updates activeEntryState in real-time so components can show live progress.
   */
  async function renderNarrativeText(narrativeText) {
    const renderedTokens = []

    // Initialize live entry state
    activeEntryState.value = { completedTokens: [], currentToken: null }

    for (const token of narrativeText.tokens) {
      if (skipRequested) {
        // Instant-complete this token
        renderedTokens.push({ ...token, rendered: token.text })
        activeEntryState.value = {
          completedTokens: [...renderedTokens],
          currentToken: null,
        }
        continue
      }

      // Signal that this token is now being animated
      activeEntryState.value = {
        completedTokens: [...renderedTokens],
        currentToken: token,
      }

      const rendered = await animateToken(token)
      renderedTokens.push({ ...token, rendered })

      // Token done — update completed list
      activeEntryState.value = {
        completedTokens: [...renderedTokens],
        currentToken: null,
      }

      if (!skipRequested && token.pauseAfter > 0) {
        await pauseWait(token.pauseAfter)
      }
    }

    // Clear live state — entry is about to go into log
    activeEntryState.value = null

    return { tokens: renderedTokens, id: Date.now() + Math.random() }
  }

  /**
   * Animate a single token character by character.
   * Returns the full text when done.
   *
   * Uses recursive setTimeout so each character gets its own freshly-calculated
   * delay — base speed randomised within the tier's range, plus punctuation and
   * word-boundary pauses stacked on top.  Feels like a human typing at 2am.
   */
  function animateToken(token) {
    return new Promise((resolve) => {
      const speed = token.speed ?? 'normal'
      const text = token.text

      // instant speed or skip — resolve immediately
      if (speedRange({ speed, tuning }).max === 0 || skipRequested) {
        resolve(text)
        return
      }

      let i = 0

      function tick() {
        if (skipRequested) {
          resolve(text)
          return
        }

        i++
        // Emit partial render via a reactive ref the component can watch
        tokenProgress.value = text.slice(0, i)

        if (i >= text.length) {
          resolve(text)
          return
        }

        // Delay for the NEXT character is based on the character we just typed
        // — punctuation after a full-stop breathes longer than a mid-word letter
        const delay = charDelay({ char: text[i - 1], speed, tuning })
        setTimeout(tick, delay)
      }

      // Kick off with the delay for the very first character
      setTimeout(tick, resolveSpeedMs({ speed, tuning }))
    })
  }

  function pauseWait(ms) {
    return new Promise((resolve) => {
      if (skipRequested) {
        resolve()
        return
      }
      // Whichever ends the pause — time or a skip — takes the other timer with it.
      let watcher = null
      const timeout = setTimeout(() => {
        clearInterval(watcher)
        resolve()
      }, ms)
      watcher = setInterval(() => {
        if (!skipRequested) return
        clearTimeout(timeout)
        clearInterval(watcher)
        resolve()
      }, 16)
    })
  }

  /**
   * Reactive ref holding in-progress token text (for live display).
   * The NarrativeLog component reads this to show characters as they appear.
   */
  const tokenProgress = ref('')

  /**
   * Live-updated active entry state for the currently animating NarrativeText.
   * Components can bind to this to show text as it renders character-by-character.
   * Shape: { completedTokens: NarrativeToken[], currentToken: NarrativeToken|null }
   */
  const activeEntryState = ref(null)

  return {
    log: readonly(log),
    queue: readonly(queue),
    isAnimating: readonly(isAnimating),
    currentTokenProgress: readonly(tokenProgress),
    activeEntryState: readonly(activeEntryState),
    enqueue,
    skip,
    clearLog,
    on,
    off,
  }
}

/**
 * Keyboard bindings that let the player skip the running animation from
 * anywhere on the screen. Feed the result to useKeyboard.
 * Space only acts while text is animating, so it never eats a keypress
 * the rest of the screen might want.
 * @param {{ narrative: ReturnType<typeof useNarrative> }} input
 * @returns {Array<{ key: string, handler: (e: KeyboardEvent) => void }>}
 */
export function narrativeSkipBindings({ narrative }) {
  return [
    {
      key: ' ',
      handler: (e) => {
        if (!narrative.isAnimating.value) return
        e.preventDefault()
        narrative.skip()
      },
    },
  ]
}

// ---------------------------------------------------------------------------
// Text Generation — pure functions, no Vue, no DOM
// ---------------------------------------------------------------------------

/**
 * Applies insanity perception filters to a description string.
 * perceptionFilter shape: { substitutions: [[from, to], ...], prefix: string, suffix: string }
 * @param {string} text
 * @param {Object[]} insanities
 * @returns {string}
 */
function perceptionFiltersApply({ text, insanities }) {
  if (!insanities || insanities.length === 0) return text
  let result = text
  for (const insanity of insanities) {
    const filter = insanity.perceptionFilter
    if (!filter) continue
    if (filter.substitutions) {
      for (const [from, to] of filter.substitutions) {
        result = result.replaceAll(from, to)
      }
    }
    if (filter.prefix) result = filter.prefix + ' ' + result
    if (filter.suffix) result = result + ' ' + filter.suffix
  }
  return result
}

/**
 * Builds the context object for variant selection.
 * @param {Object} player
 * @param {Object} gameTime
 * @param {Object} location
 * @returns {Object}
 */
function narrativeContextBuild({ player, gameTime, location, tuning }) {
  const sobriety = player.status?.sobriety ?? 100
  const blend = player.blend ?? blendSober()
  // Every persona acting on the player is a flag, so content can key a
  // variant on "telepath" or "priest" the way it keys one on "drunk"; every
  // condition in the blend is one too, by its id ("exhausted", "starving"),
  // so a description agrees with the condition about when it applies.
  const personaFlags = Object.fromEntries(blend.weights.map((w) => [w.personaId, true]))
  const conditionFlags = Object.fromEntries(
    blend.weights
      .filter((w) => w.source === PERSONA_SOURCES.condition)
      .map((w) => [w.sourceId, true])
  )
  return {
    period: gameTime?.period ?? 'morning',
    visitCount: location?.visitCount ?? 0,
    drunk: sobriety < tuning.narrative.drunkBelowSobriety,
    ...conditionFlags,
    ...personaFlags,
    personaId: blend.dominantPersonaId,
    inspired: Boolean(inspirationActive({ player })),
  }
}

/**
 * Generates the narrative description for a location.
 * Picks the best variant, applies perception filters, templates in variables.
 *
 * @param {{ location: Object, player: Object, gameTime: Object, tuning: Object }} input
 *   location — Location per data contract
 * @returns {NarrativeText}
 */
export function narrativeLocation({ location, player, gameTime, tuning }) {
  const context = narrativeContextBuild({ player, gameTime, location, tuning })
  let text = textVariantPick({ variants: location.descriptions || {}, context })
  text = textFill({
    text,
    params: {
      location: location.display || '',
      playerName: player.name || 'you',
      day: gameTime?.day ?? 1,
      hour: gameTime?.hour ?? 0,
    },
  })
  text = perceptionFiltersApply({ text, insanities: player.psyche?.insanities })
  return narrativeTextCreate({ text })
}

/**
 * Generates narrative text for an action resolution result.
 *
 * @param {Object} actionResult - result from actionResolve()
 * @returns {NarrativeText}
 */
export function narrativeAction(actionResult) {
  // Why not is the loop's to say, in somebody's voice. There is no outcome to narrate.
  if (actionResult.requirementFailure) return narrativeTextCreate({ text: '' })
  const outcome = actionResult.outcome
  if (!outcome) return narrativeTextCreate({ text: '' })
  if (outcome.narrative?.tokens) return outcome.narrative
  if (typeof outcome.narrative === 'string') return narrativeTextCreate({ text: outcome.narrative })
  return narrativeTextCreate({ text: '' })
}

/**
 * Generates narrative text for an event.
 *
 * @param {{ event: Object, player: Object }} input
 *   event — GameEvent per data contract
 * @returns {NarrativeText}
 */
export function narrativeEvent({ event, player }) {
  if (!event.narrative) return narrativeTextCreate({ text: '' })
  if (event.narrative.tokens) {
    const insanities = player.psyche?.insanities ?? []
    if (insanities.length === 0) return event.narrative
    const filteredTokens = event.narrative.tokens.map((token) => ({
      ...token,
      text: perceptionFiltersApply({ text: token.text, insanities }),
    }))
    return { tokens: filteredTokens }
  }
  if (typeof event.narrative === 'string') {
    const filtered = perceptionFiltersApply({
      text: textFill({ text: event.narrative, params: { playerName: player.name || 'you' } }),
      insanities: player.psyche?.insanities,
    })
    return narrativeTextCreate({ text: filtered })
  }
  return narrativeTextCreate({ text: '' })
}
