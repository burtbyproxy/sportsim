import { ref, readonly } from 'vue'
import { blendSober } from '../engine/blend.js'
import { template, pickVariant, toNarrativeText } from '../utils/text.js'

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
 * Per-character delay ranges (ms) for each speed setting.
 * Each character gets a random value within [min, max].
 * instant is always 0 — no range needed.
 */
export const SPEED_MS = {
  instant: 0,
  fast: { min: 1, max: 5 },
  normal: { min: 2, max: 10 },
  slow: { min: 15, max: 40 },
  crawl: { min: 50, max: 120 },
}

/**
 * Minimum mean throughput the normal tier must sustain on ordinary prose,
 * in characters per second. Guards against the pauses stacking up until
 * a paragraph takes fifteen seconds to read.
 */
export const NORMAL_TIER_MIN_CHARS_PER_SECOND = 100

/**
 * Extra delay added after punctuation characters — makes the text breathe.
 * These stack on top of the base character delay.
 */
export const PUNCTUATION_PAUSE = {
  '.': { min: 60, max: 110 },
  '!': { min: 60, max: 110 },
  '?': { min: 60, max: 110 },
  ',': { min: 25, max: 50 },
  ';': { min: 25, max: 50 },
  ':': { min: 20, max: 40 },
  '—': { min: 60, max: 110 }, // em-dash — dramatic
  '–': { min: 25, max: 50 }, // en-dash
}

/**
 * Mean milliseconds the renderer spends on one character of `text` at `speed`,
 * base delay plus punctuation pauses. Pure — used to prove the throughput contract.
 * @param {{ text: string, speed: string }} input
 * @returns {number}
 */
export function meanCharDelayMs({ text, speed }) {
  const setting = SPEED_MS[speed] ?? SPEED_MS.normal
  if (setting === 0 || text.length === 0) return 0
  const baseMean = (setting.min + setting.max) / 2
  let total = 0
  for (const char of text) {
    const extra = PUNCTUATION_PAUSE[char]
    total += baseMean + (extra ? (extra.min + extra.max) / 2 : 0)
  }
  return total / text.length
}

/** Pick a random integer in [min, max] inclusive. */
function _randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Resolve a speed setting to a base character delay in ms.
 * For range-based speeds, picks a random value within the range.
 * @param {string} speed
 * @returns {number}
 */
function _resolveSpeedMs(speed) {
  const setting = SPEED_MS[speed] ?? SPEED_MS.normal
  if (setting === 0) return 0
  return _randInt(setting.min, setting.max)
}

/**
 * Calculate the total delay for rendering a character at a given speed.
 * Adds punctuation / word-boundary pauses on top of the base delay.
 * @param {string} char - the character just typed
 * @param {string} speed - speed tier name
 * @returns {number} ms to wait before rendering the next character
 */
function _charDelay(char, speed) {
  const base = _resolveSpeedMs(speed)
  const extra = PUNCTUATION_PAUSE[char]
  if (!extra) return base
  return base + _randInt(extra.min, extra.max)
}

export function useNarrative() {
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

  function emit(event, data) {
    for (const cb of listeners[event] ?? []) cb(data)
  }

  function on(event, cb) {
    listeners[event] = listeners[event] ?? []
    listeners[event].push(cb)
  }

  function off(event, cb) {
    listeners[event] = (listeners[event] ?? []).filter((c) => c !== cb)
  }

  /**
   * Queue a NarrativeText for rendering.
   * @param {import('../engine/narrative-types.js').NarrativeText} narrativeText
   */
  function enqueue(narrativeText) {
    queue.value.push(narrativeText)
    if (!isAnimating.value) {
      _processQueue()
    }
  }

  /**
   * Skip current animation — show all queued text instantly.
   */
  function skip() {
    skipRequested = true
    emit('skip')
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
    _currentTokenProgress.value = ''
  }

  /**
   * Internal: process the queue, one entry at a time.
   */
  async function _processQueue() {
    if (queue.value.length === 0) {
      isAnimating.value = false
      return
    }

    isAnimating.value = true
    const narrativeText = queue.value.shift()
    skipRequested = false
    const generation = renderGeneration

    emit('animation-start', narrativeText)

    const entry = await _renderNarrativeText(narrativeText)

    // clearLog ran while this was rendering — the entry belongs to a dead scene
    if (generation !== renderGeneration) {
      _processQueue()
      return
    }

    log.value.push(entry)

    emit('animation-complete', entry)

    // Process next in queue
    _processQueue()
  }

  /**
   * Render a NarrativeText into a log entry.
   * Returns a plain object safe to store in log.
   * Updates activeEntryState in real-time so components can show live progress.
   */
  async function _renderNarrativeText(narrativeText) {
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

      const rendered = await _animateToken(token)
      renderedTokens.push({ ...token, rendered })

      // Token done — update completed list
      activeEntryState.value = {
        completedTokens: [...renderedTokens],
        currentToken: null,
      }

      if (!skipRequested && token.pauseAfter > 0) {
        await _pause(token.pauseAfter)
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
  function _animateToken(token) {
    return new Promise((resolve) => {
      const speed = token.speed ?? 'normal'
      const text = token.text

      // instant speed or skip — resolve immediately
      if (SPEED_MS[speed] === 0 || skipRequested) {
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
        _currentTokenProgress.value = text.slice(0, i)

        if (i >= text.length) {
          resolve(text)
          return
        }

        // Delay for the NEXT character is based on the character we just typed
        // — punctuation after a full-stop breathes longer than a mid-word letter
        const delay = _charDelay(text[i - 1], speed)
        setTimeout(tick, delay)
      }

      // Kick off with the delay for the very first character
      setTimeout(tick, _resolveSpeedMs(speed))
    })
  }

  function _pause(ms) {
    return new Promise((resolve) => {
      if (skipRequested) {
        resolve()
        return
      }
      const timeout = setTimeout(() => resolve(), ms)
      // Watch for skip during pause
      const check = setInterval(() => {
        if (skipRequested) {
          clearTimeout(timeout)
          clearInterval(check)
          resolve()
        }
      }, 16)
      // Clean up check when pause resolves normally
      Promise.resolve().then(() => {
        // interval will clear when pause resolves — but we need to also clear check
        setTimeout(() => clearInterval(check), ms + 50)
      })
    })
  }

  /**
   * Reactive ref holding in-progress token text (for live display).
   * The NarrativeLog component reads this to show characters as they appear.
   */
  const _currentTokenProgress = ref('')

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
    currentTokenProgress: readonly(_currentTokenProgress),
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
 * @returns {Record<string, (e: KeyboardEvent) => void>}
 */
export function narrativeSkipBindings({ narrative }) {
  return {
    ' ': (e) => {
      if (!narrative.isAnimating.value) return
      e.preventDefault()
      narrative.skip()
    },
  }
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
function _applyPerceptionFilters(text, insanities) {
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
function _buildNarrativeContext(player, gameTime, location) {
  const sobriety = player.status?.sobriety ?? 100
  const energy = player.status?.energy ?? 80
  const hunger = player.status?.hunger ?? 50
  const blend = player.blend ?? blendSober()
  // Every persona acting on the player is a flag, so content can key a
  // variant on "telepath" or "priest" the way it keys one on "drunk".
  const personaFlags = Object.fromEntries(blend.weights.map((w) => [w.personaId, true]))
  return {
    period: gameTime?.period ?? 'morning',
    visitCount: location?.visitCount ?? 0,
    drunk: sobriety < 30,
    exhausted: energy < 20,
    starving: hunger < 15,
    ...personaFlags,
    personaId: blend.dominantPersonaId,
  }
}

/**
 * Generates the narrative description for a location.
 * Picks the best variant, applies perception filters, templates in variables.
 *
 * @param {Object} location - Location per data contract
 * @param {Object} player
 * @param {Object} gameTime
 * @returns {NarrativeText}
 */
export function generateLocationNarrative(location, player, gameTime) {
  const context = _buildNarrativeContext(player, gameTime, location)
  let text = pickVariant(location.descriptions || {}, context)
  text = template(text, {
    location: location.display || '',
    playerName: player.name || 'you',
    day: gameTime?.day ?? 1,
    hour: gameTime?.hour ?? 0,
  })
  text = _applyPerceptionFilters(text, player.psyche?.insanities)
  return toNarrativeText(text)
}

/**
 * Generates narrative text for an action resolution result.
 *
 * @param {Object} actionResult - result from resolveAction()
 * @returns {NarrativeText}
 */
export function generateActionNarrative(actionResult) {
  if (actionResult.requirementFailure) {
    return toNarrativeText(actionResult.requirementFailure, { style: 'italic', color: '#888' })
  }
  const outcome = actionResult.outcome
  if (!outcome) return toNarrativeText('')
  if (outcome.narrative?.tokens) return outcome.narrative
  if (typeof outcome.narrative === 'string') return toNarrativeText(outcome.narrative)
  return toNarrativeText('')
}

/**
 * Generates narrative text for an event.
 *
 * @param {Object} event - GameEvent per data contract
 * @param {Object} player
 * @returns {NarrativeText}
 */
export function generateEventNarrative(event, player) {
  if (!event.narrative) return toNarrativeText('')
  if (event.narrative.tokens) {
    const insanities = player.psyche?.insanities ?? []
    if (insanities.length === 0) return event.narrative
    const filteredTokens = event.narrative.tokens.map((token) => ({
      ...token,
      text: _applyPerceptionFilters(token.text, insanities),
    }))
    return { tokens: filteredTokens }
  }
  if (typeof event.narrative === 'string') {
    const filtered = _applyPerceptionFilters(
      template(event.narrative, { playerName: player.name || 'you' }),
      player.psyche?.insanities
    )
    return toNarrativeText(filtered)
  }
  return toNarrativeText('')
}
