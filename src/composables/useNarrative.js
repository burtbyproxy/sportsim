import { ref, readonly } from 'vue'
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

/** ms per character for each speed setting */
const SPEED_MS = {
  instant: 0,
  fast: 20,
  normal: 40,
  slow: 80,
  crawl: 150,
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
   */
  function clearLog() {
    log.value = []
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

    emit('animation-start', narrativeText)

    const entry = await _renderNarrativeText(narrativeText)
    log.value.push(entry)

    emit('animation-complete', entry)

    // Process next in queue
    _processQueue()
  }

  /**
   * Render a NarrativeText into a log entry.
   * Returns a plain object safe to store in log.
   */
  async function _renderNarrativeText(narrativeText) {
    const renderedTokens = []

    for (const token of narrativeText.tokens) {
      if (skipRequested) {
        // Instant-complete this token
        renderedTokens.push({ ...token, rendered: token.text })
        continue
      }

      const rendered = await _animateToken(token)
      renderedTokens.push({ ...token, rendered })

      if (!skipRequested && token.pauseAfter > 0) {
        await _pause(token.pauseAfter)
      }
    }

    return { tokens: renderedTokens, id: Date.now() + Math.random() }
  }

  /**
   * Animate a single token character by character.
   * Returns the full text when done.
   */
  function _animateToken(token) {
    return new Promise((resolve) => {
      const speedMs = SPEED_MS[token.speed] ?? SPEED_MS.normal
      const text = token.text

      if (speedMs === 0 || skipRequested) {
        resolve(text)
        return
      }

      let i = 0
      // We update the last rendered token in the current working entry
      // by mutating via a live ref — see NarrativeLog for how it reads this
      const interval = setInterval(() => {
        if (skipRequested) {
          clearInterval(interval)
          resolve(text)
          return
        }
        i++
        // Emit partial render via a reactive ref the component can watch
        _currentTokenProgress.value = text.slice(0, i)
        if (i >= text.length) {
          clearInterval(interval)
          resolve(text)
        }
      }, speedMs)
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
   * Whether there's content being animated or queued.
   */
  const hasContent = ref(false)

  return {
    log: readonly(log),
    queue: readonly(queue),
    isAnimating: readonly(isAnimating),
    currentTokenProgress: readonly(_currentTokenProgress),
    enqueue,
    skip,
    clearLog,
    on,
    off,
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
  return {
    period: gameTime?.period ?? 'morning',
    visitCount: location?.visitCount ?? 0,
    drunk: sobriety < 30,
    exhausted: energy < 20,
    starving: hunger < 15,
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
